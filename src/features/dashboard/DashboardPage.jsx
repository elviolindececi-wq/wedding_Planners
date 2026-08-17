import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'

export default function DashboardPage() {
  const { organization } = useOrganization()
  const [data, setData] = useState({ events: [], opportunities: [], tasks: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!organization?.id) return
    setLoading(true)
    setError('')
    const today = new Date().toISOString().slice(0, 10)
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const [eventsResult, opportunitiesResult] = await Promise.all([
      supabase.from('events').select('id,event_type,name,event_date,status,city').eq('organization_id', organization.id).in('status', ['planning', 'confirmed']).order('event_date', { ascending: true, nullsFirst: false }),
      supabase.from('crm_opportunities').select('id,stage,potential_value,currency,next_followup_at').eq('organization_id', organization.id).not('stage', 'in', '(won,lost)'),
    ])
    const eventIds = (eventsResult.data || []).map((event) => event.id)
    const tasksResult = eventIds.length
      ? await supabase.from('tasks').select('id,event_id,title,due_date,status').in('event_id', eventIds).gte('due_date', today).lte('due_date', inSevenDays).in('status', ['pending', 'in_progress', 'blocked'])
      : { data: [], error: null }
    const firstError = eventsResult.error || opportunitiesResult.error || tasksResult.error
    if (firstError) setError(firstError.message)
    setData({ events: eventsResult.data || [], opportunities: opportunitiesResult.data || [], tasks: tasksResult.data || [] })
    setLoading(false)
  }, [organization?.id])

  useEffect(() => { load() }, [load])

  const metrics = useMemo(() => {
    const activeLeads = data.opportunities.length
    const activeEvents = data.events.length
    const weddings = data.events.filter((event) => event.event_type === 'wedding').length
    const quinces = data.events.filter((event) => event.event_type === 'quince').length
    const usdPipeline = data.opportunities.filter((item) => (item.currency || 'USD') === 'USD').reduce((sum, item) => sum + Number(item.potential_value || 0), 0)
    return { activeLeads, activeEvents, weddings, quinces, usdPipeline, tasksThisWeek: data.tasks.length }
  }, [data])

  const upcoming = data.events.filter((event) => !event.event_date || event.event_date >= new Date().toISOString().slice(0, 10)).slice(0, 3)

  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">HOY</p><h1>Tu operación, en un solo lugar</h1><p>Negocio, clientas y eventos sin mezclar información.</p></div>
        <Link className="primary-btn" to="/app/eventos?nuevo=1">+ Nuevo evento</Link>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="metrics-grid">
        <article className="metric"><span>Leads activos</span><strong>{loading ? '…' : metrics.activeLeads}</strong><small>Oportunidades abiertas del CRM</small></article>
        <article className="metric"><span>Eventos activos</span><strong>{loading ? '…' : metrics.activeEvents}</strong><small>{metrics.weddings} bodas · {metrics.quinces} quinceaños</small></article>
        <article className="metric"><span>Pipeline USD</span><strong>{loading ? '…' : formatUsd(metrics.usdPipeline)}</strong><small>Valor potencial de oportunidades abiertas</small></article>
        <article className="metric"><span>Tareas próximos 7 días</span><strong>{loading ? '…' : metrics.tasksThisWeek}</strong><small>Entre todos tus eventos</small></article>
      </div>

      <div className="section-title"><div><p className="eyebrow">OPERACIÓN</p><h2>Próximos eventos</h2></div><Link to="/app/eventos">Ver todos</Link></div>
      {!loading && upcoming.length === 0 ? (
        <div className="panel empty-state compact-empty"><h3>Tu agenda todavía está vacía.</h3><p>Creá el primer evento para empezar a construir tu operación real.</p><Link className="primary-btn" to="/app/eventos?nuevo=1">Crear evento</Link></div>
      ) : (
        <div className="cards-grid">
          {upcoming.map((event) => (
            <Link className="event-card" to={`/app/eventos/${event.id}`} key={event.id}>
              <div className="event-card-top"><span className="pill">{event.event_type === 'quince' ? 'Quinceaños' : 'Boda'}</span><strong>{formatCardDate(event.event_date)}</strong></div>
              <h3>{event.name}</h3>
              <p>{event.status === 'confirmed' ? 'Evento confirmado' : 'En planificación'}</p>
              <small>{event.city || 'Ciudad por definir'}</small>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function formatUsd(value) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)
}

function formatCardDate(value) {
  if (!value) return 'SIN FECHA'
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)).toUpperCase()
}
