import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function EventOverview() {
  const { event } = useOutletContext()
  const [stats, setStats] = useState({ overdueTasks: 0, totalTasks: 0, doneTasks: 0, pendingGuests: 0, estimatedBudget: 0, contractedBudget: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const [tasksResult, guestsResult, budgetResult] = await Promise.all([
        supabase.from('tasks').select('status,due_date').eq('event_id', event.id),
        supabase.from('guests').select('invitation_status').eq('event_id', event.id),
        supabase.from('budget_items').select('estimated_amount,contracted_amount').eq('event_id', event.id),
      ])
      if (!active) return
      const tasks = tasksResult.data || []
      const guests = guestsResult.data || []
      const budget = budgetResult.data || []
      setStats({
        overdueTasks: tasks.filter((task) => task.due_date && task.due_date < today && !['done', 'canceled'].includes(task.status)).length,
        totalTasks: tasks.filter((task) => task.status !== 'canceled').length,
        doneTasks: tasks.filter((task) => task.status === 'done').length,
        pendingGuests: guests.filter((guest) => guest.invitation_status === 'pending').length,
        estimatedBudget: budget.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0),
        contractedBudget: budget.reduce((sum, item) => sum + Number(item.contracted_amount || 0), 0),
      })
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [event.id])

  const progress = useMemo(() => stats.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0, [stats.doneTasks, stats.totalTasks])
  const budgetProgress = useMemo(() => stats.estimatedBudget > 0 ? Math.min(100, Math.round((stats.contractedBudget / stats.estimatedBudget) * 100)) : 0, [stats.estimatedBudget, stats.contractedBudget])

  if (loading) return <div className="panel loading-panel">Cargando resumen…</div>

  return (
    <div className="detail-grid">
      <article className="panel span-2">
        <p className="eyebrow">ATENCIÓN</p>
        <h2>Qué necesita atención en {event.name}</h2>
        <div className="attention-list">
          <div><strong>{stats.overdueTasks} tareas vencidas</strong><span>{stats.totalTasks ? `${stats.doneTasks} de ${stats.totalTasks} completadas` : 'Todavía no cargaste tareas'}</span></div>
          <div><strong>{stats.pendingGuests} invitados pendientes</strong><span>{stats.pendingGuests ? 'Pendientes de confirmación' : 'Sin confirmaciones pendientes'}</span></div>
          <div><strong>{event.estimated_guests ?? '—'} invitados estimados</strong><span>{event.venue_name || 'Lugar todavía no definido'}</span></div>
        </div>
      </article>
      <article className="panel">
        <p className="eyebrow">PRESUPUESTO</p>
        <h2>{money(stats.estimatedBudget, event.currency)}</h2>
        <p>{money(stats.contractedBudget, event.currency)} contratado</p>
        <div className="progress"><i style={{ width: `${budgetProgress}%` }} /></div>
      </article>
      <article className="panel">
        <p className="eyebrow">PLANIFICACIÓN</p>
        <h2>{progress}%</h2>
        <p>{stats.doneTasks} de {stats.totalTasks} tareas listas</p>
        <div className="progress"><i style={{ width: `${progress}%` }} /></div>
      </article>
    </div>
  )
}

function money(value, currency = 'USD') {
  if (!value) return currency === 'PYG' ? 'Gs. 0' : 'US$ 0'
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: currency === 'PYG' ? 0 : 2 }).format(value)
}
