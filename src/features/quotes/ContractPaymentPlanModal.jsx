import { useEffect, useMemo, useState } from 'react'
import MoneyInput from '../../components/MoneyInput.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatMoney } from '../../lib/money.js'
import { paymentPayloadAmounts } from '../../lib/paymentMoney.js'

export default function ContractPaymentPlanModal({ open, event, quote, budgetItemId, eventVendorId, onClose, onSaved }) {
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !quote) return
    setError('')
    const total = Number(quote.amount || 0)
    const deposit = Math.min(total, Number(quote.deposit_amount || 0))
    const finalDate = suggestedFinalDate(event?.event_date)
    const initial = deposit > 0
      ? [paymentRow('Seña', deposit), paymentRow('Saldo final', Math.max(0,total-deposit), finalDate)]
      : [paymentRow('Pago total', total, finalDate)]
    setRows(initial)
  }, [open, quote?.id])

  const total = Number(quote?.amount || 0)
  const programmed = useMemo(() => rows.reduce((sum,row)=>sum+(Number(row.amount)||0),0),[rows])
  const difference = total - programmed

  if (!open || !quote) return null

  function updateRow(id, patch){ setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row)) }
  function removeRow(id){ setRows(current=>current.filter(row=>row.id!==id)) }
  function addRow(){ setRows(current=>[...current,paymentRow(`Cuota ${current.length+1}`,'')]) }
  function usePreset(kind){
    const finalDate=suggestedFinalDate(event?.event_date)
    if(kind==='total') return setRows([paymentRow('Pago total',total,finalDate)])
    if(kind==='deposit'){ const first=Math.round(total*.3*100)/100; return setRows([paymentRow('Seña',first),paymentRow('Saldo final',total-first,finalDate)]) }
    const first=Math.round(total/3*100)/100; const second=first; const third=Math.round((total-first-second)*100)/100; setRows([paymentRow('Seña',first),paymentRow('Cuota 2',second),paymentRow('Saldo final',third,finalDate)])
  }

  async function savePlan(e){
    e.preventDefault()
    if (!rows.length) return setError('Agregá al menos un pago o elegí “Lo cargo después”.')
    if (Math.abs(difference) > 0.01) return setError(`El plan debe sumar exactamente ${formatMoney(total,quote.currency)}. Diferencia: ${formatMoney(difference,quote.currency)}.`)
    if (rows.some(row=>!(Number(row.amount)>0))) return setError('Todos los pagos deben tener un importe mayor a cero.')
    setSaving(true); setError('')
    try {
      const payloads = rows.map(row => ({
        id:crypto.randomUUID(), event_id:event.id, event_vendor_id:eventVendorId || null, budget_item_id:budgetItemId || null,
        description:row.description.trim() || 'Pago',
        ...paymentPayloadAmounts({ amount:row.amount,currency:quote.currency,eventCurrency:event.currency,exchangeRate:quote.currency===event.currency?1:quote.exchange_rate,exchangeRateSource:quote.exchange_rate_source,exchangeRateDate:quote.exchange_rate_date }),
        due_date:row.due_date || null, status:'pending', paid_at:null, payment_method:null, receipt_url:null,
        notes:'Creado desde el plan de pagos de la cotización contratada.',
      }))
      const {error:insertError}=await supabase.from('vendor_payments').insert(payloads)
      if(insertError) throw insertError
      onSaved?.()
    } catch(e2){ setError(e2.message) }
    setSaving(false)
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose?.()}>
    <form className="modal-card contract-plan-modal" onSubmit={savePlan}>
      <div className="modal-head"><div><p className="eyebrow">PASO 3 · PLAN DE PAGOS</p><h2>¿Cómo se pagará este proveedor?</h2><p>La cotización ya pasó a Contratada y Presupuesto ya fue actualizado. Solo falta programar los vencimientos.</p></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>
      <div className="contract-plan-summary"><div><span>Contrato</span><strong>{formatMoney(total,quote.currency)}</strong></div><div><span>Equivalente presupuesto</span><strong>{formatMoney(total*Number(quote.currency===event.currency?1:quote.exchange_rate||0),event.currency)}</strong></div><div><span>Programado</span><strong>{formatMoney(programmed,quote.currency)}</strong></div><div className={Math.abs(difference)>0.01?'danger-copy':''}><span>Diferencia</span><strong>{formatMoney(difference,quote.currency)}</strong></div></div>
      <div className="payment-plan-presets"><span>Atajos</span><button type="button" className="secondary-btn" onClick={()=>usePreset('total')}>Pago total</button><button type="button" className="secondary-btn" onClick={()=>usePreset('deposit')}>30% seña + saldo</button><button type="button" className="secondary-btn" onClick={()=>usePreset('three')}>3 pagos</button></div>
      <div className="payment-plan-rows">
        {rows.map((row,index)=><div className="payment-plan-row" key={row.id}>
          <label>Concepto<input value={row.description} onChange={e=>updateRow(row.id,{description:e.target.value})} placeholder={`Cuota ${index+1}`}/></label>
          <label>Importe<MoneyInput currency={quote.currency} value={row.amount} onChange={amount=>updateRow(row.id,{amount})}/></label>
          <label>Fecha pactada<input type="date" value={row.due_date} onChange={e=>updateRow(row.id,{due_date:e.target.value})}/></label>
          <button type="button" className="text-action danger-action" onClick={()=>removeRow(row.id)} disabled={rows.length===1}>Quitar</button>
        </div>)}
      </div>
      <button type="button" className="secondary-btn" onClick={addRow}>+ Agregar cuota</button>
      {quote.currency!==event.currency&&<div className="conversion-preview"><span>Tipo de cambio guardado en la contratación</span><strong>1 {quote.currency} = {Number(quote.exchange_rate||0).toLocaleString('es-PY')} {event.currency}</strong><small>Cada pago conservará {quote.currency} y su equivalente histórico en {event.currency}.</small></div>}
      {error&&<p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Lo cargo después</button><button className="primary-btn" disabled={saving||Math.abs(difference)>0.01}>{saving?'Creando…':'Crear plan de pagos'}</button></div>
    </form>
  </div>
}
function paymentRow(description,amount,dueDate=''){return{id:crypto.randomUUID(),description,amount:amount===0?'':String(amount),due_date:dueDate||''}}
function suggestedFinalDate(eventDate){if(!eventDate)return'';const d=new Date(`${eventDate}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-7);return d.toISOString().slice(0,10)}
