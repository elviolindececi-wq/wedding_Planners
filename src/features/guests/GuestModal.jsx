import { useEffect, useMemo, useState } from 'react'

const CONFIRMATIONS = [['pending','Pendiente'],['confirmed','Confirmado'],['declined','No va']]
const RESTRICTIONS = ['Ninguna','Vegetariano','Vegano','Sin gluten','Sin lactosa','Kosher','Halal','Alergia (detallar)','Otra']
const RELATIONSHIPS = ['Familia directa','Familia','Amigos','Trabajo','Colegio','Niños','Otro']

export default function GuestModal({ open, guest, tableId, tables, event, recommendTable, onClose, onSave }) {
  const empty = useMemo(() => ({
    full_name:'', phone:'', email:'', party_size:1,
    side_label:event?.event_type === 'quince' ? 'Familia quinceañera' : 'Ambos',
    relationship:'Amigos', invitation_status:'pending', meal_preference:'Ninguna',
    dietary_notes:'', notes:'', table_id:'',
  }), [event?.event_type])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSaving(false); setError('')
    setForm(guest ? {
      full_name:guest.full_name || '', phone:guest.phone || '', email:guest.email || '',
      party_size:Math.max(1, Number(guest.party_size || 1)), side_label:guest.side_label || empty.side_label,
      relationship:guest.relationship || 'Amigos', invitation_status:guest.invitation_status || 'pending',
      meal_preference:guest.meal_preference || 'Ninguna', dietary_notes:guest.dietary_notes || '',
      notes:guest.notes || '', table_id:tableId || '',
    } : empty)
  }, [open, guest, tableId, empty])

  if (!open) return null
  const sideOptions = event?.event_type === 'quince'
    ? ['Familia quinceañera','Amigos','Colegio','Trabajo','Otro']
    : ['Novia','Novio','Ambos','Amigos','Trabajo','Otro']

  const protocolRecommendation = recommendTable?.(form, guest?.id || '') || null
  const needsDietaryDetail = form.meal_preference === 'Alergia (detallar)' || form.meal_preference === 'Otra'

  async function submit(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return setError('Escribí el nombre de la invitación.')
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        full_name:form.full_name.trim(),
        phone:form.phone.trim() || null,
        email:form.email.trim() || null,
        party_size:Math.max(1, Number(form.party_size || 1)),
        side_label:form.side_label.trim() || null,
        relationship:form.relationship.trim() || null,
        meal_preference:form.meal_preference.trim() || 'Ninguna',
        dietary_notes:form.dietary_notes.trim() || null,
        notes:form.notes.trim() || null,
        table_id:form.invitation_status === 'declined' ? '' : form.table_id,
      })
    } catch (err) {
      setError(err.message || 'No se pudo guardar la invitación.')
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal-card guest-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head">
        <div><p className="eyebrow">INVITADOS</p><h2>{guest ? 'Editar invitación' : 'Nueva invitación'}</h2><p>Una invitación puede representar a una persona, pareja o grupo familiar.</p></div>
        <button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      </div>
      <form className="event-form" onSubmit={submit}>
        <section className="guest-form-section">
          <div className="guest-form-section-title"><strong>Invitación</strong><span>Datos principales y contacto</span></div>
          <label>Nombre / invitación *<input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} placeholder="Ej. Familia Gómez" autoFocus /></label>
          <div className="form-grid-3">
            <label>Personas<input type="number" min="1" value={form.party_size} onChange={e => setForm({...form,party_size:e.target.value})} /></label>
            <label>Teléfono<input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+595..." /></label>
            <label>Email<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="correo@..." /></label>
          </div>
        </section>
        <section className="guest-form-section">
          <div className="guest-form-section-title"><strong>Clasificación</strong><span>Para filtrar, confirmar y organizar mesas</span></div>
          <div className="form-grid-2">
            <label>Lado / grupo<input list="guest-side-options" value={form.side_label} onChange={e => setForm({...form,side_label:e.target.value})} placeholder="Ej. Novia, Amigos..."/><datalist id="guest-side-options">{sideOptions.map(value => <option key={value} value={value}/>)}</datalist></label>
            <label>Parentesco / relación<input list="guest-relationship-options" value={form.relationship} onChange={e => setForm({...form,relationship:e.target.value})}/><datalist id="guest-relationship-options">{RELATIONSHIPS.map(value => <option key={value} value={value}/>)}</datalist></label>
          </div>
          <div className="form-grid-2">
            <label>Confirmación<select value={form.invitation_status} onChange={e => setForm({...form,invitation_status:e.target.value})}>{CONFIRMATIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Mesa<select value={form.table_id} disabled={form.invitation_status === 'declined'} onChange={e => setForm({...form,table_id:e.target.value})}><option value="">Sin mesa</option>{tables.map(table => <option key={table.id} value={table.id}>{table.name} · {table.capacity} lugares</option>)}</select>{form.invitation_status !== 'declined' && protocolRecommendation && <span className="guest-protocol-helper">{protocolRecommendation.table ? <>✨ Protocolo recomienda <strong>{protocolRecommendation.table.name}</strong>: {protocolRecommendation.reason} <button type="button" onClick={() => setForm({...form,table_id:protocolRecommendation.table.id})}>Usar recomendada</button></> : <>✨ {protocolRecommendation.reason}</>}</span>}</label>
          </div>
        </section>
        <section className="guest-form-section">
          <div className="guest-form-section-title"><strong>Alimentación y notas</strong><span>Información operativa para catering y coordinación</span></div>
          <div className="form-grid-2">
            <label>Restricción / preferencia<select value={form.meal_preference} onChange={e => setForm({...form,meal_preference:e.target.value})}>{RESTRICTIONS.map(value => <option key={value} value={value}>{value}</option>)}</select><span className="field-help">Elegí una opción para mantener el reporte de catering consistente.</span></label>
            <label>Notas alimentarias<input value={form.dietary_notes} onChange={e => setForm({...form,dietary_notes:e.target.value})} placeholder={needsDietaryDetail ? 'Detallá la alergia o necesidad especial *' : 'Ej. una persona sin lactosa'} required={needsDietaryDetail} /><span className="field-help">{needsDietaryDetail ? 'Este detalle es obligatorio para Alergia u Otra.' : 'Opcional. Útil cuando solo una persona del grupo tiene la restricción.'}</span></label>
          </div>
          <label>Notas<textarea rows="3" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Observaciones, acompañantes, necesidades especiales..." /></label>
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : guest ? 'Guardar cambios' : 'Agregar invitación'}</button></div>
      </form>
    </div>
  </div>
}
