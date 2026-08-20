import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import TaskFormModal from './TaskFormModal.jsx'
import {
  getPlanningStageOrder,
  getPlanningTemplate,
  getPlanningTemplateCount,
  getPlanningTemplateKey,
} from './planningTemplates.js'

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  blocked: 'Bloqueada',
  done: 'Completada',
  canceled: 'Cancelada',
}

const priorityLabels = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }

export default function PlanningPage() {
  const { event } = useOutletContext()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [collapsedStages, setCollapsedStages] = useState(new Set())
  const [phase, setPhase] = useState('all')
  const [category, setCategory] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('tasks')
      .select('*')
      .eq('event_id', event.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })

    if (queryError) setError(queryError.message)
    setTasks(data || [])
    setLoading(false)
  }, [event.id])

  useEffect(() => { loadTasks() }, [loadTasks])

  const today = new Date().toISOString().slice(0, 10)
  const eventAddedDate = String(event.created_at || today).slice(0, 10)
  const activeTasks = tasks.filter(task => !['done', 'canceled'].includes(task.status))
  const doneTasks = tasks.filter(task => task.status === 'done')
  const historicalTasks = activeTasks.filter(task => isHistoricalTemplateTask(task, eventAddedDate))
  const historicalIds = useMemo(() => new Set(historicalTasks.map(task => task.id)), [historicalTasks])
  const overdueTasks = activeTasks.filter(task => task.due_date && task.due_date < today && !historicalIds.has(task.id))
  const upcomingTasks = activeTasks.filter(task => task.due_date && task.due_date >= today && daysBetween(today, task.due_date) <= 30)

  const stageOrder = useMemo(() => getPlanningStageOrder(event), [event])
  const stageRank = useMemo(() => new Map(stageOrder.map((item, index) => [item, index])), [stageOrder])

  const phases = useMemo(() => [...new Set(tasks.map(task => task.phase).filter(Boolean))]
    .sort((a, b) => {
      const aRank = stageRank.has(a) ? stageRank.get(a) : 9999
      const bRank = stageRank.has(b) ? stageRank.get(b) : 9999
      if (aRank !== bRank) return aRank - bRank
      return a.localeCompare(b, 'es')
    }), [tasks, stageRank])

  const categories = useMemo(() => [...new Set(tasks.map(task => task.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es')), [tasks])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    return tasks.filter(task => {
      if (status === 'active' && ['done', 'canceled'].includes(task.status)) return false
      if (status === 'attention' && !(overdueTasks.some(item => item.id === task.id) || task.status === 'blocked')) return false
      if (status === 'review' && !historicalIds.has(task.id)) return false
      if (status === 'upcoming' && !upcomingTasks.some(item => item.id === task.id)) return false
      if (!['all','active','attention','review','upcoming'].includes(status) && task.status !== status) return false
      if (phase !== 'all' && task.phase !== phase) return false
      if (category !== 'all' && task.category !== category) return false
      if (normalized && !`${task.title} ${task.description || ''} ${task.responsible_label || ''} ${task.phase || ''} ${task.category || ''}`.toLocaleLowerCase('es').includes(normalized)) return false
      return true
    })
  }, [tasks, status, phase, category, query, historicalIds, overdueTasks, upcomingTasks])

  const groupedTasks = useMemo(() => {
    const groups = new Map()
    for (const task of filtered) {
      const key = task.phase || 'Sin etapa'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(task)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const aRank = stageRank.has(a) ? stageRank.get(a) : 9999
      const bRank = stageRank.has(b) ? stageRank.get(b) : 9999
      if (aRank !== bRank) return aRank - bRank
      return a.localeCompare(b, 'es')
    })
  }, [filtered, stageRank])

  const progress = tasks.filter(task => task.status !== 'canceled').length
    ? Math.round((doneTasks.length / tasks.filter(task => task.status !== 'canceled').length) * 100)
    : 0

  const templateKey = getPlanningTemplateKey(event)
  const templateCount = getPlanningTemplateCount(event)
  const eventTemplatePrefix = event.event_type === 'quince' ? 'quince_' : 'wedding_'
  const templateTasks = tasks.filter(task => task.template_key?.startsWith(eventTemplatePrefix))
  const currentTemplateTasks = tasks.filter(task => task.template_key === templateKey)
  const hasFullCurrentTemplate = currentTemplateTasks.length >= templateCount

  async function toggleDone(task) {
    const nextStatus = task.status === 'done' ? 'pending' : 'done'
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .eq('event_id', event.id)

    if (updateError) setError(updateError.message)
    else loadTasks()
  }

  async function removeTask(task) {
    if (!window.confirm(`¿Eliminar “${task.title}”?`)) return
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .eq('event_id', event.id)

    if (deleteError) setError(deleteError.message)
    else loadTasks()
  }

  async function loadBaseTemplate() {
    const isWedding = event.event_type !== 'quince'
    const label = isWedding ? `${templateCount} tareas y ${stageOrder.length} etapas` : `${templateCount} tareas iniciales`

    if (templateTasks.length) {
      const okay = window.confirm(
        hasFullCurrentTemplate
          ? `El checklist ${isWedding ? 'completo' : 'base'} ya está cargado. ¿Querés recargarlo? Se conservarán las tareas creadas manualmente.`
          : `Hay una versión anterior del checklist. ¿Querés actualizarla a ${label}? Se reemplazarán solo las tareas del template; las tareas creadas manualmente se conservarán.`
      )
      if (!okay) return
    } else if (tasks.length) {
      const okay = window.confirm(`Ya tenés ${tasks.length} tareas manuales. ¿Querés agregar también el checklist de ${label}?`)
      if (!okay) return
    }

    setLoadingTemplate(true)
    setError('')

    const previousByTitle = new Map(templateTasks.map(task => [normalizeTitle(task.title), task]))
    const template = getPlanningTemplate(event).map(task => {
      const previous = previousByTitle.get(normalizeTitle(task.title))
      if (!previous) return task
      const previousWasCustom = previous.due_date_source === 'manual'
      return {
        ...task,
        status: previous.status || task.status,
        responsible_label: previous.responsible_label || null,
        responsible_user_id: previous.responsible_user_id || null,
        description: previous.description || null,
        google_calendar_enabled: Boolean(previous.google_calendar_enabled),
        due_date: previousWasCustom ? previous.due_date : task.due_date,
        due_time: previous.due_time || null,
        due_date_source: previousWasCustom ? 'manual' : task.due_date_source,
        due_offset_days: task.due_offset_days,
      }
    })

    if (templateTasks.length) {
      const ids = templateTasks.map(task => task.id)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('event_id', event.id)
        .in('id', ids)

      if (deleteError) {
        setLoadingTemplate(false)
        setError(deleteError.message)
        return
      }
    }

    const { error: insertError } = await supabase.from('tasks').insert(template)
    setLoadingTemplate(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    await loadTasks()
  }

  function openNew() {
    setEditingTask(null)
    setModalOpen(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setModalOpen(true)
  }

  function toggleStage(stage) {
    setCollapsedStages(current => {
      const next = new Set(current)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  async function resolveHistoricalStage(stage, stageTasks) {
    const pendingHistorical = stageTasks.filter(task => historicalIds.has(task.id) && !['done','canceled'].includes(task.status))
    if (!pendingHistorical.length) return
    if (!window.confirm(`¿Marcar ${pendingHistorical.length} tareas de “${stage}” como resueltas? Usá esta opción solo si esas decisiones ya fueron realizadas antes de cargar el evento.`)) return
    const { error: updateError } = await supabase.from('tasks').update({ status:'done', updated_at:new Date().toISOString() }).eq('event_id', event.id).in('id', pendingHistorical.map(task => task.id))
    if (updateError) setError(updateError.message)
    else loadTasks()
  }

  const templateButtonLabel = loadingTemplate
    ? 'Cargando…'
    : hasFullCurrentTemplate
      ? `Recargar checklist ${event.event_type === 'quince' ? 'base' : 'completo'}`
      : templateTasks.length
        ? `Actualizar checklist (${templateCount})`
        : event.event_type === 'quince'
          ? `Cargar checklist base (${templateCount})`
          : `Cargar checklist completo (${templateCount})`

  return (
    <section className="planning-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">PLANIFICACIÓN</p>
          <h2>Plan maestro de {event.name}</h2>
          <p>
            {event.event_type === 'quince'
              ? 'Tareas, vencimientos, responsables y prioridades para acompañar toda la planificación.'
              : `Checklist profesional completo: ${templateCount} tareas distribuidas en ${stageOrder.length} etapas, desde 12 meses antes hasta después de la boda.`}
          </p>
        </div>
        <div className="module-actions">
          <button className="secondary-btn" onClick={loadBaseTemplate} disabled={loadingTemplate}>{templateButtonLabel}</button>
          <button className="primary-btn" onClick={openNew}>+ Nueva tarea</button>
        </div>
      </div>

      <div className="planning-metrics">
        <Metric label="Progreso" value={`${progress}%`} detail={`${doneTasks.length} completadas`} />
        <Metric label="Necesitan atención" value={overdueTasks.length} detail={overdueTasks.length ? 'Vencidas desde que cargaste el evento' : 'Sin vencimientos reales'} danger={overdueTasks.length > 0} />
        <Metric label="Etapas anteriores" value={historicalTasks.length} detail={historicalTasks.length ? 'Revisar o marcar como ya resueltas' : 'Nada pendiente de etapas previas'} />
        <Metric label="Próximos 30 días" value={upcomingTasks.length} detail="Tareas con fecha próxima" />
      </div>
      {historicalTasks.length > 0 && <div className="planning-context-banner"><div><strong>Este evento ya estaba en marcha cuando lo cargaste.</strong><span>Las tareas cuya fecha sugerida quedó antes del alta del evento no se cuentan como “vencidas”: aparecen como etapas anteriores para revisar.</span></div><button className="secondary-btn" onClick={() => setStatus('review')}>Revisar etapas anteriores</button></div>}

      <div className="progress planning-progress"><i style={{ width: `${progress}%` }} /></div>

      <div className="planning-toolbar planning-toolbar-4">
        <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tarea, responsable, categoría o etapa…" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Pendientes activas</option>
          <option value="attention">Necesita atención</option>
          <option value="upcoming">Próximos 30 días</option>
          <option value="review">Etapas anteriores por revisar</option>
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="in_progress">En curso</option>
          <option value="blocked">Bloqueadas</option>
          <option value="done">Completadas</option>
          <option value="canceled">Canceladas</option>
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="all">Todas las etapas</option>
          {phases.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {error && <p className="form-error planning-error">{error}</p>}

      {loading ? (
        <div className="panel loading-panel">Cargando planificación…</div>
      ) : filtered.length ? (
        <div className="task-stage-list">
          {groupedTasks.map(([stage, stageTasks]) => {
            const completedInStage = stageTasks.filter(task => task.status === 'done').length
            return (
              <section className={`task-stage-group ${collapsedStages.has(stage) ? 'is-collapsed' : ''}`} key={stage}>
                <header className="task-stage-head task-stage-head-clickable" onClick={() => toggleStage(stage)}>
                  <div className="task-stage-title-wrap">
                    <span className="stage-chevron">{collapsedStages.has(stage) ? '›' : '⌄'}</span>
                    <div><span className="task-stage-kicker">ETAPA</span><h3>{stage}</h3></div>
                  </div>
                  <div className="task-stage-summary">
                    {stageTasks.filter(task => historicalIds.has(task.id)).length > 0 && <span className="review-badge">{stageTasks.filter(task => historicalIds.has(task.id)).length} por revisar</span>}
                    <div className="task-stage-count"><strong>{completedInStage}/{stageTasks.length}</strong><span>completadas</span></div>
                    {stageTasks.some(task => historicalIds.has(task.id) && !['done','canceled'].includes(task.status)) && <button className="text-action strong-action" onClick={e => { e.stopPropagation(); resolveHistoricalStage(stage, stageTasks) }}>Marcar etapa resuelta</button>}
                  </div>
                </header>

                {!collapsedStages.has(stage) && <div className="task-list">
                  {stageTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      historical={historicalIds.has(task.id)}
                      onToggle={toggleDone}
                      onEdit={openEdit}
                      onRemove={removeTask}
                    />
                  ))}
                </div>}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="panel empty-state compact-planning-empty">
          <p className="eyebrow">PLAN MAESTRO</p>
          <h2>{tasks.length ? 'No hay tareas con estos filtros' : 'Todavía no hay tareas'}</h2>
          <p>
            {tasks.length
              ? 'Probá cambiando los filtros o la búsqueda.'
              : event.event_type === 'quince'
                ? 'Podés empezar desde cero o cargar el checklist base de quinceaños.'
                : `Cargá el checklist profesional completo con ${templateCount} tareas y ${stageOrder.length} etapas. Después podés editar, borrar o agregar tus propias tareas.`}
          </p>
          {!tasks.length && (
            <div className="empty-actions">
              <button className="secondary-btn" onClick={loadBaseTemplate} disabled={loadingTemplate}>{templateButtonLabel}</button>
              <button className="primary-btn" onClick={openNew}>Crear primera tarea</button>
            </div>
          )}
        </div>
      )}

      <TaskFormModal
        open={modalOpen}
        event={event}
        task={editingTask}
        onClose={() => setModalOpen(false)}
        onSaved={async () => { setModalOpen(false); await loadTasks() }}
      />
    </section>
  )
}

function TaskRow({ task, today, historical, onToggle, onEdit, onRemove }) {
  const overdue = !historical && task.due_date && task.due_date < today && !['done', 'canceled'].includes(task.status)
  return (
    <article className={`task-row ${task.status === 'done' ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''} ${historical ? 'is-historical' : ''}`}>
      <button
        className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
        onClick={() => onToggle(task)}
        title={task.status === 'done' ? 'Reabrir tarea' : 'Marcar como completada'}
      >
        {task.status === 'done' ? '✓' : ''}
      </button>

      <div className="task-main">
        <div className="task-title-line">
          <strong>{task.title}</strong>
          {task.category && <span className="category-badge">{task.category}</span>}
          <span className={`priority-badge priority-${task.priority}`}>{priorityLabels[task.priority]}</span>
          <span className={`status-badge status-${task.status}`}>{statusLabels[task.status]}</span>
        </div>

        {task.description && <p>{task.description}</p>}

        <div className="task-meta">
          <span className={overdue ? 'overdue-copy' : ''}>
            {task.due_date
              ? `${historical ? 'Fecha sugerida original' : overdue ? 'Venció' : 'Vence'} ${formatDate(task.due_date)}${task.due_time ? ` · ${String(task.due_time).slice(0, 5)}` : ''}`
              : 'Sin fecha límite'}
          </span>
          {historical && <span className="review-badge">Etapa anterior · revisar</span>}
          {task.due_date && <span className={`date-source-label date-source-${task.due_date_source || 'manual'}`}>{dateSourceLabel(task)}</span>}
          {task.responsible_label && <span>Responsable: {task.responsible_label}</span>}
          {task.google_calendar_enabled && <span>Calendar preparado</span>}
        </div>
      </div>

      <div className="task-actions">
        <button className="text-action" onClick={() => onEdit(task)}>Editar</button>
        <button className="text-action danger-action" onClick={() => onRemove(task)}>Eliminar</button>
      </div>
    </article>
  )
}

function Metric({ label, value, detail, danger }) {
  return (
    <article className={`planning-metric ${danger ? 'danger' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function normalizeTitle(value) {
  return String(value || '').trim().toLocaleLowerCase('es')
}

function isHistoricalTemplateTask(task, eventAddedDate) { return Boolean(task.template_key && task.due_date && task.due_date < eventAddedDate && !['done','canceled'].includes(task.status)) }
function daysBetween(a,b) { return Math.ceil((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) }

function dateSourceLabel(task) {
  if (task.due_date_source === 'suggested') return 'Fecha sugerida'
  if (task.due_date_source === 'relative') return 'Relativa al evento'
  return task.template_key ? 'Fecha personalizada' : 'Fecha definida'
}
