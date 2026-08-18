import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { formatMoney } from '../../lib/money.js'
import EventWeatherCard from '../weather/EventWeatherCard.jsx'

export default function EventOverview() {
  const { event } = useOutletContext()
  const [stats, setStats] = useState({
    overdueTasks: 0,
    totalTasks: 0,
    doneTasks: 0,
    pendingGuests: 0,
    plannedBudget: 0,
    contractedBudget: 0,
    paidBudget: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const [tasksResult, guestsResult, categoryResult, budgetResult, paymentsResult] = await Promise.all([
        supabase.from('tasks').select('status,due_date').eq('event_id', event.id),
        supabase.from('guests').select('invitation_status').eq('event_id', event.id),
        supabase.from('budget_categories').select('planned_amount').eq('event_id', event.id),
        supabase.from('budget_items').select('contracted_amount').eq('event_id', event.id),
        supabase.from('vendor_payments').select('amount,status').eq('event_id', event.id),
      ])
      if (!active) return
      const tasks = tasksResult.data || []
      const guests = guestsResult.data || []
      const categories = categoryResult.data || []
      const budget = budgetResult.data || []
      const payments = paymentsResult.data || []
      setStats({
        overdueTasks: tasks.filter((task) => task.due_date && task.due_date < today && !['done', 'canceled'].includes(task.status)).length,
        totalTasks: tasks.filter((task) => task.status !== 'canceled').length,
        doneTasks: tasks.filter((task) => task.status === 'done').length,
        pendingGuests: guests.filter((guest) => guest.invitation_status === 'pending').length,
        plannedBudget: categories.reduce((sum, row) => sum + Number(row.planned_amount || 0), 0),
        contractedBudget: budget.reduce((sum, item) => sum + Number(item.contracted_amount || 0), 0),
        paidBudget: payments.filter(row => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0),
      })
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [event.id, event.budget_total, event.currency])

  const progress = useMemo(() => stats.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0, [stats.doneTasks, stats.totalTasks])
  const budgetTotal = Number(event.budget_total || 0)
  const budgetProgress = useMemo(() => budgetTotal > 0 ? Math.min(100, Math.round((stats.contractedBudget / budgetTotal) * 100)) : 0, [budgetTotal, stats.contractedBudget])
  const availableBudget = budgetTotal - stats.contractedBudget

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

      <EventWeatherCard event={event} />

      <article className="panel budget-overview-card">
        <p className="eyebrow">PRESUPUESTO</p>
        {budgetTotal > 0 ? <>
          <h2>{formatMoney(budgetTotal, event.currency)}</h2>
          <div className="overview-budget-breakdown">
            <span><small>Distribuido</small><strong>{formatMoney(stats.plannedBudget, event.currency)}</strong></span>
            <span><small>Contratado</small><strong>{formatMoney(stats.contractedBudget, event.currency)}</strong></span>
            <span><small>Pagado</small><strong>{formatMoney(stats.paidBudget, event.currency)}</strong></span>
            <span><small>Disponible</small><strong className={availableBudget < 0 ? 'danger-copy' : ''}>{formatMoney(availableBudget, event.currency)}</strong></span>
          </div>
          <div className="progress"><i style={{ width: `${budgetProgress}%` }} /></div>
        </> : <>
          <h2 className="overview-empty-value">Aún no definido</h2>
          <p>Definí el presupuesto total en el módulo Presupuesto.</p>
          <div className="progress"><i style={{ width: '0%' }} /></div>
        </>}
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
