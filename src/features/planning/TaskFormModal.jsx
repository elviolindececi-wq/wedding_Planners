import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { addDays, TASK_CATEGORIES } from './planningTemplates.js'

const emptyForm = {
  title: '',
  description: '',
  phase: '',
  category: '',
  due_date: '',
  due_time: '',
  status: 'pending',
  priority: 'normal',
  responsible_label: '',
  google_calendar_enabled: false,
  due_date_source: 'manual',
  due_offset_days: '',
}

export default function TaskFormModal({ open, event, task, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const eventId = event?.id

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(task ? {
      title: task.title || '',
      description: task.description || '',
      phase: task.phase || '',
      category: task.category || '',
      due_date: task.due_date || '',
      due_time: task.due_time ? String(task.due_time).slice(0, 5) : '',
      status: task.status || 'pending',
      priority: task.priority || 'normal',
      responsible_label: task.responsible_label || '',
      google_calendar_enabled: Boolean(task.google_calendar_enabled),
      due_date_source: task.due_date_source || (task.template_key ? 'suggested' : 'manual'),
      due_offset_days: task.due_offset_days ?? '',
    } : emptyForm)
  }, [open, task])

  const suggestedDate = useMemo(() => {
    if (!event?.event_date || form.due_offset_days === '' || form.due_offset_days === null) return ''
    return addDays(event.event_date, Number(form.due_offset_days)) || ''
  }, [event?.event_date, form.due_offset_days])

  if (!open) return null

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))

  function changeDueDate(value) {
    setForm(current => ({
      ...current,
      due_date: value,
      // Si una fecha automática se modifica a mano, pasa a ser personalizada.
      due_date_source: current.due_date_source === 'suggested' || current.due_date_source === 'relative'
        ? 'manual'
        : current.due_date_source,
    }))
  }

  function restoreSuggestedDate() {
    if (!suggestedDate) return
    setForm(current => ({
      ...current,
      due_date: suggestedDate,
      due_date_source: task?.template_key ? 'suggested' : 'relative',
    }))
  }

  async function submit(eventSubmit) {
    eventSubmit.preventDefault()
    if (!form.title.trim()) {
      setError('Escribí un título para la tarea.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      event_id: eventId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      phase: form.phase.trim() || null,
      category: form.category.trim() || null,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      due_date_source: form.due_date_source || 'manual',
      due_offset_days: form.due_offset_days === '' ? null : Number(form.due_offset_days),
      status: form.status,
      priority: form.priority,
      responsible_label: form.responsible_label.trim() || null,
      google_calendar_enabled: form.google_calendar_enabled,
      updated_at: new Date().toISOString(),
    }

    let result
    if (task) {
      result = await supabase.from('tasks').update(payload).eq('id', task.id).eq('event_id', eventId)
    } else {
      result = await supabase.from('tasks').insert({ id: crypto.randomUUID(), ...payload })
    }

    setSaving(false)
    if (result.error) {
      setError(result.error.message)
      return
    }

    onSaved?.()
  }

  const isAutomatic = form.due_date_source === 'suggested' || form.due_date_source === 'relative'
  const canRestore = Boolean(suggestedDate && form.due_date !== suggestedDate && form.due_offset_days !== '')

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="modal-card task-modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{task ? 'EDITAR TAREA' : 'NUEVA TAREA'}</p>
            <h2>{task ? 'Actualizar tarea' : 'Agregar a la planificación'}</h2>
          </div>
          <button className="icon-btn" type="button" disabled={saving} onClick={onClose}>×</button>
        </div>

        <form className="event-form" onSubmit={submit}>
          <label>Tarea
            <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Ej. Confirmar menú final" autoFocus />
          </label>

          <div className="form-grid-2">
            <label>Etapa
              <input value={form.phase} onChange={(e) => update('phase', e.target.value)} placeholder="Ej. 1 mes antes" />
            </label>
            <label>Categoría
              <input
                list="task-category-options"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Ej. Catering, Invitados, Finanzas"
              />
              <datalist id="task-category-options">
                {TASK_CATEGORIES.map(item => <option key={item} value={item} />)}
              </datalist>
            </label>
          </div>

          <label>Responsable
            <input value={form.responsible_label} onChange={(e) => update('responsible_label', e.target.value)} placeholder="Ej. Ceci, asistente, pareja, proveedor" />
          </label>

          <div className="form-grid-2">
            <label>Fecha límite
              <input type="date" value={form.due_date} onChange={(e) => changeDueDate(e.target.value)} />
            </label>
            <label>Hora
              <input type="time" value={form.due_time} onChange={(e) => update('due_time', e.target.value)} />
            </label>
          </div>

          {task?.template_key && form.due_offset_days !== '' && (
            <div className={`date-source-box ${isAutomatic ? 'automatic' : 'custom'}`}>
              <div>
                <strong>{isAutomatic ? 'Fecha sugerida por el sistema' : 'Fecha personalizada'}</strong>
                <small>
                  {isAutomatic
                    ? `Se calcula automáticamente desde la fecha del evento (${formatOffset(form.due_offset_days)}).`
                    : 'La planner modificó esta fecha. Si cambia la fecha del evento, esta tarea no se moverá automáticamente.'}
                </small>
              </div>
              {canRestore && <button type="button" className="text-action" onClick={restoreSuggestedDate}>Restaurar sugerida</button>}
            </div>
          )}

          {!task && event?.event_date && (
            <p className="form-hint">Las tareas manuales usan una fecha exacta. Las tareas del checklist se crean automáticamente con fechas estimadas según la fecha del evento.</p>
          )}

          <div className="form-grid-2">
            <label>Prioridad
              <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                <option value="low">Baja</option>
                <option value="normal">Media / normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label>Estado
              <select value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En curso</option>
                <option value="blocked">Bloqueada</option>
                <option value="done">Completada</option>
                <option value="canceled">Cancelada</option>
              </select>
            </label>
          </div>

          <label>Notas / descripción
            <textarea rows="4" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Información que el equipo necesita tener a mano…" />
          </label>

          <label className="check-row">
            <input type="checkbox" checked={form.google_calendar_enabled} onChange={(e) => update('google_calendar_enabled', e.target.checked)} />
            <span>
              <strong>Preparar para Google Calendar</strong>
              <small>Guardamos esta preferencia ahora; la sincronización se conectará cuando implementemos Google Calendar.</small>
            </span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : task ? 'Guardar cambios' : 'Crear tarea'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatOffset(value) {
  const days = Number(value)
  if (!Number.isFinite(days)) return 'fecha relativa'
  if (days === 0) return 'el día del evento'
  if (days === 1) return '1 día después'
  if (days > 1) return `${days} días después`
  if (days === -1) return '1 día antes'
  return `${Math.abs(days)} días antes`
}
