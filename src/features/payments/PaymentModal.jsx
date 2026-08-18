import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import MoneyInput from '../../components/MoneyInput.jsx'

export default function PaymentModal({ open, event, items, payment, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm(event?.currency || 'USD'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(payment ? {
      budget_item_id: payment.budget_item_id || '',
      description: payment.description || '',
      amount: payment.amount ?? '',
      currency: payment.currency || event?.currency || 'USD',
      due_date: payment.due_date || '',
      status: payment.status || 'pending',
      paid_at: payment.paid_at ? payment.paid_at.slice(0, 10) : '',
      payment_method: payment.payment_method || '',
      receipt_url: payment.receipt_url || '',
      notes: payment.notes || '',
    } : emptyForm(event?.currency || 'USD'))
  }, [open, payment, event?.currency])

  if (!open) return null

  async function save(e) {
    e.preventDefault()
    if (!form.description.trim()) return setError('Escribí el concepto del pago.')
    if (!(Number(form.amount) > 0)) return setError('Ingresá un importe válido.')
    setSaving(true)
    setError('')
    const payload = {
      event_id: event.id,
      budget_item_id: form.budget_item_id || null,
      description: form.description.trim(),
      amount: Number(form.amount),
      currency: event.currency || 'USD',
      due_date: form.due_date || null,
      status: form.status,
      paid_at: form.status === 'paid' ? toPaidTimestamp(form.paid_at) : null,
      payment_method: form.payment_method.trim() || null,
      receipt_url: form.receipt_url.trim() || null,
      notes: form.notes.trim() || null,
    }
    const query = payment
      ? supabase.from('vendor_payments').update(payload).eq('id', payment.id).eq('event_id', event.id)
      : supabase.from('vendor_payments').insert({ id: crypto.randomUUID(), ...payload })
    const { error: saveError } = await query
    setSaving(false)
    if (saveError) return setError(saveError.message)
    onSaved?.()
  }

  const currency = event?.currency || 'USD'

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
    <form className="modal-card payment-modal" onSubmit={save}>
      <div className="modal-head"><div><p className="eyebrow">PAGOS</p><h2>{payment ? 'Editar pago' : 'Nuevo pago'}</h2></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
      <div className="form-grid-2">
        <label>Concepto<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej. Seña de reserva" /></label>
        <label>Concepto del presupuesto<select value={form.budget_item_id} onChange={e => setForm({ ...form, budget_item_id: e.target.value })}><option value="">Sin vincular</option>{items.map(item => <option key={item.id} value={item.id}>{item.description}</option>)}</select></label>
        <label>Importe<MoneyInput currency={currency} value={form.amount} onChange={value => setForm({ ...form, amount: value })} /></label>
        <label>Moneda del evento<input value={currency} disabled /></label>
        <label>Fecha pactada<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label>
        <label>Estado<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="canceled">Cancelado</option></select></label>
        {form.status === 'paid' && <label>Fecha pagada<input type="date" value={form.paid_at} onChange={e => setForm({ ...form, paid_at: e.target.value })} /></label>}
        <label>Medio de pago<input value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} placeholder="Transferencia, efectivo, tarjeta…" /></label>
      </div>
      <label>Comprobante / enlace<input type="url" value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://…" /></label>
      <label>Notas<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar pago'}</button></div>
    </form>
  </div>
}

function emptyForm(currency) { return { budget_item_id: '', description: '', amount: '', currency: currency || 'USD', due_date: '', status: 'pending', paid_at: '', payment_method: '', receipt_url: '', notes: '' } }
function toPaidTimestamp(value) { return value ? `${value}T12:00:00.000Z` : new Date().toISOString() }
