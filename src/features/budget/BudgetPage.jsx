import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { CURRENCIES } from '../../lib/currencies.js'
import CurrencyChangeModal from './CurrencyChangeModal.jsx'
import BudgetItemModal from './BudgetItemModal.jsx'
import MoneyInput from '../../components/MoneyInput.jsx'
import { formatMoney } from '../../lib/money.js'
import { getDefaultBudgetCategories, getDistributionWeightMap, normalizeCategoryName } from './budgetDefaults.js'

export default function BudgetPage() {
  const { event, refreshEvent } = useOutletContext()
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [guestSimulation, setGuestSimulation] = useState(String(event.estimated_guests || 100))
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [currency, setCurrency] = useState(event.currency || 'USD')
  const [budgetTotal, setBudgetTotal] = useState(String(event.budget_total || ''))
  const [distributionOpen, setDistributionOpen] = useState(false)
  const [distributionGuests, setDistributionGuests] = useState(String(event.estimated_guests || 100))
  const [decorationStyle, setDecorationStyle] = useState('standard')
  const [musicStyle, setMusicStyle] = useState('dj')
  const [distributing, setDistributing] = useState(false)
  const [currencyChangeOpen, setCurrencyChangeOpen] = useState(false)
  const [pendingCurrency, setPendingCurrency] = useState('')

  useEffect(() => {
    setCurrency(event.currency || 'USD')
    setBudgetTotal(String(event.budget_total || ''))
    setGuestSimulation(String(event.estimated_guests || 100))
    setDistributionGuests(String(event.estimated_guests || 100))
  }, [event.currency, event.budget_total, event.estimated_guests])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [catRes, itemRes, paymentRes] = await Promise.all([
      supabase.from('budget_categories').select('*').eq('event_id', event.id).order('sort_order'),
      supabase.from('budget_items').select('*').eq('event_id', event.id).order('created_at'),
      supabase.from('vendor_payments').select('*').eq('event_id', event.id).order('due_date', { ascending: true, nullsFirst: false }),
    ])

    const firstError = catRes.error || itemRes.error || paymentRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    let cats = catRes.data || []
    if (!cats.length) {
      const defaults = getDefaultBudgetCategories(event)
      const { error: insertError } = await supabase.from('budget_categories').insert(defaults)
      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }
      const { data: loadedCats, error: reloadError } = await supabase.from('budget_categories').select('*').eq('event_id', event.id).order('sort_order')
      if (reloadError) {
        setError(reloadError.message)
        setLoading(false)
        return
      }
      cats = loadedCats || []
    }

    setCategories(cats)
    setItems(itemRes.data || [])
    setPayments(paymentRes.data || [])
    setLoading(false)
  }, [event])

  useEffect(() => { loadAll() }, [loadAll])

  const paidByItem = useMemo(() => {
    const map = new Map()
    for (const payment of payments) {
      if (payment.status !== 'paid' || !payment.budget_item_id) continue
      map.set(payment.budget_item_id, (map.get(payment.budget_item_id) || 0) + num(payment.amount))
    }
    return map
  }, [payments])

  const categoryStats = useMemo(() => categories.map(cat => {
    const catItems = items.filter(item => item.category_id === cat.id)
    const contracted = sum(catItems.map(item => item.contracted_amount))
    const quoted = sum(catItems.map(item => item.quoted_amount))
    const estimated = sum(catItems.map(item => item.estimated_amount))
    const paid = sum(catItems.map(item => paidByItem.get(item.id) || 0))
    const planned = num(cat.planned_amount)
    return { ...cat, items: catItems, planned, estimated, quoted, contracted, paid, pending: Math.max(0, contracted - paid), difference: planned - contracted }
  }), [categories, items, paidByItem])

  const totals = useMemo(() => {
    const planned = sum(categoryStats.map(cat => cat.planned))
    const estimated = sum(categoryStats.map(cat => cat.estimated))
    const quoted = sum(categoryStats.map(cat => cat.quoted))
    const contracted = sum(categoryStats.map(cat => cat.contracted))
    const paid = sum(payments.filter(p => p.status === 'paid').map(p => p.amount))
    const pending = Math.max(0, contracted - paid)
    const total = num(budgetTotal)
    return {
      total,
      planned,
      estimated,
      quoted,
      contracted,
      paid,
      pending,
      available: total - contracted,
      unallocated: total - planned,
      execution: total > 0 ? Math.round((paid / total) * 100) : 0,
      distributionPct: total > 0 ? Math.round((planned / total) * 100) : 0,
    }
  }, [categoryStats, payments, budgetTotal])

  const simulation = useMemo(() => simulate(items, Number(guestSimulation) || 0), [items, guestSimulation])
  const scenarios = useMemo(() => {
    const base = Number(guestSimulation) || Number(event.estimated_guests) || 100
    return [-30, -20, -10, 0, 10, 20, 30].map(delta => ({ guests: Math.max(0, base + delta), total: simulate(items, Math.max(0, base + delta)).total }))
  }, [items, guestSimulation, event.estimated_guests])

  async function updateCategory(cat, patch) {
    setCategories(prev => prev.map(item => item.id === cat.id ? { ...item, ...patch } : item))
    const { error: updateError } = await supabase.from('budget_categories').update(patch).eq('id', cat.id).eq('event_id', event.id)
    if (updateError) {
      setError(updateError.message)
      loadAll()
    }
  }

  async function saveBudgetTotal() {
    const next = Math.max(0, Number(budgetTotal) || 0)
    setBudgetTotal(String(next || ''))
    const { error: updateError } = await supabase.from('events').update({ budget_total: next, updated_at: new Date().toISOString() }).eq('id', event.id)
    if (updateError) return setError(updateError.message)
    await refreshEvent?.()
  }

  function requestCurrencyChange(nextCurrency) {
    if (nextCurrency === currency) return
    setPendingCurrency(nextCurrency)
    setCurrencyChangeOpen(true)
  }

  async function confirmCurrencyChange({ mode, rate, source, date }) {
    const { error: rpcError } = await supabase.rpc('change_event_currency', {
      p_event_id: event.id,
      p_new_currency: pendingCurrency,
      p_mode: mode,
      p_rate: rate,
      p_rate_source: source || null,
      p_rate_date: date || null,
    })
    if (rpcError) throw rpcError
    setCurrencyChangeOpen(false)
    setCurrency(pendingCurrency)
    setPendingCurrency('')
    await refreshEvent?.()
    await loadAll()
  }

  async function applySuggestedDistribution() {
    const total = num(budgetTotal)
    if (!(total > 0)) return setError('Definí primero el presupuesto total del evento.')
    if (!categories.length) return
    setDistributing(true)
    setError('')

    const weightMap = getDistributionWeightMap(event.event_type)
    const customAllocated = categories
      .filter(cat => !(weightMap.get(normalizeCategoryName(cat.name)) > 0))
      .reduce((acc, cat) => acc + num(cat.planned_amount), 0)
    const availableForTemplate = Math.max(0, total - customAllocated)
    const guests = Number(distributionGuests) || Number(event.estimated_guests) || 100

    const weighted = categories.map(cat => {
      const key = normalizeCategoryName(cat.name)
      let weight = weightMap.get(key) || 0
      if (!(weight > 0)) return { cat, weight: 0 }

      if (key.includes('decoracion')) {
        if (decorationStyle === 'simple') weight *= 0.78
        if (decorationStyle === 'elaborate') weight *= 1.35
      }
      if (key.includes('musica')) {
        weight *= musicStyle === 'live' ? 1.28 : 0.88
      }
      if (guests >= 200) {
        if (key.includes('catering') || key.includes('banquete')) weight *= 1.08
        if (key.includes('bebidas')) weight *= 1.05
        if (key.includes('alquiler')) weight *= 1.03
      } else if (guests > 0 && guests <= 80) {
        if (key.includes('catering') || key.includes('banquete')) weight *= 0.92
        if (key.includes('bebidas')) weight *= 0.92
        if (key.includes('decoracion')) weight *= 1.08
      }
      return { cat, weight }
    })

    const totalWeight = weighted.reduce((acc, row) => acc + row.weight, 0)
    if (!(totalWeight > 0)) {
      setDistributing(false)
      return setError('No encontré categorías base para distribuir el presupuesto.')
    }

    const updates = weighted.filter(row => row.weight > 0).map(row => ({
      id: row.cat.id,
      amount: roundMoney(availableForTemplate * (row.weight / totalWeight), currency),
    }))

    const results = await Promise.all(updates.map(update =>
      supabase.from('budget_categories').update({ planned_amount: update.amount }).eq('id', update.id).eq('event_id', event.id)
    ))
    const firstError = results.find(result => result.error)?.error
    setDistributing(false)
    if (firstError) return setError(firstError.message)
    setDistributionOpen(false)
    await loadAll()
  }

  async function clearSuggestedAmounts() {
    if (!window.confirm('¿Limpiar todos los importes estimados por categoría? Los conceptos, cotizaciones y pagos no se borrarán.')) return
    const results = await Promise.all(categories.map(cat => supabase.from('budget_categories').update({ planned_amount: 0 }).eq('id', cat.id).eq('event_id', event.id)))
    const firstError = results.find(result => result.error)?.error
    if (firstError) return setError(firstError.message)
    await loadAll()
  }

  async function addCategory(e) {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    const exists = categories.some(cat => normalizeCategoryName(cat.name) === normalizeCategoryName(name))
    if (exists) return setError('Ya existe una categoría con ese nombre.')
    const payload = { id: crypto.randomUUID(), event_id: event.id, name, planned_amount: 0, cost_type: 'mixed', sort_order: categories.length }
    const { error: insertError } = await supabase.from('budget_categories').insert(payload)
    if (insertError) return setError(insertError.message)
    setNewCategory('')
    setAddingCategory(false)
    loadAll()
  }

  async function removeCategory(cat) {
    if (cat.items.length) return window.alert('Esta categoría tiene conceptos asociados. Movelos o eliminá esos conceptos antes de quitar la categoría.')
    if (!window.confirm(`¿Eliminar la categoría “${cat.name}”?`)) return
    const { error: deleteError } = await supabase.from('budget_categories').delete().eq('id', cat.id).eq('event_id', event.id)
    if (deleteError) setError(deleteError.message)
    else loadAll()
  }

  async function removeItem(item) {
    const linkedPayments = payments.some(payment => payment.budget_item_id === item.id)
    if (linkedPayments) return window.alert('Este concepto tiene pagos asociados. Eliminá o reasigná esos pagos antes.')
    if (!window.confirm(`¿Eliminar “${item.description}”?`)) return
    const { error: deleteError } = await supabase.from('budget_items').delete().eq('id', item.id).eq('event_id', event.id)
    if (deleteError) setError(deleteError.message)
    else loadAll()
  }

  return (
    <section className="budget-page">
      <div className="module-heading budget-module-heading">
        <div>
          <p className="eyebrow">PRESUPUESTO</p>
          <h2>Presupuesto de {event.name}</h2>
          <p>Definí el presupuesto total, distribuí una estimación entre categorías y después compará lo cotizado, contratado y pagado.</p>
        </div>
        <div className="budget-heading-actions">
          <label className="currency-control">Moneda
            <select value={currency} onChange={e => requestCurrencyChange(e.target.value)}>
              {CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}
            </select>
          </label>
          <div className="module-actions"><button className="secondary-btn" onClick={() => setAddingCategory(true)}>+ Categoría</button><button className="primary-btn" onClick={() => { setEditingItem(null); setItemModal(true) }}>+ Concepto</button></div>
        </div>
      </div>

      <section className="panel budget-setup-panel">
        <div className="budget-total-block">
          <div><p className="eyebrow">PRESUPUESTO TOTAL</p><h3>¿Cuánto quieren destinar al evento?</h3><p>Es el techo de referencia. La distribución por categorías es una sugerencia y siempre se puede editar.</p></div>
          <label className="budget-total-label"><MoneyInput currency={currency} value={budgetTotal} onChange={setBudgetTotal} onBlur={saveBudgetTotal} ariaLabel="Presupuesto total" /></label>
        </div>
        <div className="budget-distribution-actions">
          <button className="secondary-btn" onClick={() => setDistributionOpen(open => !open)} disabled={!num(budgetTotal)}>{distributionOpen ? 'Cerrar calculadora' : totals.planned > 0 ? '✨ Recalcular distribución' : '✨ Sugerir distribución por categoría'}</button>
          {totals.planned > 0 && <button className="text-action danger-action" onClick={clearSuggestedAmounts}>Limpiar estimados</button>}
          {totals.total > 0 && <span className={`distribution-status ${totals.distributionPct > 100 ? 'danger-copy' : ''}`}>{totals.distributionPct}% distribuido · {money(Math.abs(totals.unallocated), currency)} {totals.unallocated >= 0 ? 'sin asignar' : 'por encima'}</span>}
        </div>

        {distributionOpen && <div className="distribution-calculator">
          <div className="distribution-grid">
            <label>Invitados estimados<input type="number" min="0" value={distributionGuests} onChange={e => setDistributionGuests(e.target.value)} /></label>
            <label>Decoración<select value={decorationStyle} onChange={e => setDecorationStyle(e.target.value)}><option value="simple">Simple</option><option value="standard">Estándar</option><option value="elaborate">Elaborada</option></select></label>
            <label>Música<select value={musicStyle} onChange={e => setMusicStyle(e.target.value)}><option value="dj">DJ / sonido</option><option value="live">Música en vivo</option></select></label>
          </div>
          <div className="distribution-copy">
            <strong>Sugerencia de punto de partida</strong>
            <p>Usa el presupuesto total, el tipo de evento, la cantidad de invitados y estas preferencias para proponer importes por categoría. Podés cambiar cada importe después.</p>
            {Number(distributionGuests) > 0 && num(budgetTotal) > 0 && <small>Referencia: {money(num(budgetTotal) / Number(distributionGuests), currency)} por invitado sobre el presupuesto total.</small>}
          </div>
          <button className="primary-btn" onClick={applySuggestedDistribution} disabled={distributing}>{distributing ? 'Calculando…' : 'Aplicar distribución sugerida'}</button>
        </div>}
      </section>

      <div className="budget-metrics">
        <Metric label="Presupuesto total" value={money(totals.total, currency)} detail="Techo definido" />
        <Metric label="Distribuido" value={money(totals.planned, currency)} detail={`${totals.distributionPct}% entre categorías`} danger={totals.unallocated < 0} />
        <Metric label="Contratado" value={money(totals.contracted, currency)} detail={totals.total ? `${Math.round((totals.contracted / totals.total) * 100)}% del total` : 'Sin presupuesto definido'} />
        <Metric label="Pagado" value={money(totals.paid, currency)} detail={`${totals.execution}% ejecutado`} />
        <Metric label="Pendiente" value={money(totals.pending, currency)} detail="Saldo contratado" />
        <Metric label="Disponible" value={money(totals.available, currency)} detail={totals.available < 0 ? 'Sobre presupuesto' : 'Aún no comprometido'} danger={totals.available < 0} />
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? <div className="panel loading-panel">Cargando presupuesto…</div> : <>
        {addingCategory && <form className="panel inline-category-form" onSubmit={addCategory}><strong>Nueva categoría</strong><input autoFocus value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ej. Seguridad, fuegos artificiales, welcome party…" /><button className="primary-btn">Agregar</button><button type="button" className="secondary-btn" onClick={() => setAddingCategory(false)}>Cancelar</button></form>}

        <div className="budget-category-list">
          {categoryStats.map(cat => <CategoryCard key={cat.id} cat={cat} currency={currency} budgetTotal={totals.total} onUpdate={updateCategory} onEditItem={(item) => { setEditingItem(item); setItemModal(true) }} onRemoveItem={removeItem} onRemoveCategory={removeCategory} />)}
        </div>

        <section className="panel budget-simulator">
          <div className="simulator-heading"><div><p className="eyebrow">SIMULADOR</p><h3>¿Qué pasa si cambia la cantidad de invitados?</h3><p>Usa los conceptos marcados como costo por invitado. Es una proyección y no modifica el presupuesto guardado.</p></div><label>Invitados simulados<input type="number" min="0" value={guestSimulation} onChange={e => setGuestSimulation(e.target.value)} /></label></div>
          <div className="simulator-result"><span>Costo simulado</span><strong>{money(simulation.total, currency)}</strong><small>{money(simulation.variable, currency)} variables + {money(simulation.fixed, currency)} fijos</small></div>
          <div className="scenario-grid">{scenarios.map(row => <article key={row.guests} className={row.guests === (Number(guestSimulation) || 0) ? 'active' : ''}><span>{row.guests} invitados</span><strong>{money(row.total, currency)}</strong></article>)}</div>
        </section>
      </>}

      <BudgetItemModal open={itemModal} event={{ ...event, currency }} categories={categories} item={editingItem} onClose={() => setItemModal(false)} onSaved={async () => { setItemModal(false); await loadAll() }} />
      <CurrencyChangeModal
        open={currencyChangeOpen}
        fromCurrency={currency}
        toCurrency={pendingCurrency}
        hasAmounts={totals.total > 0 || totals.planned > 0 || totals.estimated > 0 || totals.quoted > 0 || totals.contracted > 0 || totals.paid > 0}
        onClose={() => { setCurrencyChangeOpen(false); setPendingCurrency('') }}
        onConfirm={confirmCurrencyChange}
      />
    </section>
  )
}

