import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useOrganization } from '../../organization/OrganizationProvider.jsx'
import { formatMoney } from '../../lib/money.js'
import { CURRENCIES } from '../../lib/currencies.js'
import { fetchExchangeRate } from '../../lib/exchangeRates.js'
import { downloadWorkbook, findHeader, normalizeSpreadsheetKey, readWorkbook, sheetRows, spreadsheetDate, spreadsheetNumber } from '../../lib/spreadsheets.js'
import EventVendorModal from './EventVendorModal.jsx'
import VendorPaymentModal from './VendorPaymentModal.jsx'
import QuotesPage from '../quotes/QuotesPage.jsx'
import { paymentEventAmount, paymentPayloadAmounts } from '../../lib/paymentMoney.js'

const STATUS_LABELS = { considering:'Evaluando', quoted:'Cotizado', selected:'Reservado', contracted:'Contratado', completed:'Finalizado', declined:'Descartado' }
const IMPORT_STATUS = { evaluando:'considering', cotizando:'quoted', cotizado:'quoted', reservado:'selected', seleccionado:'selected', contratado:'contracted', finalizado:'completed', completado:'completed', descartado:'declined' }

export default function EventVendorsPage() {
  const { event } = useOutletContext()
  const { organization } = useOrganization()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const section = urlSearchParams.get('seccion') || 'proveedores'
  const [vendors, setVendors] = useState([])
  const [assignments, setAssignments] = useState([])
  const [categories, setCategories] = useState([])
  const [payments, setPayments] = useState([])
  const [quotes, setQuotes] = useState([])
  const [budgetItems, setBudgetItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [paymentFor, setPaymentFor] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    const [vendorRes, assignmentRes, categoryRes, paymentRes, quoteRes, itemRes] = await Promise.all([
      supabase.from('vendors').select('*').eq('organization_id', organization.id).order('company_name'),
      supabase.from('event_vendors').select('*,vendors(*)').eq('event_id', event.id).order('created_at'),
      supabase.from('budget_categories').select('*').eq('event_id', event.id).order('sort_order'),
      supabase.from('vendor_payments').select('*').eq('event_id', event.id).order('due_date', { ascending:true, nullsFirst:false }),
      supabase.from('quotes').select('*,vendors(company_name)').eq('event_id', event.id).order('created_at'),
      supabase.from('budget_items').select('*').eq('event_id', event.id).order('created_at'),
    ])
    const firstError = vendorRes.error || assignmentRes.error || categoryRes.error || paymentRes.error || quoteRes.error || itemRes.error
    if (firstError) setError(firstError.message)
    setVendors(vendorRes.data || []); setAssignments(assignmentRes.data || []); setCategories(categoryRes.data || []); setPayments(paymentRes.data || []); setQuotes(quoteRes.data || []); setBudgetItems(itemRes.data || []); setLoading(false)
  }, [event.id, organization.id])

  useEffect(() => { loadAll() }, [loadAll])

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id,c.name])), [categories])
  const itemByVendor = useMemo(() => new Map(budgetItems.filter(i => i.event_vendor_id).map(i => [i.event_vendor_id,i])), [budgetItems])
  const paymentSummary = useMemo(() => {
    const map = new Map()
    for (const assignment of assignments) {
      const item = itemByVendor.get(assignment.id)
      const related = payments.filter(p => p.event_vendor_id === assignment.id || (item && p.budget_item_id === item.id))
      const paid = related.filter(p => p.status === 'paid').reduce((sum,p) => sum + paymentEventAmount(p, event.currency), 0)
      const today = new Date().toISOString().slice(0,10)
      const open = related.filter(p => p.status !== 'paid' && p.status !== 'canceled')
      const next = [...open].filter(p => p.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date))[0]
      const overdue = open.some(p => p.due_date && p.due_date < today)
      const contracted = toEventAmount(assignment.contracted_amount, assignment.currency, event.currency, assignment.exchange_rate)
      const pending = Math.max(0, contracted - paid)
      map.set(assignment.id, { related, paid, pending, next, overdue, item, contracted })
    }
    return map
  }, [assignments, payments, itemByVendor, event.currency])

  const enriched = useMemo(() => assignments.map(row => ({ ...row, finance:paymentSummary.get(row.id) || {} })), [assignments, paymentSummary])
  const visible = enriched.filter(row => {
    if (categoryFilter !== 'all' && row.budget_category_id !== categoryFilter) return false
    if (statusFilter !== 'all') {
      if (statusFilter === 'paid' && financialStatus(row).key !== 'paid') return false
      if (statusFilter === 'pending' && !['pending','partial','overdue'].includes(financialStatus(row).key)) return false
      if (!['paid','pending'].includes(statusFilter) && row.status !== statusFilter) return false
    }
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [row.vendors?.company_name,row.vendors?.contact_name,row.vendors?.phone,row.vendors?.email,row.service_category,categoryMap.get(row.budget_category_id),row.notes].filter(Boolean).some(x => x.toLowerCase().includes(q))
  })

  const displayRows = section === 'contratos' ? visible.filter(row => ['contracted','completed'].includes(row.status)) : visible

  function switchSection(next) {
    const params = new URLSearchParams(urlSearchParams)
    if (next === 'proveedores') params.delete('seccion')
    else params.set('seccion', next)
    setUrlSearchParams(params, { replace:true })
  }

  const totalQuoted = enriched.filter(a => a.status !== 'declined').reduce((sum,a) => sum + toEventAmount(a.quoted_amount,a.currency,event.currency,a.exchange_rate),0)
  const totalContracted = enriched.filter(a => !['declined','considering','quoted'].includes(a.status)).reduce((sum,a) => sum + toEventAmount(a.contracted_amount,a.currency,event.currency,a.exchange_rate),0)
  const totalPaid = enriched.reduce((sum,a) => sum + Number(a.finance?.paid || 0),0)
  const totalPending = Math.max(0,totalContracted-totalPaid)

  async function removeAssignment(row) {
    if (!window.confirm(`¿Quitar a “${row.vendors?.company_name || 'este proveedor'}” de este evento? El contacto seguirá en tu directorio.`)) return
    const hasPayments = payments.some(p => p.event_vendor_id === row.id || p.budget_item_id === itemByVendor.get(row.id)?.id)
    if (hasPayments) return window.alert('Este proveedor tiene pagos vinculados. Eliminá o reasigná esos pagos antes de quitarlo del evento.')
    const { error: deleteError } = await supabase.from('event_vendors').delete().eq('id', row.id).eq('event_id', event.id)
    if (deleteError) setError(deleteError.message); else loadAll()
  }

  async function exportExcel() {
    if (!assignments.length) return setNotice('Todavía no hay proveedores del evento para exportar.')
    setError(''); setNotice('')
    try {
      await downloadWorkbook(`proveedores_${safeName(event.name)}.xlsx`, async (XL, workbook) => {
        appendInstructions(XL, workbook, event)
        appendProvidersSheet(XL, workbook, enriched, categoryMap, event)
        appendQuotesSheet(XL, workbook, quotes, categoryMap, event)
        appendPaymentsSheet(XL, workbook, payments, assignments, categoryMap, event)
      })
      setNotice('✓ Proveedores, cotizaciones y pagos exportados. Podés editar el archivo y volver a importarlo.')
    } catch (e) { setError(e.message) }
  }

  async function downloadTemplate() {
    setError(''); setNotice('')
    try {
      const response = await fetch('/plantilla_proveedores.xlsx', { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo abrir la plantilla guiada.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plantilla_proveedores_${safeName(event.name)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setNotice('✓ Plantilla guiada descargada: incluye ejemplo, listas desplegables, ayudas y cálculos automáticos.')
    } catch (e) { setError(e.message) }
  }

  async function importExcel(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true); setError(''); setNotice('')
    try {
      const { XL, workbook } = await readWorkbook(file)
      const providerRows = sheetRows(XL, workbook, 'Proveedores')
      if (!providerRows.length) throw new Error('No encontré la hoja “Proveedores”. Usá la plantilla descargada desde el sistema.')
      const quoteRows = sheetRows(XL, workbook, 'Cotizaciones')
      const paymentRows = sheetRows(XL, workbook, 'Pagos')
      const preview = { providers:countSheetRecords(providerRows,'proveedor'), quotes:countSheetRecords(quoteRows,'proveedor'), payments:countSheetRecords(paymentRows,'proveedor') }
      const okay = window.confirm(`Vista previa de importación\n\nProveedores: ${preview.providers}\nCotizaciones: ${preview.quotes}\nPagos: ${preview.payments}\n\nEl sistema actualizará filas con ID y creará las nuevas. ¿Querés continuar?`)
      if (!okay) { setImporting(false); return }
      const providerResult = await importProviderRows(providerRows, { event, organization, vendors, assignments, categories })
      await loadAll()
      const refreshedAssignments = await supabase.from('event_vendors').select('*,vendors(*)').eq('event_id', event.id)
      const refreshedItems = await supabase.from('budget_items').select('*').eq('event_id', event.id)
      const refreshedVendors = await supabase.from('vendors').select('*').eq('organization_id', organization.id); const refreshedCategories = await supabase.from('budget_categories').select('*').eq('event_id', event.id); const quoteCount = quoteRows.length ? await importQuoteRows(quoteRows, { event, vendors:refreshedVendors.data || [], assignments:refreshedAssignments.data || [], categories:refreshedCategories.data || [] }) : 0
      let paymentCount = 0
      if (paymentRows.length) paymentCount = await importPaymentRows(paymentRows, { event, assignments:refreshedAssignments.data || [], budgetItems:refreshedItems.data || [] })
      await loadAll()
      setNotice(`✓ Importación terminada: ${providerResult.count} proveedores, ${quoteCount} cotizaciones y ${paymentCount} pagos procesados.${providerResult.warnings.length ? ` ${providerResult.warnings.join(' ')}` : ''}`)
    } catch (err) { setError(err.message || 'No pudimos importar el archivo.') }
    setImporting(false)
  }

  return <section className="event-vendors-page">
    <div className="module-heading"><div><p className="eyebrow">PROVEEDORES</p><h2>Proveedores de {event.name}</h2><p>Un solo lugar para ver contacto, cotizar, contratar y seguir pagos sin volver a cargar datos.</p></div>{section !== 'cotizaciones' && section !== 'excel' && <button className="primary-btn" onClick={() => { setEditing(null); setModal(true) }}>+ Agregar proveedor</button>}</div>

    <nav className="vendor-section-tabs" aria-label="Secciones de proveedores">
      <button className={section === 'proveedores' ? 'active' : ''} onClick={() => switchSection('proveedores')}>Todos</button>
      <button className={section === 'cotizaciones' ? 'active' : ''} onClick={() => switchSection('cotizaciones')}>Cotizaciones</button>
      <button className={section === 'contratos' ? 'active' : ''} onClick={() => switchSection('contratos')}>Contratados</button>
      <button className={section === 'excel' ? 'active' : ''} onClick={() => switchSection('excel')}>Excel</button>
    </nav>

    {section === 'cotizaciones' ? <QuotesPage embedded onDataChanged={loadAll} /> : section === 'excel' ? <>
      <section className="panel vendor-excel-panel vendor-excel-standalone" aria-label="Importar y exportar proveedores en Excel">
        <div><p className="eyebrow">EXCEL</p><h3>Trabajá en Excel sin perder vínculos</h3><p>Descargá la plantilla guiada, completá proveedores, cotizaciones y pagos, volvé a subirla o exportá los datos actuales. Los IDs permiten actualizar filas sin duplicar.</p></div>
        <div className="vendor-excel-actions">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importExcel} hidden />
          <button className="secondary-btn" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importando…' : '↑ Importar archivo'}</button>
          <button className="primary-btn" onClick={exportExcel} disabled={!assignments.length}>↓ Exportar datos</button>
          <button className="secondary-btn" onClick={downloadTemplate}>Descargar plantilla guiada</button>
        </div>
      </section>
      {notice && <p className="form-notice">{notice}</p>}{error && <p className="form-error">{error}</p>}
    </> : <>
      <div className="planning-metrics vendor-finance-metrics">
        <Metric label={section === 'contratos' ? 'Contratos' : 'Proveedores'} value={section === 'contratos' ? enriched.filter(a => ['contracted','completed'].includes(a.status)).length : assignments.length} detail={section === 'contratos' ? 'Con contrato / contratación confirmada' : 'En este evento'} />
        <Metric label="Cotizado" value={formatMoney(totalQuoted,event.currency)} detail="Equivalente presupuesto" />
        <Metric label="Contratado" value={formatMoney(totalContracted,event.currency)} detail="Compromiso actual" />
        <Metric label="Pagado" value={formatMoney(totalPaid,event.currency)} detail="Pagos confirmados" />
        <Metric label="Pendiente" value={formatMoney(totalPending,event.currency)} detail="Saldo por cubrir" danger={totalPending>0} />
      </div>

      {notice && <p className="form-notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="vendor-event-actions vendor-filter-grid">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, contacto o nota…" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos los estados</option><option value="considering">Evaluando</option><option value="quoted">Cotizado</option><option value="selected">Reservado</option><option value="contracted">Contratado</option><option value="paid">Pagado</option><option value="pending">Con saldo pendiente</option><option value="declined">Descartado</option></select>
        <button className="secondary-btn" onClick={() => switchSection('cotizaciones')}>Comparar cotizaciones</button>
        <Link className="secondary-btn" to="../pagos">Ver todos los pagos</Link>
      </div>

      {loading ? <div className="panel loading-panel">Cargando proveedores…</div> : displayRows.length ? <div className="vendor-table-wrap"><table className="vendor-management-table"><thead><tr><th>Proveedor</th><th>Servicio</th><th>Cotizado</th><th>Contratado</th><th>Pagado</th><th>Pendiente</th><th>Próximo pago</th><th>Estado</th><th></th></tr></thead><tbody>{displayRows.map(row => {
        const finance = row.finance || {}
        const fin = financialStatus(row)
        return <tr key={row.id} className={fin.key === 'overdue' ? 'is-overdue' : ''}>
          <td><strong>{row.vendors?.company_name || 'Proveedor'}</strong><small>{row.vendors?.contact_name || ''}{row.vendors?.phone ? ` · ${row.vendors.phone}` : ''}</small>{row.vendors?.email && <small>{row.vendors.email}</small>}</td>
          <td><span className="pill">{categoryMap.get(row.budget_category_id) || row.service_category || 'Sin categoría'}</span><small>{row.service_category || ''}</small></td>
          <td><strong>{row.quoted_amount == null ? '—' : formatMoney(row.quoted_amount,row.currency)}</strong>{row.currency !== event.currency && row.exchange_rate ? <small>≈ {formatMoney(toEventAmount(row.quoted_amount,row.currency,event.currency,row.exchange_rate),event.currency)}</small> : null}</td>
          <td><strong>{row.contracted_amount == null ? '—' : formatMoney(row.contracted_amount,row.currency)}</strong>{row.currency !== event.currency && row.exchange_rate ? <small>≈ {formatMoney(finance.contracted || 0,event.currency)}</small> : null}</td>
          <td><strong>{formatMoney(finance.paid || 0,event.currency)}</strong></td>
          <td><strong>{formatMoney(finance.pending || 0,event.currency)}</strong></td>
          <td>{finance.next?.due_date ? <><strong>{formatDate(finance.next.due_date)}</strong><small>{formatMoney(finance.next.amount,finance.next.currency || event.currency)}{(finance.next.currency || event.currency) !== event.currency ? ` · ≈ ${formatMoney(paymentEventAmount(finance.next,event.currency),event.currency)}` : ''}</small></> : '—'}</td>
          <td><div className="vendor-state-stack"><div><small>Proveedor</small><span className={`vendor-status vendor-status-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span></div><div><small>Pago</small><span className={`payment-status payment-status-${fin.key}`}>{fin.label}</span></div>{row.has_contract && <small className="contract-state">Contrato: Sí ✓</small>}</div></td>
          <td><div className="quote-actions"><button className="secondary-btn vendor-row-main-action" onClick={() => { setEditing(row); setModal(true) }}>Ver / editar</button>{['selected','contracted','completed'].includes(row.status) && <button className="text-action strong-action" onClick={() => setPaymentFor(row)}>+ Registrar pago</button>}<details className="row-more-menu"><summary>···</summary><div><button className="text-action danger-action" onClick={() => removeAssignment(row)}>Quitar del evento</button></div></details></div></td>
        </tr>
      })}</tbody></table></div> : <div className="panel empty-state"><p className="eyebrow">{section === 'contratos' ? 'CONTRATOS' : 'PROVEEDORES'}</p><h2>{section === 'contratos' ? 'Todavía no hay proveedores contratados' : assignments.length ? 'No hay coincidencias' : 'Todavía no agregaste proveedores a este evento'}</h2><p>{section === 'contratos' ? 'Cuando contrates una cotización o cambies el estado de un proveedor, aparecerá acá con su plan de pagos.' : 'Elegí uno de tu directorio o crealo acá mismo. Después podés cotizar, contratar y registrar pagos sin salir de este evento.'}</p><div className="empty-actions"><button className="primary-btn" onClick={() => setModal(true)}>Agregar proveedor</button>{section !== 'contratos' && <button className="secondary-btn" onClick={() => switchSection('cotizaciones')}>Cargar cotización</button>}</div></div>}
    </>}

    <EventVendorModal open={modal} event={event} vendors={vendors} categories={categories} assignment={editing} onClose={() => setModal(false)} onSaved={async () => { setModal(false); await loadAll() }}/>
    <VendorPaymentModal open={Boolean(paymentFor)} event={event} assignment={paymentFor} budgetItem={paymentFor ? itemByVendor.get(paymentFor.id) : null} onClose={() => setPaymentFor(null)} onSaved={async () => { setPaymentFor(null); await loadAll() }}/>
  </section>
}

function Metric({ label,value,detail,danger }) { return <article className={`planning-metric ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }
function toEventAmount(amount, from, to, rate) { if (amount == null) return 0; if (from === to) return Number(amount)||0; return (Number(amount)||0) * (Number(rate)||0) }
function financialStatus(row) { const f=row.finance||{}; if (f.overdue) return {key:'overdue',label:'Vencido'}; if ((f.contracted||0)>0 && (f.pending||0)<=0) return {key:'paid',label:'Pagado'}; if ((f.paid||0)>0) return {key:'partial',label:'Pago parcial'}; if ((f.contracted||0)>0) return {key:'pending',label:'Pendiente'}; return {key:'pending',label:'Sin pagos'} }
function formatDate(value) { return new Intl.DateTimeFormat('es-PY',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)) }
function safeName(value='evento'){ return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase() || 'evento' }
function yesNo(value){ return value ? 'Sí' : 'No' }

function appendInstructions(XL, workbook, event) {
  const rows = [
    ['PLANTILLA DE PROVEEDORES Y PAGOS'],
    ['Evento', event.name], ['Moneda base', event.currency],
    [],
    ['Cómo usarla'],
    ['1. Completá o editá la hoja Proveedores.'],
    ['2. Si querés, cargá señas/cuotas/saldos en la hoja Pagos.'],
    ['3. No borres los ID de filas exportadas: permiten actualizar sin duplicar. Para filas nuevas dejalos vacíos.'],
    [`4. Los pagos se consolidan en ${event.currency}. Los proveedores pueden conservar otra moneda y su tipo de cambio.`],
    ['5. Las columnas marcadas con ⚙ son informativas al exportar y se recalculan en el sistema.'],
  ]
  const ws = XL.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:90},{wch:28}]; XL.utils.book_append_sheet(workbook,ws,'LEEME')
}

function appendProvidersSheet(XL, workbook, rows, categoryMap, event) {
  const headers = ['ID proveedor evento','Proveedor','Categoría','Contacto','Teléfono','Email','Instagram / web','Servicio contratado','Precio cotizado','Precio contratado','Moneda','Tipo de cambio a '+event.currency,'Estado','Contrato','Contrato / enlace','⚙ Total pagado','⚙ Saldo pendiente','⚙ Próximo pago','Notas']
  const data = rows.map(row => [row.id,row.vendors?.company_name||'',categoryMap.get(row.budget_category_id)||row.service_category||'',row.vendors?.contact_name||'',row.vendors?.phone||'',row.vendors?.email||'',row.vendors?.instagram||row.vendors?.website||'',row.service_category||'',Number(row.quoted_amount||0),Number(row.contracted_amount||0),row.currency||event.currency,Number(row.exchange_rate||1),STATUS_LABELS[row.status]||row.status,yesNo(row.has_contract),row.contract_url||'',Number(row.finance?.paid||0),Number(row.finance?.pending||0),row.finance?.next?.due_date||'',row.notes||''])
  const ws = XL.utils.aoa_to_sheet([headers,...data]); ws['!cols']=[{wch:38},{wch:28},{wch:24},{wch:20},{wch:18},{wch:26},{wch:26},{wch:32},{wch:16},{wch:16},{wch:11},{wch:18},{wch:15},{wch:12},{wch:30},{wch:16},{wch:16},{wch:16},{wch:34}]; XL.utils.book_append_sheet(workbook,ws,'Proveedores')
}

function appendQuotesSheet(XL, workbook, quoteRows, categoryMap, event) {
  const headers=['ID cotización','Proveedor','Categoría','Título','Importe','Moneda','Tipo de cambio a '+event.currency,'Equivalente en '+event.currency,'Seña','Incluye','Extras / no incluye','Condiciones de pago','Vigencia','Valoración','Seleccionada','Notas']
  const data=quoteRows.map(q=>[q.id,q.vendors?.company_name||'',categoryMap.get(q.budget_category_id)||'',q.title||'',Number(q.amount||0),q.currency||event.currency,Number(q.exchange_rate||1),toEventAmount(q.amount,q.currency,event.currency,q.exchange_rate),Number(q.deposit_amount||0),q.includes||'',q.extras||'',q.payment_terms||'',q.valid_until||'',q.rating||'',q.is_selected?'Sí':'No',q.notes||''])
  const ws=XL.utils.aoa_to_sheet([headers,...data]); ws['!cols']=[{wch:38},{wch:28},{wch:24},{wch:28},{wch:16},{wch:11},{wch:18},{wch:18},{wch:16},{wch:36},{wch:32},{wch:34},{wch:15},{wch:12},{wch:13},{wch:34}]; XL.utils.book_append_sheet(workbook,ws,'Cotizaciones')
}

function appendPaymentsSheet(XL, workbook, paymentRows, assignments, categoryMap, event) {
  const assignmentMap = new Map(assignments.map(a => [a.id,a]))
  const headers = ['ID pago','Proveedor','Categoría','Concepto','Fecha pactada','Fecha pagada','Importe','Moneda','Tipo de cambio a '+event.currency,'Equivalente en '+event.currency,'Medio de pago','Estado','Comprobante / enlace','Notas']
  const data = paymentRows.map(p => { const a=assignmentMap.get(p.event_vendor_id); return [p.id,a?.vendors?.company_name||'',a ? (categoryMap.get(a.budget_category_id)||a.service_category||'') : '',p.description||'',p.due_date||'',p.paid_at ? String(p.paid_at).slice(0,10) : '',Number(p.amount||0),p.currency||event.currency,Number(p.exchange_rate||1),paymentEventAmount(p,event.currency),p.payment_method||'',p.status==='paid'?'Pagado':p.status==='canceled'?'Cancelado':'Pendiente',p.receipt_url||'',p.notes||''] })
  const ws = XL.utils.aoa_to_sheet([headers,...data]); ws['!cols']=[{wch:38},{wch:28},{wch:24},{wch:26},{wch:15},{wch:15},{wch:16},{wch:11},{wch:18},{wch:18},{wch:18},{wch:14},{wch:30},{wch:34}]; XL.utils.book_append_sheet(workbook,ws,'Pagos')
}

async function importProviderRows(rows, { event, organization, vendors, assignments, categories }) {
  const recognized=['id proveedor evento','proveedor','categoria','contacto','telefono','email','instagram / web','servicio contratado','precio cotizado','precio contratado','precio final','moneda','tipo de cambio a '+event.currency,'tipo de cambio a moneda base','estado','contrato','contrato / enlace','notas']
  const found=findHeader(rows,['proveedor'],recognized)
  if(!found) throw new Error('No encontré los encabezados de la hoja Proveedores.')
  const col=name=>found.headers.indexOf(normalizeSpreadsheetKey(name))
  const specificRateIndex=col('tipo de cambio a '+event.currency)
  const genericRateIndex=col('tipo de cambio a moneda base')
  const index={ id:col('id proveedor evento'),provider:col('proveedor'),category:col('categoria'),contact:col('contacto'),phone:col('telefono'),email:col('email'),web:col('instagram / web'),service:col('servicio contratado'),quoted:col('precio cotizado'),final:(col('precio contratado')>=0?col('precio contratado'):col('precio final')),currency:col('moneda'),rate:specificRateIndex>=0?specificRateIndex:genericRateIndex,status:col('estado'),contract:col('contrato'),contractUrl:col('contrato / enlace'),notes:col('notas') }
  const vendorByName=new Map(vendors.map(v=>[normalizeSpreadsheetKey(v.company_name),v])); const assignmentById=new Map(assignments.map(a=>[a.id,a])); const categoryByName=new Map(categories.map(c=>[normalizeSpreadsheetKey(c.name),c])); const validCurrencies=new Set(CURRENCIES.map(c=>c.code)); const rateCache=new Map(); const warnings=[]; let count=0
  for(let r=found.index+1;r<rows.length;r+=1){ const row=rows[r]||[]; const company=String(row[index.provider]??'').trim(); if(!company) continue; let vendor=vendorByName.get(normalizeSpreadsheetKey(company)); if(!vendor){ const id=crypto.randomUUID(); const payload={id,organization_id:organization.id,company_name:company,category:index.category>=0?String(row[index.category]??'').trim()||null:null,contact_name:index.contact>=0?String(row[index.contact]??'').trim()||null:null,phone:index.phone>=0?String(row[index.phone]??'').trim()||null:null,email:index.email>=0?String(row[index.email]??'').trim()||null:null,instagram:index.web>=0?String(row[index.web]??'').trim()||null:null}; const {error}=await supabase.from('vendors').insert(payload); if(error) throw error; vendor=payload; vendorByName.set(normalizeSpreadsheetKey(company),vendor) } else { const patch={category:index.category>=0?String(row[index.category]??'').trim()||vendor.category:vendor.category,contact_name:index.contact>=0?String(row[index.contact]??'').trim()||vendor.contact_name:vendor.contact_name,phone:index.phone>=0?String(row[index.phone]??'').trim()||vendor.phone:vendor.phone,email:index.email>=0?String(row[index.email]??'').trim()||vendor.email:vendor.email,instagram:index.web>=0?String(row[index.web]??'').trim()||vendor.instagram:vendor.instagram}; await supabase.from('vendors').update(patch).eq('id',vendor.id).eq('organization_id',organization.id); Object.assign(vendor,patch) }
    const categoryName=String(row[index.category]??'').trim()||String(row[index.service]??'').trim()||vendor.category||'Otros'; let category=categoryByName.get(normalizeSpreadsheetKey(categoryName)); if(!category){ const id=crypto.randomUUID(); const payload={id,event_id:event.id,name:categoryName,planned_amount:0,cost_type:'mixed',sort_order:categoryByName.size}; const {error}=await supabase.from('budget_categories').insert(payload); if(error) throw error; category=payload; categoryByName.set(normalizeSpreadsheetKey(categoryName),category) }
    const currencyRaw=String(row[index.currency]??event.currency).trim().toUpperCase(); const currency=validCurrencies.has(currencyRaw)?currencyRaw:event.currency; if(currencyRaw && !validCurrencies.has(currencyRaw)) warnings.push(`Moneda ${currencyRaw} no reconocida: se usó ${event.currency}.`); let rate=currency===event.currency?1:spreadsheetNumber(row[index.rate]); if(currency!==event.currency && !(rate>0)){ const key=`${currency}:${event.currency}`; if(!rateCache.has(key)){ try{ rateCache.set(key,(await fetchExchangeRate(currency,event.currency)).rate) }catch{ rateCache.set(key,0) } } rate=rateCache.get(key); if(!(rate>0)) throw new Error(`Falta tipo de cambio para ${company} (${currency} → ${event.currency}).`) }
    const rawStatus=normalizeSpreadsheetKey(row[index.status]); const status=IMPORT_STATUS[rawStatus]||'considering'; const quotedAmount=nullableSpreadsheet(row[index.quoted]); const rawContractedAmount=nullableSpreadsheet(row[index.final]); const canHaveContractedAmount=['selected','contracted','completed'].includes(status); let contractedAmount=canHaveContractedAmount?rawContractedAmount:null; if(canHaveContractedAmount && contractedAmount==null && quotedAmount!=null) contractedAmount=quotedAmount; if(!canHaveContractedAmount && rawContractedAmount!=null) warnings.push(`${company}: “Precio contratado” fue ignorado porque el Estado es ${STATUS_LABELS[status]||status}.`); const exportedId=index.id>=0?String(row[index.id]??'').trim():''; const existing=exportedId?assignmentById.get(exportedId):assignments.find(a=>a.vendor_id===vendor.id && a.budget_category_id===category.id); const id=existing?.id || (isUuid(exportedId)?exportedId:crypto.randomUUID()); const payload={event_id:event.id,vendor_id:vendor.id,budget_category_id:category.id,service_category:String(row[index.service]??'').trim()||category.name,status,quoted_amount:quotedAmount,contracted_amount:contractedAmount,currency,exchange_rate:rate,exchange_rate_source:currency===event.currency?'Misma moneda':'Excel',exchange_rate_date:new Date().toISOString().slice(0,10),has_contract:isYes(row[index.contract]),contract_url:index.contractUrl>=0?String(row[index.contractUrl]??'').trim()||null:null,notes:index.notes>=0?String(row[index.notes]??'').trim()||null:null,updated_at:new Date().toISOString()}; const result=existing?await supabase.from('event_vendors').update(payload).eq('id',id).eq('event_id',event.id):await supabase.from('event_vendors').insert({id,...payload}); if(result.error) throw result.error; const {error:syncError}=await supabase.rpc('sync_event_vendor_to_budget',{p_event_vendor_id:id}); if(syncError) throw syncError; assignmentById.set(id,{id,...payload,vendors:vendor}); count+=1 }
  return {count,warnings:[...new Set(warnings)].slice(0,4)}
}

async function importQuoteRows(rows,{event,vendors,assignments,categories}) {
  const recognized=['id cotizacion','id cotización','proveedor','categoria','titulo','título','importe','moneda','tipo de cambio a '+event.currency,'tipo de cambio a moneda base','sena','seña','incluye','extras / no incluye','condiciones de pago','vigencia','valoracion','valoración','seleccionada','notas']
  const found=findHeader(rows,['proveedor','importe'],recognized); if(!found) return 0
  const col=name=>found.headers.indexOf(normalizeSpreadsheetKey(name)); const first=(...names)=>names.map(col).find(i=>i>=0)??-1
  const index={id:first('id cotizacion','id cotización'),provider:col('proveedor'),category:col('categoria'),title:first('titulo','título'),amount:col('importe'),currency:col('moneda'),rate:(col('tipo de cambio a '+event.currency)>=0?col('tipo de cambio a '+event.currency):col('tipo de cambio a moneda base')),deposit:first('sena','seña'),includes:col('incluye'),extras:col('extras / no incluye'),terms:col('condiciones de pago'),valid:col('vigencia'),rating:first('valoracion','valoración'),selected:col('seleccionada'),notes:col('notas')}
  const vendorByName=new Map(vendors.map(v=>[normalizeSpreadsheetKey(v.company_name),v])); const categoryByName=new Map(categories.map(c=>[normalizeSpreadsheetKey(c.name),c])); const assignmentByPair=new Map(assignments.map(a=>[`${a.vendor_id}:${a.budget_category_id}`,a])); const rateCache=new Map(); let count=0
  for(let r=found.index+1;r<rows.length;r+=1){const row=rows[r]||[];const providerName=String(row[index.provider]??'').trim();if(!providerName)continue;const vendor=vendorByName.get(normalizeSpreadsheetKey(providerName));if(!vendor)throw new Error(`Cotización sin proveedor coincidente: ${providerName}. Cargalo primero en Proveedores.`);const categoryName=String(row[index.category]??'').trim();let category=categoryByName.get(normalizeSpreadsheetKey(categoryName));if(!category&&categoryName){const id=crypto.randomUUID();const payload={id,event_id:event.id,name:categoryName,planned_amount:0,cost_type:'mixed',sort_order:categoryByName.size};const res=await supabase.from('budget_categories').insert(payload);if(res.error)throw res.error;category=payload;categoryByName.set(normalizeSpreadsheetKey(categoryName),category)}if(!category)throw new Error(`La cotización de ${providerName} necesita una categoría.`);const currency=String(row[index.currency]??event.currency).trim().toUpperCase()||event.currency;let rate=currency===event.currency?1:spreadsheetNumber(index.rate>=0?row[index.rate]:null);let source=currency===event.currency?'Misma moneda':'Excel';if(currency!==event.currency&&!(rate>0)){const key=`${currency}:${event.currency}`;if(!rateCache.has(key)){try{rateCache.set(key,await fetchExchangeRate(currency,event.currency))}catch{rateCache.set(key,null)}}const fx=rateCache.get(key);if(!fx)throw new Error(`Falta tipo de cambio para la cotización de ${providerName}.`);rate=fx.rate;source=fx.source}const exportedId=index.id>=0?String(row[index.id]??'').trim():'';const id=isUuid(exportedId)?exportedId:crypto.randomUUID();const assignment=assignmentByPair.get(`${vendor.id}:${category.id}`);const payload={event_id:event.id,vendor_id:vendor.id,event_vendor_id:assignment?.id||null,budget_category_id:category.id,title:index.title>=0?String(row[index.title]??'').trim()||null:null,amount:spreadsheetNumber(row[index.amount]),currency,exchange_rate:rate,exchange_rate_source:source,exchange_rate_date:new Date().toISOString().slice(0,10),deposit_amount:index.deposit>=0?nullableSpreadsheet(row[index.deposit]):null,includes:index.includes>=0?String(row[index.includes]??'').trim()||null:null,extras:index.extras>=0?String(row[index.extras]??'').trim()||null:null,payment_terms:index.terms>=0?String(row[index.terms]??'').trim()||null:null,valid_until:index.valid>=0?spreadsheetDate(row[index.valid]):null,rating:index.rating>=0?Math.min(5,Math.max(1,Math.round(spreadsheetNumber(row[index.rating])||0)))||null:null,is_selected:index.selected>=0?isYes(row[index.selected]):false,notes:index.notes>=0?String(row[index.notes]??'').trim()||null:null};const result=isUuid(exportedId)?await supabase.from('quotes').upsert({id,...payload},{onConflict:'id'}):await supabase.from('quotes').insert({id,...payload});if(result.error)throw result.error;count+=1}
  return count
}

async function importPaymentRows(rows,{event,assignments,budgetItems}) {
  const recognized=['id pago','proveedor','categoria','concepto','fecha pactada','fecha pagada','importe','moneda','tipo de cambio a '+event.currency,'tipo de cambio a moneda base','medio de pago','estado','comprobante / enlace','notas']
  const found=findHeader(rows,['proveedor','concepto'],recognized); if(!found) return 0
  const col=name=>found.headers.indexOf(normalizeSpreadsheetKey(name))
  const specificRate=col('tipo de cambio a '+event.currency); const genericRate=col('tipo de cambio a moneda base')
  const index={id:col('id pago'),provider:col('proveedor'),concept:col('concepto'),due:col('fecha pactada'),paidAt:col('fecha pagada'),amount:col('importe'),currency:col('moneda'),rate:specificRate>=0?specificRate:genericRate,method:col('medio de pago'),status:col('estado'),receipt:col('comprobante / enlace'),notes:col('notas')}
  const byName=new Map(assignments.map(a=>[normalizeSpreadsheetKey(a.vendors?.company_name),a])); const itemByVendor=new Map(budgetItems.filter(i=>i.event_vendor_id).map(i=>[i.event_vendor_id,i])); const rateCache=new Map(); let count=0
  for(let r=found.index+1;r<rows.length;r+=1){
    const row=rows[r]||[]; const providerName=String(row[index.provider]??'').trim(); const concept=String(row[index.concept]??'').trim(); if(!providerName||!concept) continue
    const assignment=byName.get(normalizeSpreadsheetKey(providerName)); if(!assignment) throw new Error(`Pago sin proveedor coincidente: ${providerName}. Importá primero ese proveedor en la hoja Proveedores.`)
    const item=itemByVendor.get(assignment.id); const rawStatus=normalizeSpreadsheetKey(row[index.status]); const status=rawStatus==='pagado'?'paid':rawStatus==='cancelado'?'canceled':'pending'; const paidDate=spreadsheetDate(row[index.paidAt]); const exportedId=index.id>=0?String(row[index.id]??'').trim():''; const id=isUuid(exportedId)?exportedId:crypto.randomUUID()
    const currency=String(index.currency>=0?row[index.currency]??assignment.currency??event.currency:assignment.currency??event.currency).trim().toUpperCase() || event.currency
    let rate=currency===event.currency?1:spreadsheetNumber(index.rate>=0?row[index.rate]:null)
    let source=currency===event.currency?'Misma moneda':'Excel'
    if(currency!==event.currency && !(rate>0) && currency===assignment.currency && Number(assignment.exchange_rate)>0){rate=Number(assignment.exchange_rate);source=assignment.exchange_rate_source||'Proveedor'}
    if(currency!==event.currency && !(rate>0)){const key=`${currency}:${event.currency}`;if(!rateCache.has(key)){try{rateCache.set(key,await fetchExchangeRate(currency,event.currency))}catch{rateCache.set(key,null)}}const fx=rateCache.get(key);if(!fx)throw new Error(`Falta tipo de cambio para el pago de ${providerName} (${currency} → ${event.currency}).`);rate=fx.rate;source=fx.source}
    const amounts=paymentPayloadAmounts({amount:spreadsheetNumber(row[index.amount]),currency,eventCurrency:event.currency,exchangeRate:rate,exchangeRateSource:source,exchangeRateDate:new Date().toISOString().slice(0,10)})
    const payload={event_id:event.id,event_vendor_id:assignment.id,budget_item_id:item?.id||null,description:concept,...amounts,due_date:spreadsheetDate(row[index.due]),status,paid_at:status==='paid'?`${paidDate||new Date().toISOString().slice(0,10)}T12:00:00.000Z`:null,payment_method:index.method>=0?String(row[index.method]??'').trim()||null:null,receipt_url:index.receipt>=0?String(row[index.receipt]??'').trim()||null:null,notes:index.notes>=0?String(row[index.notes]??'').trim()||null:null}
    const result=isUuid(exportedId)?await supabase.from('vendor_payments').upsert({id,...payload},{onConflict:'id'}):await supabase.from('vendor_payments').insert({id,...payload}); if(result.error) throw result.error; count+=1
  }
  return count
}

function nullableSpreadsheet(v){ if(v===null||v===undefined||String(v).trim()==='') return null; return spreadsheetNumber(v) }
function isYes(v){return ['si','sí','yes','true','1','x'].includes(normalizeSpreadsheetKey(v))}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}

function countSheetRecords(rows, required='proveedor') { if (!rows?.length) return 0; const wanted=normalizeSpreadsheetKey(required); const headerIndex=rows.findIndex(row => (row || []).map(normalizeSpreadsheetKey).includes(wanted)); if(headerIndex<0) return 0; return rows.slice(headerIndex+1).filter(row => (row || []).some(value => String(value ?? '').trim() !== '')).length }
