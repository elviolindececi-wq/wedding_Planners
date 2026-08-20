import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

const CATEGORY_SUGGESTIONS = ['Lugar y alquiler','Banquete y catering','Bebidas','Fotografía y video','Música y sonido','Decoración y flores','Vestuario','Belleza','Papelería','Transporte','Torta y mesa dulce','Souvenirs','Iluminación','Mobiliario','Seguridad','Entretenimiento','Otros']

export default function VendorModal({ open, organizationId, vendor, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(vendor ? {
      category: vendor.category || '', company_name: vendor.company_name || '', contact_name: vendor.contact_name || '',
      phone: vendor.phone || '', email: vendor.email || '', instagram: vendor.instagram || '', website: vendor.website || '',
      address: vendor.address || '', general_notes: vendor.general_notes || '', rating: vendor.rating ? String(vendor.rating) : '',
    } : emptyForm())
  }, [open, vendor])

  if (!open) return null

  async function save(e) {
    e.preventDefault()
    if (!form.company_name.trim()) return setError('Escribí el nombre o empresa del proveedor.')
    setSaving(true); setError('')
    const payload = {
      organization_id: organizationId,
      category: form.category.trim() || null,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      instagram: form.instagram.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      general_notes: form.general_notes.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      updated_at: new Date().toISOString(),
    }
    const query = vendor
      ? supabase.from('vendors').update(payload).eq('id', vendor.id).eq('organization_id', organizationId)
      : supabase.from('vendors').insert({ id: crypto.randomUUID(), ...payload })
    const { error: saveError } = await query
    setSaving(false)
    if (saveError) return setError(saveError.message)
    onSaved?.()
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
    <form className="modal-card vendor-modal" onSubmit={save}>
      <div className="modal-head"><div><p className="eyebrow">DIRECTORIO</p><h2>{vendor ? 'Editar proveedor' : 'Nuevo proveedor'}</h2><p>Estos datos son generales de tu agenda. Precio, moneda y condiciones se guardan por evento.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
      <div className="form-grid-2">
        <label>Empresa / proveedor<input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="Ej. Estudio Luz" /></label>
        <label>Rubro habitual<input list="vendor-category-suggestions" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej. Fotografía y video" /><datalist id="vendor-category-suggestions">{CATEGORY_SUGGESTIONS.map(x => <option key={x} value={x} />)}</datalist></label>
        <label>Persona de contacto<input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></label>
        <label>Teléfono<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Instagram<input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@proveedor" /></label>
        <label>Web<input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></label>
        <label>Dirección<input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
        <label>Valoración<select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })}><option value="">Sin valorar</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
      </div>
      <label>Notas generales<textarea rows="3" value={form.general_notes} onChange={e => setForm({ ...form, general_notes: e.target.value })} placeholder="Fortalezas, condiciones habituales, experiencia previa…" /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar proveedor'}</button></div>
    </form>
  </div>
}

function emptyForm() { return { category:'', company_name:'', contact_name:'', phone:'', email:'', instagram:'', website:'', address:'', general_notes:'', rating:'' } }
