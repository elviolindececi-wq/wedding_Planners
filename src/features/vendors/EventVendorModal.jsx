import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { CURRENCIES } from '../../lib/currencies.js'
import MoneyInput from '../../components/MoneyInput.jsx'
import { fetchExchangeRate, formatExchangeRate } from '../../lib/exchangeRates.js'
import { formatMoney } from '../../lib/money.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'

export default function EventVendorModal({ open, event, vendors, categories, assignment, onClose, onSaved }) {
  const { organization } = useOrganization()
  const [form, setForm] = useState(emptyForm(event?.currency))
  const [newCategory, setNewCategory] = useState('')
  const [providerMode, setProviderMode] = useState('existing')
  const [editContact, setEditContact] = useState(false)
  const [contact, setContact] = useState(emptyContact())
  const [loadingRate, setLoadingRate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const vendor = useMemo(() => vendors.find(v => v.id === form.vendor_id), [vendors, form.vendor_id])
  const equivalent = Number(form.contracted_amount || form.quoted_amount || 0) * Number(form.exchange_rate || 1)
  const currenciesDiffer = form.currency !== event.currency
  const invalidRate = currenciesDiffer && (!(Number(form.exchange_rate) > 0) || Number(form.exchange_rate) === 1)

  useEffect(() => {
    if (!open) return
    setError(''); setNewCategory(''); setEditContact(false)
    if (assignment) {
      setProviderMode('existing')
      setForm({
        vendor_id:assignment.vendor_id || '', budget_category_id:assignment.budget_category_id || '', service_category:assignment.service_category || '',
        status:assignment.status || 'considering', quoted_amount:amountValue(assignment.quoted_amount), contracted_amount:amountValue(assignment.contracted_amount),
        currency:assignment.currency || event.currency || 'USD', exchange_rate:amountValue(assignment.exchange_rate || 1), exchange_rate_source:assignment.exchange_rate_source || '',
        exchange_rate_date:assignment.exchange_rate_date || '', contract_date:assignment.contract_date || '', has_contract:Boolean(assignment.has_contract), contract_url:assignment.contract_url || '', notes:assignment.notes || '',
      })
    } else {
      setProviderMode('existing')
      setForm(emptyForm(event?.currency))
      setContact(emptyContact())
    }
  }, [open, assignment, event?.currency])

  useEffect(() => {
    if (!open || !vendor) return
    setContact(contactFromVendor(vendor))
    if (!assignment) setForm(current => ({ ...current, service_category:current.service_category || vendor.category || '' }))
  }, [vendor, open, assignment])

  if (!open) return null

  async function useAutomaticRate() {
    if (form.currency === event.currency) return setForm(f => ({ ...f, exchange_rate:'1', exchange_rate_source:'Misma moneda', exchange_rate_date:new Date().toISOString().slice(0,10) }))
    setLoadingRate(true); setError('')
    try {
      const data = await fetchExchangeRate(form.currency, event.currency)
      setForm(f => ({ ...f, exchange_rate:String(data.rate), exchange_rate_source:data.source, exchange_rate_date:data.date }))
    } catch (e) { setError(e.message) }
    setLoadingRate(false)
  }

  async function resolveCategory() {
    if (form.budget_category_id !== '__new__') return form.budget_category_id || null
    const name = newCategory.trim()
    if (!name) throw new Error('Escribí el nombre de la nueva categoría.')
    const existing = categories.find(c => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const id = crypto.randomUUID()
    const { error: insertError } = await supabase.from('budget_categories').insert({ id, event_id:event.id, name, planned_amount:0, cost_type:'mixed', sort_order:categories.length })
    if (insertError) throw insertError
    return id
  }

  async function resolveVendor() {
    if (providerMode === 'new') {
      if (!contact.company_name.trim()) throw new Error('Escribí el nombre de la empresa o proveedor.')
      const id = crypto.randomUUID()
      const payload = vendorPayload(contact)
      const { error: insertError } = await supabase.from('vendors').insert({ id, organization_id:organization.id, ...payload })
      if (insertError) throw insertError
      return { id, ...payload }
    }
    if (!form.vendor_id) throw new Error('Elegí un proveedor del directorio o creá uno nuevo.')
    if (editContact) {
      const { error: updateError } = await supabase.from('vendors').update(vendorPayload(contact)).eq('id', form.vendor_id).eq('organization_id', organization.id)
      if (updateError) throw updateError
    }
    return vendor
  }

  async function save(e) {
    e.preventDefault()
    if (!form.budget_category_id) return setError('Elegí una categoría de presupuesto o creá una nueva.')
    if (invalidRate) return setError(`El tipo de cambio no puede ser 1 cuando ${form.currency} y ${event.currency} son monedas distintas. Usá cambio automático o ingresá un valor manual.`)
    setSaving(true); setError('')
    try {
      const resolvedVendor = await resolveVendor()
      const categoryId = await resolveCategory()
      const categoryName = categories.find(c => c.id === categoryId)?.name || newCategory.trim() || form.service_category.trim() || resolvedVendor?.category || 'Otros'
      const id = assignment?.id || crypto.randomUUID()
      const contractedAllowed = ['selected','contracted','completed'].includes(form.status)
      const payload = {
        event_id:event.id, vendor_id:resolvedVendor.id, budget_category_id:categoryId, service_category:categoryName,
        status:form.status, quoted_amount:nullableAmount(form.quoted_amount), contracted_amount:contractedAllowed ? nullableAmount(form.contracted_amount) : null, currency:form.currency,
        exchange_rate:form.currency === event.currency ? 1 : nullableAmount(form.exchange_rate), exchange_rate_source:form.currency === event.currency ? 'Misma moneda' : (form.exchange_rate_source.trim() || 'Manual'),
        exchange_rate_date:form.currency === event.currency ? new Date().toISOString().slice(0,10) : (form.exchange_rate_date || new Date().toISOString().slice(0,10)),
        contract_date:form.contract_date || null, has_contract:Boolean(form.has_contract), contract_url:form.contract_url.trim() || null, notes:form.notes.trim() || null, updated_at:new Date().toISOString(),
      }
      const query = assignment ? supabase.from('event_vendors').update(payload).eq('id', id).eq('event_id', event.id) : supabase.from('event_vendors').insert({ id, ...payload })
      const { error: saveError } = await query
      if (saveError) throw saveError
      const { error: syncError } = await supabase.rpc('sync_event_vendor_to_budget', { p_event_vendor_id:id })
      if (syncError) throw syncError
      onSaved?.()
    } catch (e2) { setError(friendlyError(e2.message)) }
    setSaving(false)
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}><form className="modal-card event-vendor-modal ux-vendor-modal" onSubmit={save}>
    <div className="modal-head"><div><p className="eyebrow">PROVEEDOR DEL EVENTO</p><h2>{assignment ? 'Proveedor y contratación' : 'Agregar proveedor'}</h2><p>Contacto, cotización, contrato y presupuesto en un solo flujo. Los datos de contacto quedan reutilizables para otros eventos.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>

    {!assignment && <div className="provider-mode-switch" role="tablist" aria-label="Cómo agregar proveedor">
      <button type="button" className={providerMode === 'existing' ? 'active' : ''} onClick={() => setProviderMode('existing')}>Elegir de mi directorio</button>
      <button type="button" className={providerMode === 'new' ? 'active' : ''} onClick={() => { setProviderMode('new'); setForm(f => ({ ...f, vendor_id:'' })); setContact(emptyContact()) }}>Crear proveedor nuevo</button>
    </div>}

    <section className="vendor-form-section">
      <div className="vendor-form-section-head"><div><p className="eyebrow">CONTACTO</p><h3>Quién es el proveedor</h3></div>{providerMode === 'existing' && vendor && <button type="button" className="text-action" onClick={() => setEditContact(v => !v)}>{editContact ? 'Cancelar edición' : 'Editar contacto'}</button>}</div>
      {providerMode === 'existing' && !assignment && <label>Proveedor del directorio<select value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id:e.target.value })}><option value="">Buscar / elegir proveedor…</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}{v.category ? ` · ${v.category}` : ''}</option>)}</select></label>}
      {providerMode === 'existing' && assignment && <div className="vendor-contact-summary"><strong>{vendor?.company_name || 'Proveedor'}</strong><span>{vendor?.category || 'Sin rubro general'}</span></div>}
      {providerMode === 'existing' && vendor && !editContact ? <div className="vendor-contact-grid">
        <Info label="Contacto" value={vendor.contact_name} />
        <Info label="Teléfono" value={vendor.phone} />
        <Info label="Email" value={vendor.email} />
        <Info label="Instagram" value={vendor.instagram} />
        <Info label="Web" value={vendor.website} />
        <Info label="Dirección" value={vendor.address} />
      </div> : (providerMode === 'new' || editContact) ? <div className="form-grid-2 contact-edit-grid">
        <label>Empresa / proveedor<input value={contact.company_name} disabled={Boolean(assignment)} onChange={e => setContact({ ...contact, company_name:e.target.value })} placeholder="Ej. Estudio Luz" /></label>
        <label>Rubro habitual<input value={contact.category} onChange={e => setContact({ ...contact, category:e.target.value })} placeholder="Ej. Fotografía y video" /></label>
        <label>Persona de contacto<input value={contact.contact_name} onChange={e => setContact({ ...contact, contact_name:e.target.value })} placeholder="Nombre y apellido" /></label>
        <label>Teléfono<input value={contact.phone} onChange={e => setContact({ ...contact, phone:e.target.value })} placeholder="+595…" /></label>
        <label>Email<input type="email" value={contact.email} onChange={e => setContact({ ...contact, email:e.target.value })} placeholder="hola@proveedor.com" /></label>
        <label>Instagram<input value={contact.instagram} onChange={e => setContact({ ...contact, instagram:e.target.value })} placeholder="@proveedor" /></label>
        <label>Web<input value={contact.website} onChange={e => setContact({ ...contact, website:e.target.value })} placeholder="https://…" /></label>
        <label>Dirección<input value={contact.address} onChange={e => setContact({ ...contact, address:e.target.value })} placeholder="Dirección o zona" /></label>
      </div> : <p className="form-help">Elegí un proveedor para ver sus datos de contacto.</p>}
    </section>

    <section className="vendor-form-section">
      <div className="vendor-form-section-head"><div><p className="eyebrow">EN {event.name.toUpperCase()}</p><h3>Servicio y presupuesto</h3></div></div>
      <div className="form-grid-2">
        <label>Categoría de presupuesto<select value={form.budget_category_id} onChange={e => setForm({ ...form, budget_category_id:e.target.value })}><option value="">Elegir categoría…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new__">+ Nueva categoría…</option></select></label>
        <label>Estado del proveedor<select value={form.status} onChange={e => { const next=e.target.value; const allows=['selected','contracted','completed'].includes(next); setForm({ ...form, status:next, contracted_amount:allows ? (form.contracted_amount || form.quoted_amount) : '' }) }}><option value="considering">Evaluando</option><option value="quoted">Cotizado</option><option value="selected">Reservado / seleccionado</option><option value="contracted">Contratado</option><option value="completed">Servicio finalizado</option><option value="declined">Descartado</option></select></label>
        {form.budget_category_id === '__new__' && <label className="span-2">Nombre de la nueva categoría<input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ej. Fuegos artificiales" /></label>}
        <label>Moneda del proveedor<select value={form.currency} onChange={e => setForm({ ...form, currency:e.target.value, exchange_rate:e.target.value === event.currency ? '1' : '', exchange_rate_source:'', exchange_rate_date:'' })}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></label>
        <div className="form-context-card"><span>Moneda base del evento</span><strong>{event.currency}</strong><small>Presupuesto y resumen se consolidan en esta moneda.</small></div>
        <label>Precio cotizado<MoneyInput currency={form.currency} value={form.quoted_amount} onChange={value => setForm({ ...form, quoted_amount:value })}/></label>
        <label>Precio contratado<MoneyInput currency={form.currency} value={form.contracted_amount} disabled={!['selected','contracted','completed'].includes(form.status)} onChange={value => setForm({ ...form, contracted_amount:value })}/><small>{['selected','contracted','completed'].includes(form.status) ? 'Se refleja como Contratado en Presupuesto.' : 'Se habilita recién al reservar o contratar.'}</small></label>
        {currenciesDiffer && <><label>Tipo de cambio<input type="number" min="0.00000001" step="any" value={form.exchange_rate} onChange={e => setForm({ ...form, exchange_rate:e.target.value, exchange_rate_source:'Manual', exchange_rate_date:new Date().toISOString().slice(0,10) })}/><small>{form.exchange_rate ? formatExchangeRate(form.exchange_rate, form.currency, event.currency) : `1 ${form.currency} = ? ${event.currency}`}</small></label><div className={`rate-helper ${invalidRate ? 'rate-helper-warning' : ''}`}><button type="button" className="secondary-btn" onClick={useAutomaticRate} disabled={loadingRate}>{loadingRate ? 'Consultando…' : 'Usar cambio automático'}</button>{invalidRate ? <small>Necesitamos un TC real para continuar.</small> : form.exchange_rate_source && <small>{form.exchange_rate_source}{form.exchange_rate_date ? ` · ${form.exchange_rate_date}` : ''}</small>}</div></>}
      </div>
      {currenciesDiffer && Number(form.quoted_amount || form.contracted_amount) > 0 && !invalidRate && <div className="conversion-preview"><span>Equivalente para el presupuesto</span><strong>{formatMoney(equivalent, event.currency)}</strong><small>El importe original se conserva en {form.currency}.</small></div>}
    </section>

    <section className="vendor-form-section">
      <div className="vendor-form-section-head"><div><p className="eyebrow">CONTRATO</p><h3>Documentación y notas</h3></div></div>
      <div className="form-grid-2"><label>Fecha de contrato<input type="date" value={form.contract_date} onChange={e => setForm({ ...form, contract_date:e.target.value })}/></label><label className="checkbox-line"><input type="checkbox" checked={form.has_contract} onChange={e => setForm({ ...form, has_contract:e.target.checked })}/> Contrato firmado / recibido</label><label className="span-2">Contrato / enlace<input type="url" value={form.contract_url} onChange={e => setForm({ ...form, contract_url:e.target.value })} placeholder="https://…" /></label></div>
      <label>Notas del evento<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} placeholder="Qué incluye, condiciones, observaciones específicas de este evento…" /></label>
    </section>

    {error && <p className="form-error">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving || invalidRate}>{saving ? 'Guardando…' : assignment ? 'Guardar cambios' : 'Agregar al evento'}</button></div>
  </form></div>
}

