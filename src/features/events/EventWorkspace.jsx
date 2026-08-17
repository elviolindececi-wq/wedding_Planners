import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import EventFormModal from './EventFormModal.jsx'

const tabs = [
  ['', 'Resumen'], ['plan', 'Planificación'], ['presupuesto', 'Presupuesto'], ['proveedores', 'Proveedores'], ['cotizaciones', 'Cotizaciones'], ['pagos', 'Pagos'], ['invitados', 'Invitados'], ['mesas', 'Mesas'], ['diseno', 'Diseño & inspiración'], ['experiencia', 'Experiencia'], ['personas', 'Personas y roles'], ['dia', 'Día del evento'], ['documentos', 'Documentos'], ['notas', 'Notas'],
]

export default function EventWorkspace() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const loadEvent = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
    if (queryError) setError(queryError.message)
    setEvent(data || null)
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadEvent() }, [loadEvent])

  if (loading) return <div className="panel loading-panel">Cargando evento…</div>
  if (error) return <div className="panel"><p className="form-error">{error}</p></div>
  if (!event) return <div className="panel empty-state"><h2>Evento no encontrado</h2><p>Puede haber sido eliminado o no tenés permiso para verlo.</p><button className="secondary-btn" onClick={() => navigate('/app/eventos')}>Volver a eventos</button></div>

  const isQuince = event.event_type === 'quince'

  return (
    <section>
      <div className="event-hero">
        <div>
          <span className="pill">{isQuince ? 'Quinceaños' : 'Boda'}</span>
          <h1>{event.name}</h1>
          <p>{formatLongDate(event.event_date)}{event.city ? ` · ${event.city}` : ''}{event.venue_name ? ` · ${event.venue_name}` : ''}</p>
        </div>
        <button className="secondary-btn" onClick={() => setEditing(true)}>Editar evento</button>
      </div>
      <div className="workspace-tabs">{tabs.map(([path, label]) => <NavLink end={path === ''} key={label} to={path} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}</div>
      <Outlet context={{ event, title: event.name, isQuince, refreshEvent: loadEvent }} />
      <EventFormModal open={editing} event={event} onClose={() => setEditing(false)} onSaved={(saved) => { setEvent(saved); setEditing(false) }} />
    </section>
  )
}

function formatLongDate(value) {
  if (!value) return 'Fecha por definir'
  return new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
