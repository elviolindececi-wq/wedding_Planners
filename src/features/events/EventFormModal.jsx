import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'
import { getPlanningTemplate } from '../planning/planningTemplates.js'
import { CURRENCIES } from '../../lib/currencies.js'

const EMPTY_FORM = {
  event_type: 'wedding',
  partner_1: '',
  partner_2: '',
  honoree_name: '',
  event_date: '',
  event_time: '',
  venue_name: '',
  city: '',
  country: 'Paraguay',
  estimated_guests: '',
  currency: 'USD',
  status: 'planning',
  notes: '',
}

export default function EventFormModal({ open, event = null, onClose, onSaved }) {
  const { organization } = useOrganization()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(event?.id)

  useEffect(() => {
    if (!open) return
    if (event) {
      setForm({
        event_type: event.event_type || 'wedding',
        partner_1: event.partner_1 || '',
        partner_2: event.partner_2 || '',
        honoree_name: event.honoree_name || '',
        event_date: event.event_date || '',
        event_time: event.event_time ? String(event.event_time).slice(0, 5) : '',
        venue_name: event.venue_name || '',
        city: event.city || '',
        country: event.country || 'Paraguay',
        estimated_guests: event.estimated_guests ?? '',
        currency: event.currency || 'USD',
        status: event.status || 'planning',
        notes: event.notes || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setError('')
  }, [open, event])

  const generatedName = useMemo(() => {
    if (form.event_type === 'quince') return form.honoree_name.trim()
    return [form.partner_1.trim(), form.partner_2.trim()].filter(Boolean).join(' & ')
  }, [form.event_type, form.partner_1, form.partner_2, form.honoree_name])

  if (!open) return null

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!organization?.id) return
    if (!generatedName) {
      setError(form.event_type === 'quince' ? 'Ingresá el nombre de la quinceañera.' : 'Ingresá al menos un nombre para la pareja.')
      return
    }

    setSubmitting(true)
    setError('')

    const payload = {
      organization_id: organization.id,
      event_type: form.event_type,
      name: generatedName,
      partner_1: form.event_type === 'wedding' ? form.partner_1.trim() || null : null,
      partner_2: form.event_type === 'wedding' ? form.partner_2.trim() || null : null,
      honoree_name: form.event_type === 'quince' ? form.honoree_name.trim() || null : null,
      event_date: form.event_date || null,
      event_time: form.event_time || null,
      venue_name: form.venue_name.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      estimated_guests: form.estimated_guests === '' ? null : Number(form.estimated_guests),
      currency: form.currency,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const eventDateChanged = editing && event?.event_date !== payload.event_date
    const recalculateSuggestedDates = eventDateChanged && payload.event_date
      ? window.confirm(
          'Cambiaste la fecha del evento. ¿Querés recalcular las fechas sugeridas de la planificación?\n\nAceptar: recalcula solo fechas automáticas.\nCancelar: conserva todas las fechas actuales.\n\nLas fechas que la planner personalizó nunca se modificarán automáticamente.'
        )
      : false

    let result
    let savedEvent

    if (editing) {
      result = await supabase.from('events').update(payload).eq('id', event.id)
      savedEvent = { ...event, ...payload, id: event.id }
    } else {
      // Evitamos INSERT ... RETURNING para que la creación dependa únicamente
      // de la policy de INSERT. El id se genera en el cliente y luego se usa
      // para abrir/refrescar el evento por su UUID real.
      const id = crypto.randomUUID()
      const insertPayload = { id, ...payload }
      result = await supabase.from('events').insert(insertPayload)
      savedEvent = insertPayload
    }

    if (result.error) {
      setError(result.error.message)
      setSubmitting(false)
      return
    }

    if (editing && recalculateSuggestedDates) {
      const { error: recalcError } = await supabase.rpc('recalculate_event_task_dates', {
        p_event_id: event.id,
        p_event_date: payload.event_date,
      })

      if (recalcError) {
        setError(`El evento se guardó, pero no se pudieron recalcular las fechas sugeridas: ${recalcError.message}`)
        setSubmitting(false)
        return
      }
    }

    // Los eventos nuevos nacen con su checklist de planificación cargado.
    // Así la planner no tiene que acordarse de activar el template después.
    if (!editing) {
      const template = getPlanningTemplate(savedEvent)
      const { error: tasksError } = await supabase.from('tasks').insert(template)

      if (tasksError) {
        // Evitamos dejar un evento a medias si falló la carga inicial de tareas.
        await supabase.from('events').delete().eq('id', savedEvent.id)
        setError(`No se pudo cargar el checklist inicial: ${tasksError.message}`)
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    onSaved?.(savedEvent)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{editing ? 'EDITAR EVENTO' : 'NUEVO EVENTO'}</p>
            <h2 id="event-form-title">{editing ? generatedName || 'Evento' : 'Crear boda o quinceaños'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <form className="event-form" onSubmit={handleSubmit}>
          <label>Tipo de evento
            <select value={form.event_type} onChange={(e) => change('event_type', e.target.value)}>
              <option value="wedding">Boda</option>
              <option value="quince">Quinceaños</option>
            </select>
          </label>

          {form.event_type === 'wedding' ? (
            <div className="form-grid-2">
              <label>Nombre 1<input value={form.partner_1} onChange={(e) => change('partner_1', e.target.value)} placeholder="Ana" /></label>
              <label>Nombre 2<input value={form.partner_2} onChange={(e) => change('partner_2', e.target.value)} placeholder="Mateo" /></label>
            </div>
          ) : (
            <label>Nombre de la quinceañera<input value={form.honoree_name} onChange={(e) => change('honoree_name', e.target.value)} placeholder="Valentina" /></label>
          )}

          <div className="form-grid-2">
            <label>Fecha<input type="date" value={form.event_date} onChange={(e) => change('event_date', e.target.value)} /></label>
            <label>Hora<input type="time" value={form.event_time} onChange={(e) => change('event_time', e.target.value)} /></label>
          </div>

          <div className="form-grid-3">
            <label>Lugar<input value={form.venue_name} onChange={(e) => change('venue_name', e.target.value)} placeholder="Salón / venue" /></label>
            <label>Ciudad<input value={form.city} onChange={(e) => change('city', e.target.value)} placeholder="Asunción" /></label>
            <label>País<input value={form.country} onChange={(e) => change('country', e.target.value)} placeholder="Paraguay" /></label>
          </div>

          <div className="form-grid-3">
            <label>Invitados estimados<input type="number" min="0" value={form.estimated_guests} onChange={(e) => change('estimated_guests', e.target.value)} /></label>
            <label>Moneda
              <select value={form.currency} onChange={(e) => change('currency', e.target.value)}>
                {CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}
              </select>
            </label>
            <label>Estado
              <select value={form.status} onChange={(e) => change('status', e.target.value)}>
                <option value="planning">En planificación</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Finalizado</option>
                <option value="canceled">Cancelado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
          </div>

          <label>Notas<textarea rows="3" value={form.notes} onChange={(e) => change('notes', e.target.value)} placeholder="Datos generales que conviene tener a mano…" /></label>

          {generatedName && <p className="form-preview">Se guardará como <strong>{generatedName}</strong>.</p>}
          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button>
            <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