function Info({ label, value }) { return <div className="vendor-contact-item"><span>{label}</span><strong>{value || 'No cargado'}</strong></div> }
function emptyForm(currency='USD') { return { vendor_id:'', budget_category_id:'', service_category:'', status:'considering', quoted_amount:'', contracted_amount:'', currency:currency || 'USD', exchange_rate:'1', exchange_rate_source:'Misma moneda', exchange_rate_date:new Date().toISOString().slice(0,10), contract_date:'', has_contract:false, contract_url:'', notes:'' } }
function emptyContact() { return { company_name:'', category:'', contact_name:'', phone:'', email:'', instagram:'', website:'', address:'' } }
function contactFromVendor(v={}) { return { company_name:v.company_name || '', category:v.category || '', contact_name:v.contact_name || '', phone:v.phone || '', email:v.email || '', instagram:v.instagram || '', website:v.website || '', address:v.address || '' } }
function vendorPayload(c) { return { company_name:c.company_name.trim(), category:c.category.trim() || null, contact_name:c.contact_name.trim() || null, phone:c.phone.trim() || null, email:c.email.trim() || null, instagram:c.instagram.trim() || null, website:c.website.trim() || null, address:c.address.trim() || null, updated_at:new Date().toISOString() } }
function amountValue(value) { return value === null || value === undefined ? '' : String(value) }
function nullableAmount(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function friendlyError(message='') { if (message.includes('budget_category_required')) return 'El proveedor necesita una categoría para vincularse al presupuesto.'; if (message.includes('exchange_rate_required')) return 'Ingresá un tipo de cambio antes de guardar.'; return message }
