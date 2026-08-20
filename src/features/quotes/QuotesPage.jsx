import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'
import { formatMoney } from '../../lib/money.js'
import QuoteModal from './QuoteModal.jsx'
import ContractPaymentPlanModal from './ContractPaymentPlanModal.jsx'

export default function QuotesPage({ embedded=false, onDataChanged }){
  const {event}=useOutletContext(); const {organization}=useOrganization()
  const [quotes,setQuotes]=useState([]); const [vendors,setVendors]=useState([]); const [assignments,setAssignments]=useState([]); const [categories,setCategories]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [modal,setModal]=useState(false); const [editing,setEditing]=useState(null); const [categoryFilter,setCategoryFilter]=useState('all'); const [busy,setBusy]=useState(''); const [plan,setPlan]=useState(null)

  const loadAll=useCallback(async()=>{setLoading(true);setError('');const [q,v,a,c]=await Promise.all([
    supabase.from('quotes').select('*,vendors(company_name,contact_name)').eq('event_id',event.id).order('created_at',{ascending:false}),
    supabase.from('vendors').select('*').eq('organization_id',organization.id).order('company_name'),
    supabase.from('event_vendors').select('*,vendors(company_name)').eq('event_id',event.id),
    supabase.from('budget_categories').select('*').eq('event_id',event.id).order('sort_order'),
  ]);const first=q.error||v.error||a.error||c.error;if(first)setError(first.message);setQuotes(q.data||[]);setVendors(v.data||[]);setAssignments(a.data||[]);setCategories(c.data||[]);setLoading(false)},[event.id,organization.id])
  useEffect(()=>{loadAll()},[loadAll])
  const categoryMap=useMemo(()=>new Map(categories.map(c=>[c.id,c.name])),[categories]); const visible=quotes.filter(q=>categoryFilter==='all'||q.budget_category_id===categoryFilter)
  const assignmentByKey=useMemo(()=>new Map(assignments.map(a=>[`${a.vendor_id}:${a.budget_category_id}`,a])),[assignments])
  const selected=quotes.filter(q=>q.is_selected).length; const expiring=quotes.filter(q=>q.valid_until&&q.valid_until>=today()&&daysBetween(today(),q.valid_until)<=15).length

  async function applyQuote(quote,contract){
    if (needsExchangeRate(quote,event.currency)) { setError(`Antes de ${contract ? 'contratar' : 'seleccionar'}, definí un tipo de cambio real para ${quote.currency} → ${event.currency}.`); return }
    setBusy(`${quote.id}:${contract?'contract':'select'}`);setError('')
    const {data:itemId,error:rpcError}=await supabase.rpc('apply_quote_to_budget',{p_quote_id:quote.id,p_contract:contract})
    setBusy('')
    if(rpcError)return setError(friendlyRpcError(rpcError.message))
    await loadAll(); onDataChanged?.()
    if(contract&&itemId){
      const {data:item,error:itemError}=await supabase.from('budget_items').select('id,event_vendor_id').eq('id',itemId).maybeSingle()
      if(itemError)return setError(itemError.message)
      setPlan({quote:{...quote,is_selected:true},budgetItemId:item?.id||itemId,eventVendorId:item?.event_vendor_id||null})
    }
  }
  async function removeQuote(q){if(!window.confirm('¿Eliminar esta cotización?'))return;const {error:e}=await supabase.from('quotes').delete().eq('id',q.id).eq('event_id',event.id);if(e)setError(e.message);else{await loadAll();onDataChanged?.()}}

  return <section className={`quotes-page ${embedded?'quotes-embedded':''}`}>
    <div className="module-heading"><div><p className="eyebrow">COTIZACIONES</p><h2>Comparar antes de contratar</h2><p>Seleccionar actualiza “Cotizado” en Presupuesto. Contratar actualiza “Contratado” y te ofrece crear el plan de pagos en el mismo flujo.</p></div><button className="primary-btn" onClick={()=>{setEditing(null);setModal(true)}}>+ Nueva cotización</button></div>
    <div className="planning-metrics"><Metric label="Cotizaciones" value={quotes.length} detail="Propuestas cargadas"/><Metric label="Seleccionadas" value={selected} detail="Referencias elegidas"/><Metric label="Por vencer" value={expiring} detail="Próximos 15 días"/><Metric label="Moneda base" value={event.currency} detail="Equivalente presupuestario"/></div>
    <div className="quotes-toolbar"><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">Todas las categorías</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><span className="linked-flow-note">Cotización → Presupuesto → Contrato → Pagos</span></div>
    {error&&<p className="form-error">{error}</p>}
    {loading?<div className="panel loading-panel">Cargando cotizaciones…</div>:visible.length?<div className="quote-table-wrap"><table className="quote-table"><thead><tr><th>Categoría / proveedor</th><th>Propuesta</th><th>Importe original</th><th>Equivalente</th><th>Condiciones</th><th>Vigencia</th><th>Estado</th><th>Próximo paso</th></tr></thead><tbody>{visible.map(q=>{const equivalent=toEventAmount(q.amount,q.currency,event.currency,q.exchange_rate);const assignment=assignmentByKey.get(`${q.vendor_id}:${q.budget_category_id}`);const contracted=Boolean(q.is_selected&&['contracted','completed'].includes(assignment?.status));const rateWarning=needsExchangeRate(q,event.currency);return <tr key={q.id} className={q.is_selected?'is-selected':''}><td><span className="pill">{categoryMap.get(q.budget_category_id)||'Sin categoría'}</span><strong>{q.vendors?.company_name||'Proveedor'}</strong>{q.rating?<small>{'★'.repeat(q.rating)}</small>:null}</td><td><strong>{q.title||'Cotización'}</strong>{q.includes&&<small className="quote-clip">{q.includes}</small>}</td><td><strong>{formatMoney(q.amount,q.currency)}</strong>{q.currency!==event.currency&&<small className={rateWarning?'danger-copy':''}>{rateWarning?'TC pendiente':`TC ${Number(q.exchange_rate||0).toLocaleString('es-PY')}`}</small>}</td><td>{rateWarning?<><strong>—</strong><small className="danger-copy">Definí el TC para calcular</small></>:<><strong>{formatMoney(equivalent,event.currency)}</strong>{q.currency!==event.currency&&<small>{q.exchange_rate_source||'Manual'}{q.exchange_rate_date?` · ${q.exchange_rate_date}`:''}</small>}</>}</td><td>{q.deposit_amount?<span>Seña {formatMoney(q.deposit_amount,q.currency)}</span>:<span>—</span>}{q.payment_terms&&<small className="quote-clip">{q.payment_terms}</small>}</td><td>{q.valid_until?formatDate(q.valid_until):'Sin fecha'}</td><td>{contracted?<span className="payment-status payment-status-paid">Contratada</span>:q.is_selected?<span className="payment-status payment-status-partial">Seleccionada</span>:<span className="payment-status payment-status-pending">En evaluación</span>}</td><td><div className="quote-actions quote-next-actions">{contracted?<span className="flow-complete-note">✓ Ya contratada</span>:q.is_selected?<button className="primary-btn compact-cta" disabled={busy||rateWarning} onClick={()=>applyQuote(q,true)}>{busy===`${q.id}:contract`?'Contratando…':'Contratar proveedor'}</button>:<button className="primary-btn compact-cta" disabled={busy||rateWarning} onClick={()=>applyQuote(q,false)}>{busy===`${q.id}:select`?'Aplicando…':'Seleccionar cotización'}</button>}<button className="text-action" onClick={()=>{setEditing(q);setModal(true)}}>{rateWarning?'Corregir TC':'Editar'}</button><details className="row-more-menu"><summary>···</summary><div><button className="text-action danger-action" onClick={()=>removeQuote(q)}>Eliminar</button></div></details></div></td></tr>})}</tbody></table></div>:<div className="panel empty-state"><p className="eyebrow">COTIZACIONES</p><h2>Todavía no cargaste cotizaciones</h2><p>Cargá propuestas de un mismo rubro para comparar precio, alcance, moneda, seña, vigencia y condiciones.</p><button className="primary-btn" onClick={()=>setModal(true)}>Crear primera cotización</button></div>}
    <QuoteModal open={modal} event={event} vendors={vendors} assignments={assignments} categories={categories} quote={editing} onClose={()=>setModal(false)} onSaved={async()=>{setModal(false);await loadAll();onDataChanged?.()}}/>
    <ContractPaymentPlanModal open={Boolean(plan)} event={event} quote={plan?.quote} budgetItemId={plan?.budgetItemId} eventVendorId={plan?.eventVendorId} onClose={()=>setPlan(null)} onSaved={async()=>{setPlan(null);await loadAll();onDataChanged?.()}}/>
  </section>
}
function Metric({label,value,detail}){return <article className="planning-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>}
function toEventAmount(amount,from,to,rate){if(from===to)return Number(amount)||0;return (Number(amount)||0)*(Number(rate)||0)}
function today(){return new Date().toISOString().slice(0,10)}
function daysBetween(a,b){return Math.ceil((new Date(`${b}T00:00:00Z`)-new Date(`${a}T00:00:00Z`))/86400000)}
function formatDate(v){return new Intl.DateTimeFormat('es-PY',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${v}T00:00:00Z`))}
function needsExchangeRate(q,eventCurrency){return q.currency!==eventCurrency&&(!(Number(q.exchange_rate)>0)||Number(q.exchange_rate)===1)}
function friendlyRpcError(message){if(message.includes('exchange_rate_required'))return 'La cotización necesita un tipo de cambio antes de vincularla al presupuesto.';if(message.includes('budget_category_required'))return 'La cotización debe tener una categoría de presupuesto.';return message}
