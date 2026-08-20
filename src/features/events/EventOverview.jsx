import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { formatMoney } from '../../lib/money.js'
import EventWeatherCard from '../weather/EventWeatherCard.jsx'
import { paymentEventAmount } from '../../lib/paymentMoney.js'

export default function EventOverview() {
  const { event } = useOutletContext()
  const [stats, setStats] = useState({
    overdueTasks:0, historicalTasks:0, totalTasks:0, doneTasks:0, pendingGuests:0, confirmedGuests:0, declinedGuests:0, invitations:0,
    plannedBudget:0, contractedBudget:0, paidBudget:0,
    overduePayments:0, overduePaymentAmount:0, nextPayments:0, expiringQuotes:0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const today = isoToday()
      const addedDate = String(event.created_at || today).slice(0,10)
      const [tasksResult, guestsResult, categoryResult, budgetResult, paymentsResult, quoteResult] = await Promise.all([
        supabase.from('tasks').select('status,due_date,template_key').eq('event_id', event.id),
        supabase.from('guests').select('invitation_status,party_size').eq('event_id', event.id),
        supabase.from('budget_categories').select('planned_amount').eq('event_id', event.id),
        supabase.from('budget_items').select('contracted_amount').eq('event_id', event.id),
        supabase.from('vendor_payments').select('amount,currency,exchange_rate,event_amount,status,due_date').eq('event_id', event.id),
        supabase.from('quotes').select('valid_until,is_selected').eq('event_id', event.id),
      ])
      if (!active) return
      const tasks = tasksResult.data || []
      const guests = guestsResult.data || []
      const categories = categoryResult.data || []
      const budget = budgetResult.data || []
      const payments = paymentsResult.data || []
      const quotes = quoteResult.data || []
      const activeTasks = tasks.filter(task => !['done','canceled'].includes(task.status))
      const historical = activeTasks.filter(task => task.template_key && task.due_date && task.due_date < addedDate)
      const historicalKeys = new Set(historical.map(task => `${task.template_key}:${task.due_date}`))
      const realOverdue = activeTasks.filter(task => task.due_date && task.due_date < today && !historicalKeys.has(`${task.template_key}:${task.due_date}`))
      const openPayments = payments.filter(row => !['paid','canceled'].includes(row.status))
      const overduePayments = openPayments.filter(row => row.due_date && row.due_date < today)
      const nextPayments = openPayments.filter(row => row.due_date && row.due_date >= today && daysBetween(today,row.due_date) <= 7)
      const expiringQuotes = quotes.filter(row => !row.is_selected && row.valid_until && row.valid_until >= today && daysBetween(today,row.valid_until) <= 15)
      setStats({
        overdueTasks:realOverdue.length,
        historicalTasks:historical.length,
        totalTasks:tasks.filter(task => task.status !== 'canceled').length,
        doneTasks:tasks.filter(task => task.status === 'done').length,
        pendingGuests:guestPeople(guests.filter(guest => guest.invitation_status === 'pending')),
        confirmedGuests:guestPeople(guests.filter(guest => guest.invitation_status === 'confirmed')),
        declinedGuests:guestPeople(guests.filter(guest => guest.invitation_status === 'declined')),
        invitations:guests.length,
        plannedBudget:categories.reduce((sum,row) => sum + Number(row.planned_amount || 0),0),
        contractedBudget:budget.reduce((sum,item) => sum + Number(item.contracted_amount || 0),0),
        paidBudget:payments.filter(row => row.status === 'paid').reduce((sum,row) => sum + paymentEventAmount(row,event.currency),0),
        overduePayments:overduePayments.length,
        overduePaymentAmount:overduePayments.reduce((sum,row) => sum + paymentEventAmount(row,event.currency),0),
        nextPayments:nextPayments.length,
        expiringQuotes:expiringQuotes.length,
      })
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [event.id, event.budget_total, event.currency, event.created_at])

  const progress = useMemo(() => stats.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0, [stats.doneTasks, stats.totalTasks])
  const budgetTotal = Number(event.budget_total || 0)
  const budgetProgress = useMemo(() => budgetTotal > 0 ? Math.min(100, Math.round((stats.contractedBudget / budgetTotal) * 100)) : 0, [budgetTotal, stats.contractedBudget])
  const availableBudget = budgetTotal - stats.contractedBudget

  if (loading) return <div className="panel loading-panel">Cargando resumen…</div>

  return <div className="detail-grid">
    <article className="panel span-2 overview-attention-panel">
      <div className="overview-section-head"><div><p className="eyebrow">HOY</p><h2>Qué necesita tu atención</h2><p>El sistema separa lo realmente vencido de las etapas históricas que solo necesitan revisión.</p></div></div>
      <div className="overview-action-grid">
        <AttentionCard tone={stats.overdueTasks ? 'danger' : 'ok'} title={`${stats.overdueTasks} tareas vencidas`} detail={stats.overdueTasks ? 'Vencieron después de que cargaste este evento.' : 'Sin tareas realmente vencidas.'} to="plan" />
        <AttentionCard tone={stats.historicalTasks ? 'review' : 'ok'} title={`${stats.historicalTasks} de etapas anteriores`} detail={stats.historicalTasks ? 'Revisalas o marcá etapas ya resueltas.' : 'No hay etapas anteriores pendientes.'} to="plan" />
        <AttentionCard tone={stats.overduePayments ? 'danger' : stats.nextPayments ? 'review' : 'ok'} title={stats.overduePayments ? `${stats.overduePayments} pagos vencidos` : `${stats.nextPayments} pagos próximos`} detail={stats.overduePayments ? `${formatMoney(stats.overduePaymentAmount,event.currency)} vencidos` : stats.nextPayments ? 'Vencen en los próximos 7 días.' : 'Sin vencimientos inmediatos.'} to="pagos" />
        <AttentionCard tone={stats.expiringQuotes ? 'review' : 'ok'} title={`${stats.expiringQuotes} cotizaciones por vencer`} detail={stats.expiringQuotes ? 'Vencen dentro de 15 días y todavía no fueron seleccionadas.' : 'Sin cotizaciones próximas a vencer.'} to="proveedores?seccion=cotizaciones" />
      </div>
    </article>

    <EventWeatherCard event={event} />

    <article className="panel budget-overview-card">
      <p className="eyebrow">PRESUPUESTO</p>
      {budgetTotal > 0 ? <>
        <h2>{formatMoney(budgetTotal, event.currency)}</h2>
        <div className="overview-budget-breakdown">
          <span><small>Distribuido</small><strong>{formatMoney(stats.plannedBudget,event.currency)}</strong></span>
          <span><small>Contratado</small><strong>{formatMoney(stats.contractedBudget,event.currency)}</strong></span>
          <span><small>Pagado</small><strong>{formatMoney(stats.paidBudget,event.currency)}</strong></span>
          <span><small>Disponible</small><strong className={availableBudget < 0 ? 'danger-copy' : ''}>{formatMoney(availableBudget,event.currency)}</strong></span>
        </div>
        <div className="progress"><i style={{ width:`${budgetProgress}%` }} /></div>
      </> : <><h2 className="overview-empty-value">Aún no definido</h2><p>Definí el presupuesto total en el módulo Presupuesto.</p><div className="progress"><i style={{ width:'0%' }} /></div></>}
    </article>

    <article className="panel">
      <p className="eyebrow">PLANIFICACIÓN</p>
      <h2>{progress}%</h2>
      <p>{stats.doneTasks} de {stats.totalTasks} tareas listas</p>
      <div className="progress"><i style={{ width:`${progress}%` }} /></div>
    </article>

    <article className="panel">
      <p className="eyebrow">INVITADOS</p>
      <h2>{event.estimated_guests ?? '—'} previstos</h2>
      <p>{stats.confirmedGuests} confirmados · {stats.pendingGuests} pendientes{stats.declinedGuests ? ` · ${stats.declinedGuests} no van` : ''}</p>
      <Link className="overview-inline-link" to="invitados">Gestionar {stats.invitations} invitaciones →</Link>
    </article>
  </div>
}

function AttentionCard({ tone='ok', title, detail, to }) { return <Link className={`overview-action-card tone-${tone}`} to={to}><strong>{title}</strong><span>{detail}</span><small>Ver detalle →</small></Link> }
function isoToday(){ return new Date().toISOString().slice(0,10) }
function daysBetween(a,b){ return Math.ceil((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`))/86400000) }

function guestPeople(rows){ return rows.reduce((sum,row) => sum + Math.max(1,Number(row.party_size || 1)),0) }