function CategoryCard({ cat, currency, budgetTotal, onUpdate, onEditItem, onRemoveItem, onRemoveCategory }) {
  const [planned, setPlanned] = useState(String(cat.planned || ''))
  useEffect(() => setPlanned(String(cat.planned || '')), [cat.planned])
  const pctPaid = cat.planned > 0 ? Math.min(100, Math.round((cat.paid / cat.planned) * 100)) : 0
  const pctBudget = budgetTotal > 0 ? (cat.planned / budgetTotal) * 100 : 0
  const over = cat.planned > 0 && cat.contracted > cat.planned
  return <article className={`budget-category-card ${over ? 'is-over-budget' : ''}`}>
    <div className="budget-category-head">
      <div><h3>{cat.name}</h3><span>{costTypeLabel(cat.cost_type)}{budgetTotal > 0 && cat.planned > 0 ? ` · ${formatPercent(pctBudget)} del presupuesto` : ''}</span></div>
      <div className="budget-category-actions"><button className="text-action" onClick={() => onRemoveCategory(cat)}>Eliminar</button></div>
    </div>
    <div className="budget-category-grid">
      <label>Estimado para categoría<MoneyInput currency={currency} value={planned} onChange={setPlanned} onBlur={() => onUpdate(cat, { planned_amount: Number(planned) || 0 })} ariaLabel={`Estimado para ${cat.name}`} /></label>
      <Stat label="Cotizado" value={money(cat.quoted, currency)} />
      <Stat label="Contratado" value={money(cat.contracted, currency)} danger={over} />
      <Stat label="Pagado" value={money(cat.paid, currency)} />
      <Stat label="Pendiente" value={money(cat.pending, currency)} />
      <Stat label="Diferencia" value={money(cat.difference, currency)} danger={cat.difference < 0} />
    </div>
    <div className="category-progress"><i style={{ width: `${pctPaid}%` }} /></div>
    {cat.items.length ? <div className="budget-item-list">{cat.items.map(item => <div className="budget-item-row" key={item.id}><div><strong>{item.description}</strong><small>{item.variable_per_guest && item.unit_amount ? `${money(item.unit_amount, currency)} por invitado` : 'Costo fijo o mixto'}</small></div><span>{money(item.contracted_amount ?? item.quoted_amount ?? item.estimated_amount ?? 0, currency)}</span><button className="text-action" onClick={() => onEditItem(item)}>Editar</button><button className="text-action danger-action" onClick={() => onRemoveItem(item)}>×</button></div>)}</div> : <p className="category-empty">Todavía no hay conceptos en esta categoría.</p>}
  </article>
}

function Metric({ label, value, detail, danger }) { return <article className={`planning-metric ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }
function Stat({ label, value, danger }) { return <div className="budget-stat"><span>{label}</span><strong className={danger ? 'danger-copy' : ''}>{value}</strong></div> }
function num(value) { return Number(value) || 0 }
function sum(values) { return values.reduce((acc, value) => acc + num(value), 0) }
function money(value, currency) { return formatMoney(value, currency || 'USD') }
function costTypeLabel(value) { return value === 'per_guest' ? 'Costo por invitado' : value === 'mixed' ? 'Costo mixto' : 'Costo fijo' }
function baseItemAmount(item) { return num(item.contracted_amount) || num(item.quoted_amount) || num(item.estimated_amount) }
function simulate(items, guests) {
  let fixed = 0
  let variable = 0
  for (const item of items) {
    if (item.variable_per_guest && num(item.unit_amount) > 0) variable += num(item.unit_amount) * guests
    else fixed += baseItemAmount(item)
  }
  return { fixed, variable, total: fixed + variable }
}
function roundMoney(value, currency) { return currency === 'PYG' ? Math.round(value) : Math.round(value * 100) / 100 }
function formatPercent(value) { return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%` }
