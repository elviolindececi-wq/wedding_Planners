import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import PaymentModal from './PaymentModal.jsx'

export default function PaymentsPage() {
  const { event } = useOutletContext()
  const [payments, setPayments] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [paymentRes, itemRes] = await Promise.all([
      supabase.from('vendor_payments').select('*').eq('event_id', event.id).order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('budget_items').select('id,description,category_id').eq('event_id', event.id).order('description'),
    ])
    const firstError = paymentRes.error || itemRes.error
    if (firstError) setError(firstError.message)
    setPayments(paymentRes.data || [])
    setItems(itemRes.data || [])
    setLoading(false)
  }, [event.id])

  useEffect(() => { loadAll() }, [loadAll])

  const today = new Date().toISOString().slice(0, 10)
  const rows = useMemo(() => payments.map(payment => ({ ...payment, effectiveStatus: effectiveStatus(payment, today) })), [payments, today])
  const visible = rows.filter(row => filter === 'all' || row.effectiveStatus === filter)
  const paid = sum(rows.filter(row => row.status === 'paid').map(row => row.amount))
  const overdue = rows.filter(row => row.effectiveStatus === 'overdue')
  const dueSoon = rows.filter(row => row.status === 'pending' && row.due_date && row.due_date >= today && daysBetween(today, row.due_date) <= 30)
  const pending = sum(rows.filter(row => ['pending','overdue'].includes(row.effectiveStatus)).map(row => row.amount))
  const itemMap = new Map(items.map(item => [item.id, item.description]))
  const currency = event.currency || 'USD'

  async function markPaid(payment) {
    const { error: updateError } = await supabase.from('vendor_payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id).eq('event_id', event.id)
    if (updateError) setError(updateError.message)
    else loadAll()
  }

  async function removePayment(payment) {
    if (!window.confirm(`¿Eliminar el pago “${payment.description || 'sin concepto'}”?`)) return
    const { error: deleteError } = await supabase.from('vendor_payments').delete().eq('id', payment.id).eq('event_id', event.id)
    if (deleteError) setError(deleteError.message)
    else loadAll()
  }

  return <section className="payments-page">
    <div className="module-heading"><div><p className="eyebrow">PAGOS</p><h2>Pagos del evento</h2><p>Señas, cuotas, saldos, vencimientos y comprobantes vinculados al presupuesto del evento.</p></div><button className="primary-btn" onClick={() => { setEditing(null); setModal(true) }}>+ Nuevo pago</button></div>
    <div className="planning-metrics payment-metrics"><Metric label="Pagado" value={money(paid, currency)} detail="Pagos confirmados" /><Metric label="Pendiente" value={money(pending, currency)} detail="Compromisos abiertos" /><Metric label="Por vencer" value={dueSoon.length} detail="Próximos 30 días" /><Metric label="Vencidos" value={overdue.length} detail={overdue.length ? 'Requieren seguimiento' : 'Todo al día'} danger={overdue.length > 0} /></div>
    <div className="payment-filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todos</button><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Pendientes</button><button className={filter === 'overdue' ? 'active' : ''} onClick={() => setFilter('overdue')}>Vencidos</button><button className={filter === 'paid' ? 'active' : ''} onClick={() => setFilter('paid')}>Pagados</button></div>
    {error && <p className="form-error">{error}</p>}
    {loading ? <div className="panel loading-panel">Cargando pagos…</div> : visible.length ? <div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Concepto</th><th>Presupuesto</th><th>Fecha pactada</th><th>Importe</th><th>Estado</th><th>Medio</th><th></th></tr></thead><tbody>{visible.map(payment => <tr key={payment.id} className={payment.effectiveStatus === 'overdue' ? 'is-overdue' : ''}><td><strong>{payment.description || 'Pago'}</strong>{payment.receipt_url && <a href={payment.receipt_url} target="_blank" rel="noreferrer">Ver comprobante</a>}</td><td>{itemMap.get(payment.budget_item_id) || '—'}</td><td>{payment.due_date ? formatDate(payment.due_date) : 'Sin fecha'}</td><td>{money(payment.amount, payment.currency || currency)}</td><td><span className={`payment-status payment-status-${payment.effectiveStatus}`}>{statusLabel(payment.effectiveStatus)}</span></td><td>{payment.payment_method || '—'}</td><td><div className="payment-actions">{payment.status !== 'paid' && payment.status !== 'canceled' && <button className="text-action" onClick={() => markPaid(payment)}>Marcar pagado</button>}<button className="text-action" onClick={() => { setEditing(payment); setModal(true) }}>Editar</button><button className="text-action danger-action" onClick={() => removePayment(payment)}>Eliminar</button></div></td></tr>)}</tbody></table></div> : <div className="panel empty-state"><p className="eyebrow">PAGOS</p><h2>Todavía no hay pagos</h2><p>Agregá señas, cuotas y saldos para controlar qué vence y qué ya fue pagado.</p><button className="primary-btn" onClick={() => { setEditing(null); setModal(true) }}>Crear primer pago</button></div>}
    <PaymentModal open={modal} event={event} items={items} payment={editing} onClose={() => setModal(false)} onSaved={async () => { setModal(false); await loadAll() }} />
  </section>
}

function Metric({ label, value, detail, danger }) { return <article className={`planning-metric ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }
function effectiveStatus(payment, today) { if (payment.status === 'paid' || payment.status === 'canceled') return payment.status; if (payment.due_date && payment.due_date < today) return 'overdue'; return 'pending' }
function statusLabel(value) { return ({ paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido', canceled: 'Cancelado' })[value] || value }
function sum(values) { return values.reduce((acc, value) => acc + (Number(value) || 0), 0) }
function money(value, currency) { return new Intl.NumberFormat('es-PY', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: currency === 'PYG' ? 0 : 2 }).format(Number(value) || 0) }
function formatDate(value) { return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function daysBetween(from, to) { return Math.ceil((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) }
