import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import MoneyInput from '../../components/MoneyInput.jsx'
import { CURRENCIES } from '../../lib/currencies.js'
import { fetchExchangeRate, formatExchangeRate } from '../../lib/exchangeRates.js'
import { formatMoney } from '../../lib/money.js'

export default function QuoteModal({ open, event, vendors, assignments, categories, quote, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm(event?.currency))
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingRate, setLoadingRate] = useState(false)
  const [error, setError] = useState('')
  const equivalent = Number(form.amount||0) * Number(form.exchange_rate||1)
  const selectedAssignment = useMemo(() => assignments.find(a => a.id === form.event_vendor_id), [assignments,form.event_vendor_id])

  useEffect(() => {
    if (!open) return
    setError(''); setNewCategory('')
    setForm(quote ? {
      vendor_id:quote.vendor_id || '', event_vendor_id:quote.event_vendor_id || '', budget_category_id:quote.budget_category_id || '', title:quote.title || '',
      amount:amountValue(quote.amount), currency:quote.currency || event.currency || 'USD', exchange_rate:amountValue(quote.exchange_rate || 1), exchange_rate_source:quote.exchange_rate_source || '', exchange_rate_date:quote.exchange_rate_date || '',
      includes:quote.includes || '', extras:quote.extras || '', payment_terms:quote.payment_terms || '', deposit_amount:amountValue(quote.deposit_amount), valid_until:quote.valid_until || '', rating:quote.rating ? String(quote.rating) : '', notes:quote.notes || '',
    } : emptyForm(event?.currency))
  }, [open,quote,event?.currency])

  useEffect(() => {
    if (!open || quote || !selectedAssignment) return
    setForm(f => ({ ...f, vendor_id:selectedAssignment.vendor_id, budget_category_id:selectedAssignment.budget_category_id || f.budget_category_id, currency:selectedAssignment.currency || f.currency, exchange_rate:selectedAssignment.exchange_rate ? String(selectedAssignment.exchange_rate) : f.exchange_rate, exchange_rate_source:selectedAssignment.exchange_rate_source || f.exchange_rate_source, exchange_rate_date:selectedAssignment.exchange_rate_date || f.exchange_rate_date }))
  }, [selectedAssignment,open,quote])

  if (!open) return null

  async function automaticRate() {
    if (form.currency === event.currency) return setForm(f => ({ ...f, exchange_rate:'1',exchange_rate_source:'Misma moneda',exchange_rate_date:new Date().toISOString().slice(0,10) }))
    setLoadingRate(true); setError('')
    try { const data=await fetchExchangeRate(form.currency,event.currency); setForm(f => ({...f,exchange_rate:String(data.rate),exchange_rate_source:data.source,exchange_rate_date:data.date})) } catch(e){setError(e.message)}
    setLoadingRate(false)
  }

  async function resolveCategory() {
    if (form.budget_category_id !== '__new__') return form.budget_category_id || null
    const name=newCategory.trim(); if(!name) throw new Error('Escribí el nombre de la nueva categoría.')
    const existing=categories.find(c => c.name.trim().toLowerCase()===name.toLowerCase()); if(existing) return existing.id
    const id=crypto.randomUUID(); const {error}=await supabase.from('budget_categories').insert({id,event_id:event.id,name,planned_amount:0,cost_type:'mixed',sort_order:categories.length}); if(error) throw error; return id
  }

  async function save(e) {
    e.preventDefault(); if(!form.vendor_id) return setError('Elegí un proveedor.'); if(!(Number(form.amount)>0)) return setError('Ingresá el importe cotizado.'); if(!form.budget_category_id) return setError('Vinculá la cotización con una categoría de presupuesto.'); if(form.currency!==event.currency && !(Number(form.exchange_rate)>0)) return setError('Ingresá o consultá un tipo de cambio válido.')
    setSaving(true); setError('')
    try {
      const categoryId=await resolveCategory()
      const payload={event_id:event.id,vendor_id:form.vendor_id,event_vendor_id:form.event_vendor_id||null,budget_category_id:categoryId,title:form.title.trim()||null,amount:Number(form.amount),currency:form.currency,exchange_rate:form.currency===event.currency?1:Number(form.exchange_rate),exchange_rate_source:form.currency===event.currency?'Misma moneda':(form.exchange_rate_source.trim()||'Manual'),exchange_rate_date:form.currency===event.currency?new Date().toISOString().slice(0,10):(form.exchange_rate_date||new Date().toISOString().slice(0,10)),includes:form.includes.trim()||null,extras:form.extras.trim()||null,payment_terms:form.payment_terms.trim()||null,deposit_amount:nullableAmount(form.deposit_amount),valid_until:form.valid_until||null,rating:form.rating?Number(form.rating):null,notes:form.notes.trim()||null}
      const query=quote?supabase.from('quotes').update(payload).eq('id',quote.id).eq('event_id',event.id):supabase.from('quotes').insert({id:crypto.randomUUID(),...payload})
      const {error:saveError}=await query; if(saveError) throw saveError; onSaved?.()
    } catch(e2){setError(e2.message)}
    setSaving(false)
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}><form className="modal-card quote-modal" onSubmit={save}>
    <div className="modal-head"><div><p className="eyebrow">COTIZACIÓN</p><h2>{quote?'Editar cotización':'Nueva cotización'}</h2><p>Conservamos la moneda original y su equivalencia en el presupuesto del evento.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
    <div className="form-grid-2">
      <label>Proveedor<select value={form.vendor_id} onChange={e=>setForm({...form,vendor_id:e.target.value,event_vendor_id:''})}><option value="">Elegir…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company_name}</option>)}</select></label>
      <label>Asignación existente<select value={form.event_vendor_id} onChange={e=>{const a=assignments.find(x=>x.id===e.target.value);setForm({...form,event_vendor_id:e.target.value,vendor_id:a?.vendor_id||form.vendor_id,budget_category_id:a?.budget_category_id||form.budget_category_id})}}><option value="">Sin asignación previa</option>{assignments.filter(a=>!form.vendor_id||a.vendor_id===form.vendor_id).map(a=><option key={a.id} value={a.id}>{a.vendors?.company_name} · {a.service_category||'Servicio'}</option>)}</select></label>
      <label>Categoría de presupuesto<select value={form.budget_category_id} onChange={e=>setForm({...form,budget_category_id:e.target.value})}><option value="">Elegir categoría…</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}<option value="__new__">+ Nueva categoría…</option></select></label>
      {form.budget_category_id==='__new__'&&<label>Nombre nueva categoría<input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Ej. Show especial"/></label>}
      <label>Título / propuesta<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Cobertura foto + video"/></label>
      <label>Moneda<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value,exchange_rate:e.target.value===event.currency?'1':'',exchange_rate_source:'',exchange_rate_date:''})}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></label>
      <label>Importe<MoneyInput currency={form.currency} value={form.amount} onChange={value=>setForm({...form,amount:value})}/></label>
      <label>Seña solicitada<MoneyInput currency={form.currency} value={form.deposit_amount} onChange={value=>setForm({...form,deposit_amount:value})}/></label>
      {form.currency!==event.currency&&<><label>Tipo de cambio<input type="number" min="0.00000001" step="any" value={form.exchange_rate} onChange={e=>setForm({...form,exchange_rate:e.target.value,exchange_rate_source:'Manual',exchange_rate_date:new Date().toISOString().slice(0,10)})}/><small>{form.exchange_rate?formatExchangeRate(form.exchange_rate,form.currency,event.currency):`1 ${form.currency} = ? ${event.currency}`}</small></label><div className="rate-helper"><button type="button" className="secondary-btn" onClick={automaticRate} disabled={loadingRate}>{loadingRate?'Consultando…':'Usar cambio automático'}</button>{form.exchange_rate_source&&<small>{form.exchange_rate_source}{form.exchange_rate_date?` · ${form.exchange_rate_date}`:''}</small>}</div></>}
      <label>Vigencia<input type="date" value={form.valid_until} onChange={e=>setForm({...form,valid_until:e.target.value})}/></label>
      <label>Valoración<select value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}><option value="">Sin valorar</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
    </div>
    {form.currency!==event.currency&&Number(form.amount)>0&&Number(form.exchange_rate)>0&&<div className="conversion-preview"><span>Equivalente para comparar y presupuestar</span><strong>{formatMoney(equivalent,event.currency)}</strong><small>TC guardado: {form.exchange_rate_source||'Manual'}{form.exchange_rate_date?` · ${form.exchange_rate_date}`:''}</small></div>}
    <div className="form-grid-2"><label>Qué incluye<textarea rows="3" value={form.includes} onChange={e=>setForm({...form,includes:e.target.value})}/></label><label>Extras / no incluye<textarea rows="3" value={form.extras} onChange={e=>setForm({...form,extras:e.target.value})}/></label></div>
    <label>Forma / condiciones de pago<textarea rows="2" value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})} placeholder="30% seña, 40% 30 días antes…"/></label>
    <label>Notas<textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    {error&&<p className="form-error">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving?'Guardando…':'Guardar cotización'}</button></div>
  </form></div>
}

function emptyForm(currency='USD'){return{vendor_id:'',event_vendor_id:'',budget_category_id:'',title:'',amount:'',currency:currency||'USD',exchange_rate:'1',exchange_rate_source:'Misma moneda',exchange_rate_date:new Date().toISOString().slice(0,10),includes:'',extras:'',payment_terms:'',deposit_amount:'',valid_until:'',rating:'',notes:''}}
function amountValue(v){return v===null||v===undefined?'':String(v)}
function nullableAmount(v){return v===''||v===null||v===undefined?null:Number(v)}
