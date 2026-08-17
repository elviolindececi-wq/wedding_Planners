import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'
import EventFormModal from './EventFormModal.jsx'

export default function EventsPage() {
  const { organization } = useOrganization()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const modalOpen = searchParams.get('nuevo') === '1'

  const loadEvents = useCallback(async () => {
    if (!organization?.id) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('events')
      .select('id,event_type,name,event_date,status,city,venue_name,estimated_guests')
      .eq('organization_id', organization.id)
      .neq('status', 'archived')
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (queryError) setError(queryError.message)
    setRows(data || [])
    setLoading(false)
  }, [organization?.id])

  useEffect(() => { loadEvents() }, [loadEvents])

  function closeModal() {
    const next = new URLSearchParams(searchParams)
    next.delete('nuevo')
    setSearchParams(next, { replace: true })
  }

  function handleSaved(saved) {
    closeModal()
    navigate(`/app/eventos/${saved.id}`)
  }

  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">OPERACIÓN</p><h1>Eventos</h1><p>Bodas y quinceaños reales de tu organización.</p></div>
        <button className="primary-btn" onClick={() => setSearchParams({ nuevo: '1' })}>+ Nuevo evento</button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!loading && rows.length === 0 ? (
        <div className="empty-state panel">
          <p className="eyebrow">PRIMER EVENTO</p>
          <h2>Todavía no cargaste ninguna boda o quinceaños.</h2>
          <p>Creá el primer evento y empezamos a reemplazar los datos demo por información real.</p>
          <button className="primary-btn" onClick={() => setSearchParams({ nuevo: '1' })}>Crear mi primer evento</button>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-row events-table-row table-head"><span>Evento</span><span>Tipo</span><span>Fecha</span><span>Estado</span><span>Ciudad / lugar</span></div>
          {loading ? <div className="loading-row">Cargando eventos…</div> : rows.map((event) => (
            <Link className="table-row events-table-row" to={`/app/eventos/${event.id}`} key={event.id}>
              <strong>{event.name}</strong>
              <span>{event.event_type === 'quince' ? 'Quinceaños' : 'Boda'}</span>
              <span>{formatDate(event.event_date)}</span>
              <span>{statusLabel(event.status)}</span>
              <span>{event.city || event.venue_name || '—'}</span>
            </Link>
          ))}
        </div>
      )}

      <EventFormModal open={modalOpen} onClose={closeModal} onSaved={handleSaved} />
    </section>
  )
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function statusLabel(value) {
  return ({ planning: 'En planificación', confirmed: 'Confirmado', completed: 'Finalizado', canceled: 'Cancelado', archived: 'Archivado', lead: 'Lead' })[value] || value || '—'
}
