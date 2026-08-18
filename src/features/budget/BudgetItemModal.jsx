import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import MoneyInput from '../../components/MoneyInput.jsx'

export default function BudgetItemModal({ open, event, categories, item, onClose, onSaved }) {
  const firstCategory = useMemo(() => categories?.[0]?.id || '', [categories])
  const [form, setForm] = useState(emptyForm(firstCategory, event?.currency || 'USD'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(item ? {
      category_id: item.category_id || firstCategory,
      description: item.description || '',
      estimated_amount: amountValue(item.estimated_amount),
      quoted_amount: amountValue(item.quoted_amount),
      contracted_amount: amountValue(item.contracted_amount),
      currency: item.currency || event?.currency || 'USD',
      variable_per_guest: Boolean(item.variable_per_guest),
      unit_amount: amountValue(item.unit_amount),
      notes: item.notes || '',
    } : emptyForm(firstCategory, event?.currency || 'USD'))
  }, [open, item, firstCategory, event?.currency])

  if (!open) return null

  async function save(e) {
    e.preventDefault()
    if (!form.description.trim()) return setError('Escribí un concepto.')
    if (!form.category_id) return setError('Elegí una categoría.')
    setSaving(true)
    setError('')

    const payload = {
      event_id: event.id,
      category_id: form.category_id,
      description: form.description.trim(),
      estimated_amount: nullableAmount(form.estimated_amount),
      quoted_amount: nullableAmount(form.quoted_amount),
      contracted_amount: nullableAmount(form.contracted_amount),
      currency: event.currency || 'USD',
      variable_per_guest: Boolean(form.variable_per_guest),
      unit_amount: form.variable_per_guest ? nullableAmount(form.unit_amount) : null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const query = item
      ? supabase.from('budget_items').update(payload).eq('id', item.id).eq('event_id', event.id)
      : supabase.from('budget_items').insert({ id: crypto.randomUUID(), ...payload })

    const { error: saveError } = await query
    setSaving(false)
    if (saveError) return setError(saveError.message)
    onSaved?.()
  }

  const currency = event?.currency || 'USD'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <form className="modal-card budget-item-modal" onSubmit={save}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">PRESUPUESTO</p>
            <h2>{item ? 'Editar concepto' : 'Nuevo concepto'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="form-grid-2">
          <label>Concepto<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej. Catering principal" /></label>
          <label>Categoría<select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
          <label>Estimado<MoneyInput currency={currency} value={form.estimated_amount} onChange={value => setForm({ ...form, estimated_amount: value })} /></label>
          <label>Cotizado<MoneyInput currency={currency} value={form.quoted_amount} onChange={value => setForm({ ...form, quoted_amount: value })} /></label>
          <label>Contratado<MoneyInput currency={currency} value={form.contracted_amount} onChange={value => setForm({ ...form, contracted_amount: value })} /></label>
          <label>Moneda del evento<input value={currency} disabled /></label>
        </div>

        <label className="check-row budget-variable-check">
          <input type="checkbox" checked={form.variable_per_guest} onChange={e => setForm({ ...form, variable_per_guest: e.target.checked })} />
          <span><strong>Costo variable por invitado</strong><small>Útil para catering, bebidas, papelería, torta o souvenirs.</small></span>
        </label>

        {form.variable_per_guest && <label>Costo por invitado<MoneyInput currency={currency} value={form.unit_amount} onChange={value => setForm({ ...form, unit_amount: value })} /></label>}
        <label>Notas<textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Qué incluye, condiciones, observaciones…" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? 'Guardando…' : 'Guardar concepto'}</button></div>
      </form>
    </div>
  )
}

function emptyForm(categoryId, currency) {
  return { category_id: categoryId || '', description: '', estimated_amount: '', quoted_amount: '', contracted_amount: '', currency: currency || 'USD', variable_per_guest: false, unit_amount: '', notes: '' }
}
function amountValue(value) { return value === null || value === undefined ? '' : String(value) }
function nullableAmount(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
