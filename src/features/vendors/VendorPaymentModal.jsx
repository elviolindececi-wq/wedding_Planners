import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import MoneyInput from '../../components/MoneyInput.jsx'
import { CURRENCIES } from '../../lib/currencies.js'
import { fetchExchangeRate, formatExchangeRate } from '../../lib/exchangeRates.js'
import { formatMoney } from '../../lib/money.js'
import { paymentPayloadAmounts } from '../../lib/paymentMoney.js'

export default function VendorPaymentModal({ open, event, assignment, budgetItem, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm(event?.currency || 'USD'))
  const [saving, setSaving] = useState(false)
  const [loadingRate, setLoadingRate] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    const currency = assignment?.currency || event?.currency || 'USD'
    setForm({ ...emptyForm(currency), exchange_rate:currency === event?.currency ? '1' : String(assignment?.exchange_rate || ''), exchange_rate_source:currency === event?.currency ? 'Misma moneda' : (assignment?.exchange_rate_source || ''), exchange_rate_date:currency === event?.currency ? new Date().toISOString().slice(0,10) : (assignment?.exchange_rate_date || '') })
  }, [open, assignment?.id, assignment?.currency, assignment?.exchange_rate, event?.currency])

  if (!open || !assignment) return null

  async function automaticRate() {
    if (form.currency === event.currency) return
    setLoadingRate(true); setError('')
    try { const data = await fetchExchangeRate(form.currency,event.currency); setForm(f=>({...f,exchange_rate:String(data.rate),exchange_rate_source:data.source,exchange_rate_date:data.date})) }
    catch(e){ setError(e.message) }
    setLoadingRate(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.description.trim()) return setError('Escribí el concepto del pago.')
    if (!(Number(form.amount) > 0)) return setError('Ingresá un importe válido.')
    setSaving(true); setError('')
    try {
      const amounts = paymentPayloadAmounts({ amount:form.amount,currency:form.currency,eventCurrency:event.currency,exchangeRate:form.exchange_rate,exchangeRateSource:form.exchange_rate_source,exchangeRateDate:form.exchange_rate_date })
      const payload = {
        id: crypto.randomUUID(), event_id:event.id, event_vendor_id:assignment.id, budget_item_id:budgetItem?.id || null,
        description:form.description.trim(), ...amounts, due_date:form.due_date || null, status:form.status,
        paid_at:form.status === 'paid' ? `${form.paid_at || new Date().toISOString().slice(0,10)}T12:00:00.000Z` : null,
        payment_method:form.payment_method.trim() || null, receipt_url:form.receipt_url.trim() || null, notes:form.notes.trim() || null,
      }
      const { error:saveError } = await supabase.from('vendor_payments').insert(payload)
      if (saveError) throw saveError
      onSaved?.()
    } catch(e2){ setError(e2.message) }
    setSaving(false)
  }

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
    <form className="modal-card payment-modal" onSubmit={save}>
      <div className="modal-head"><div><p className="eyebrow">PAGO DE PROVEEDOR</p><h2>{assignment.vendors?.company_name || 'Proveedor'}</h2><p>Se guarda en la moneda real del proveedor y se consolida en {event.currency} para el presupuesto.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
      <div className="form-grid-2">
        <label>Concepto<input value={form.description} onChange={e => setForm({ ...form, description:e.target.value })} placeholder="Ej. Seña de reserva" /></label>
        <label>Moneda<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value,exchange_rate:e.target.value===event.currency?'1':'',exchange_rate_source:'',exchange_rate_date:''})}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></label>
        <label>Importe<MoneyInput currency={form.currency} value={form.amount} onChange={amount => setForm({ ...form, amount })}/></label>
        {form.currency!==event.currency&&<><label>Tipo de cambio<input type="number" min="0.00000001" step="any" value={form.exchange_rate} onChange={e=>setForm({...form,exchange_rate:e.target.value,exchange_rate_source:'Manual',exchange_rate_date:new Date().toISOString().slice(0,10)})}/><small>{form.exchange_rate?formatExchangeRate(form.exchange_rate,form.currency,event.currency):`1 ${form.currency} = ? ${event.currency}`}</small></label><div className="rate-helper"><button type="button" className="secondary-btn" onClick={automaticRate} disabled={loadingRate}>{loadingRate?'Consultando…':'Usar cambio automático'}</button>{form.exchange_rate_source&&<small>{form.exchange_rate_source}</small>}</div></>}
        <label>Fecha pactada<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date:e.target.value })}/></label>
        <label>Estado<select value={form.status} onChange={e => setForm({ ...form, status:e.target.value })}><option value="pending">Pendiente</option><option value="paid">Pagado</option></select></label>
        {form.status === 'paid' && <label>Fecha pagada<input type="date" value={form.paid_at} onChange={e => setForm({ ...form, paid_at:e.target.value })}/></label>}
        <label>Medio de pago<input value={form.payment_method} onChange={e => setForm({ ...form, payment_method:e.target.value })} placeholder="Transferencia, efectivo…" /></label>
      </div>
      {form.currency!==event.currency&&Number(form.amount)>0&&Number(form.exchange_rate)>0&&<div className="conversion-preview"><span>Equivalente en el presupuesto</span><strong>{formatMoney(Number(form.amount)*Number(form.exchange_rate),event.currency)}</strong></div>}
      <label>Comprobante / enlace<input type="url" value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url:e.target.value })} placeholder="https://…" /></label>
      <label>Notas<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })}/></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pago'}</button></div>
    </form>
  </div>
}

function emptyForm(currency){ return { description:'', amount:'', currency:currency||'USD', exchange_rate:'1', exchange_rate_source:'Misma moneda', exchange_rate_date:new Date().toISOString().slice(0,10), due_date:'', status:'pending', paid_at:'', payment_method:'', receipt_url:'', notes:'' } }
