import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { downloadWorkbook, findHeader, normalizeSpreadsheetKey, readWorkbook, sheetRows, spreadsheetNumber } from '../../lib/spreadsheets.js'

const RESTRICTIONS = ['Ninguna','Vegetariano','Vegano','Sin gluten','Sin lactosa','Kosher','Halal','Alergia (notar)','Otra']
const RELATIONSHIPS = ['Familia directa','Familia','Amigos','Trabajo','Niños','Otro']
const SIDES = ['Novio','Novia','Ambos']
const TABLE_SIZES = [8,10,12]
const STATUS_OPTIONS = [
  ['pending','Pendiente'],
  ['confirmed','Confirmado'],
  ['declined','No va'],
]
const STATUS_LABELS = { pending:'Pendiente', confirmed:'Confirmado', declined:'No va' }
const STATUS_IMPORT = { pendiente:'pending', confirmado:'confirmed', confirmada:'confirmed', 'no va':'declined', no:'declined', declinado:'declined' }
const HUMAN_RELATIONSHIP = {
  'Familia directa':'familia directa', Familia:'familia', Amigos:'amigos', Trabajo:'compañeros de trabajo', Niños:'niños', Otro:'invitados afines',
}
const IDEAL_TABLE = {
  'Familia directa':'mesa familiar cercana a los novios',
  Familia:'mesa familiar',
  Amigos:'mesa de amigos o mesa cerca de la pista',
  Trabajo:'mesa de compañeros de trabajo',
  Niños:'mesa infantil o cerca de sus padres',
  Otro:'mesa con invitados compatibles',
}

function numericTableName(table) {
  const match = String(table?.name || '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function cleanRestriction(value='Ninguna') {
  const key = normalizeSpreadsheetKey(value)
  if (key === 'alergia' || key === 'alergia (detallar)' || key === 'alergia (notar)') return 'Alergia (notar)'
  return RESTRICTIONS.find(item => normalizeSpreadsheetKey(item) === key) || String(value || 'Ninguna')
}

export default function GuestsPage() {
  const { event, refreshEvent } = useOutletContext()
  const [guests,setGuests] = useState([])
  const [tables,setTables] = useState([])
  const [seating,setSeating] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [search,setSearch] = useState('')
  const [filters,setFilters] = useState({ status:'', side:'', table:'', seated:'' })
  const [sortMode,setSortMode] = useState('alpha')
  const [expandedId,setExpandedId] = useState(null)
  const [addMode,setAddMode] = useState(false)
  const [newGuest,setNewGuest] = useState({ full_name:'', party_size:1, side_label:'Ambos', relationship:'Amigos', invitation_status:'pending', meal_preference:'Ninguna', dietary_notes:'', phone:'', email:'', notes:'', table_number:'' })
  const [tableSize,setTableSize] = useState(() => {
    try { return Number(localStorage.getItem(`planner:guest-table-size:${event.id}`)) || 8 } catch { return 8 }
  })
  const [optionsOpen,setOptionsOpen] = useState(false)
  const [clearOpen,setClearOpen] = useState(false)
  const [clearing,setClearing] = useState(false)
  const [importPreview,setImportPreview] = useState(null)
  const [importing,setImporting] = useState(false)
  const [autoAssigning,setAutoAssigning] = useState(false)
  const fileRef = useRef(null)

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    const [guestRes,tableRes,seatingRes] = await Promise.all([
      supabase.from('guests').select('*').eq('event_id',event.id).order('full_name'),
      supabase.from('event_tables').select('*').eq('event_id',event.id).order('name'),
      supabase.from('seating_assignments').select('*').eq('event_id',event.id),
    ])
    const firstError = guestRes.error || tableRes.error || seatingRes.error
    if (firstError) setError(firstError.message)
    setGuests(guestRes.data || [])
    setTables(tableRes.data || [])
    setSeating(seatingRes.data || [])
    setLoading(false)
  },[event.id])

  useEffect(() => { loadAll() },[loadAll])
  useEffect(() => {
    try { localStorage.setItem(`planner:guest-table-size:${event.id}`,String(tableSize)) } catch {}
  },[event.id,tableSize])

  const tableById = useMemo(() => new Map(tables.map(table => [table.id,table])),[tables])
  const tableByGuest = useMemo(() => new Map(seating.map(row => [row.guest_id,row.table_id])),[seating])
  const tableNumberById = useMemo(() => new Map(tables.map(table => [table.id,numericTableName(table)])),[tables])
  const sortedTables = useMemo(() => [...tables].sort((a,b) => (numericTableName(a) ?? 9999)-(numericTableName(b) ?? 9999) || String(a.name).localeCompare(String(b.name))),[tables])

  const stats = useMemo(() => {
    const people = rows => rows.reduce((sum,row) => sum + Math.max(1,Number(row.party_size || 1)),0)
    const total = people(guests)
    const confirmed = people(guests.filter(row => row.invitation_status === 'confirmed'))
    const declined = people(guests.filter(row => row.invitation_status === 'declined'))
    const pending = total-confirmed-declined
    const located = people(guests.filter(row => row.invitation_status !== 'declined' && tableByGuest.get(row.id)))
    const waiting = people(guests.filter(row => row.invitation_status !== 'declined' && !tableByGuest.get(row.id)))
    const dietary = new Map()
    guests.filter(row => row.invitation_status !== 'declined').forEach(row => {
      const value = cleanRestriction(row.meal_preference)
      if (value === 'Ninguna') return
      dietary.set(value,(dietary.get(value) || 0) + Math.max(1,Number(row.party_size || 1)))
    })
    const seated = guests.reduce((sum,row) => sum + Math.min(Math.max(0,Number(row.seated_count || 0)),Math.max(1,Number(row.party_size || 1))),0)
    return { invitations:guests.length,total,confirmed,pending,declined,seated,located,waiting,dietary:[...dietary.entries()].sort((a,b)=>b[1]-a[1]) }
  },[guests,tableByGuest])

  async function syncGuestEstimate(nextGuests) {
    // Fidelidad con Tu Boda Organizada: el total de la lista alimenta la cantidad general del evento.
    const total = nextGuests.reduce((sum,row) => sum + Math.max(1,Number(row.party_size || 1)),0)
    if (Number(event.estimated_guests || 0) !== total) {
      const { error:updateError } = await supabase.from('events').update({ estimated_guests:total }).eq('id',event.id)
      if (updateError) throw updateError
      await refreshEvent?.()
    }
  }

  async function saveSeat(guestId,tableId) {
    if (!tableId) {
      const { error:deleteError } = await supabase.from('seating_assignments').delete().eq('event_id',event.id).eq('guest_id',guestId)
      if (deleteError) throw deleteError
      return
    }
    const { error:seatError } = await supabase.from('seating_assignments').upsert({ event_id:event.id, guest_id:guestId, table_id:tableId },{ onConflict:'event_id,guest_id' })
    if (seatError) throw seatError
  }

  async function getOrCreateTable(number) {
    const wanted = Math.max(1,Number(number || 1))
    const existing = tables.find(table => numericTableName(table) === wanted)
    if (existing) return existing
    const { data:remote,error:remoteError } = await supabase.from('event_tables').select('*').eq('event_id',event.id).eq('name',`Mesa ${wanted}`).maybeSingle()
    if (remoteError) throw remoteError
    if (remote) { setTables(prev => prev.some(item=>item.id===remote.id)?prev:[...prev,remote]); return remote }
    const table = { id:crypto.randomUUID(), event_id:event.id, name:`Mesa ${wanted}`, capacity:tableSize, shape:'round' }
    const { error:insertError } = await supabase.from('event_tables').insert(table)
    if (insertError) throw insertError
    setTables(prev => [...prev,table])
    return table
  }

  function tableOccupancy(excludeGuestId='') {
    const occ = {}
    for (const guest of guests) {
      if (guest.id === excludeGuestId || guest.invitation_status === 'declined') continue
      const tableId = tableByGuest.get(guest.id)
      const nTable = tableNumberById.get(tableId)
      if (!nTable) continue
      if (!occ[nTable]) occ[nTable] = { total:0, people:[] }
      const quantity = Math.max(1,Number(guest.party_size || 1))
      occ[nTable].total += quantity
      occ[nTable].people.push(guest)
    }
    return occ
  }

  function suggestTable(relationship='Otro',side='Ambos',partySize=1,excludeGuestId='') {
    const quantity = Math.max(1,Number(partySize || 1))
    const occ = tableOccupancy(excludeGuestId)
    const candidates = Object.entries(occ).map(([number,info]) => {
      const table = tables.find(item => numericTableName(item) === Number(number))
      const capacity = Math.max(1,Number(table?.capacity || tableSize))
      const same = info.people.reduce((sum,guest) => {
        const sideOk = guest.side_label === side || guest.side_label === 'Ambos' || side === 'Ambos'
        return sum + ((guest.relationship || 'Otro') === relationship && sideOk ? Math.max(1,Number(guest.party_size || 1)) : 0)
      },0)
      return { number:Number(number),info,capacity,same }
    }).filter(item => item.same > 0 && item.info.total+quantity <= item.capacity)
      .sort((a,b) => b.same-a.same || a.info.total-b.info.total)
    if (candidates.length) return { number:candidates[0].number, reason:`ya hay ${candidates[0].same} de ${relationship}`, kind:'affinity' }
    const usedNumbers = Object.keys(occ).map(Number).filter(Number.isFinite)
    const maxUsed = Math.max(0,...usedNumbers)
    return { number:maxUsed+1, reason:`mesa nueva para ${relationship}`, kind:'new' }
  }

  function tableAffinityInfo(number) {
    const table = tables.find(item => numericTableName(item) === Number(number))
    if (!table) return { list:[],counts:{},top:null }
    const list = guests.filter(guest => tableByGuest.get(guest.id) === table.id && guest.invitation_status !== 'declined')
    const counts = {}
    list.forEach(guest => { const key=guest.relationship || 'Otro'; counts[key]=(counts[key] || 0)+Math.max(1,Number(guest.party_size || 1)) })
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0] || null
    return { list,counts,top }
  }

  function guestRecommendations(guest) {
    if (!guest) return []
    const relationship = guest.relationship || 'Otro'
    const quantity = Math.max(1,Number(guest.party_size || 1))
    const tips = []
    if (guest.invitation_status === 'declined') tips.push('Este invitado figura como “No va”. Podés dejarlo sin mesa hasta que cambie su estado.')
    else if (guest.invitation_status === 'pending') tips.push('Está pendiente: mantenelo visible y evitá cerrar la distribución hasta confirmar.')
    else tips.push('Confirmado: ya podés ubicarlo en una mesa definitiva.')
    tips.push(`Por parentesco conviene ubicarlo en una ${IDEAL_TABLE[relationship] || 'mesa compatible'}.`)
    if (guest.invitation_status !== 'declined') {
      const suggestion = suggestTable(relationship,guest.side_label || 'Ambos',quantity,guest.id)
      const info = tableAffinityInfo(suggestion.number)
      const same = info.counts[relationship] || 0
      if (same > 0) tips.push(`Mesa ${suggestion.number} recomendada: ahí ya hay ${same} ${HUMAN_RELATIONSHIP[relationship] || 'invitados afines'}.`)
      else tips.push(`Mesa ${suggestion.number} recomendada: ${suggestion.reason}.`)
    }
    const currentTableId = tableByGuest.get(guest.id)
    const currentNumber = tableNumberById.get(currentTableId)
    if (currentNumber) {
      const info = tableAffinityInfo(currentNumber)
      const same = info.counts[relationship] || 0
      if (same > quantity) tips.push(`En la mesa ${currentNumber} comparte grupo con ${same-quantity} ${HUMAN_RELATIONSHIP[relationship] || 'invitados afines'}.`)
      if (info.top && info.top[0] !== relationship) tips.push(`Ojo: la mesa ${currentNumber} hoy tiene mayoría de ${HUMAN_RELATIONSHIP[info.top[0]] || info.top[0]}; revisá si se conocen o conviene moverlo.`)
    }
    if (cleanRestriction(guest.meal_preference) !== 'Ninguna') tips.push(`Avisá al catering: ${cleanRestriction(guest.meal_preference)}. Conviene sentarlo donde el servicio lo identifique fácil.`)
    return tips.slice(0,4)
  }

  async function applySuggestedTable(guestLike,guestId='') {
    const suggestion = suggestTable(guestLike.relationship || 'Otro',guestLike.side_label || 'Ambos',guestLike.party_size || 1,guestId)
    const table = await getOrCreateTable(suggestion.number)
    if (guestId) {
      await saveSeat(guestId,table.id)
      setNotice(`✓ Mesa ${suggestion.number} asignada: ${suggestion.reason}.`)
      await loadAll()
    }
    return table
  }

  async function updateGuestField(guest,field,value) {
    setError(''); setNotice('')
    try {
      if (field === 'table_number') {
        if (!String(value || '').trim()) await saveSeat(guest.id,'')
        else {
          const table = await getOrCreateTable(Number(value))
          await saveSeat(guest.id,table.id)
        }
        setNotice('✓ Mesa actualizada.')
        return loadAll()
      }
      const patch = { [field]:field === 'party_size' ? Math.max(1,Number(value || 1)) : value, updated_at:new Date().toISOString() }
      if (field === 'meal_preference') patch.meal_preference = cleanRestriction(value)
      if (field === 'party_size') patch.seated_count = Math.min(Math.max(0,Number(guest.seated_count || 0)),patch.party_size)
      if (field === 'invitation_status' && value === 'declined') patch.seated_count = 0
      const { error:updateError } = await supabase.from('guests').update(patch).eq('id',guest.id).eq('event_id',event.id)
      if (updateError) throw updateError
      if (field === 'invitation_status' && value === 'declined') await saveSeat(guest.id,'')
      const nextGuests = guests.map(row => row.id === guest.id ? {...row,...patch} : row)
      if (field === 'party_size') await syncGuestEstimate(nextGuests)
      setGuests(nextGuests)
      setNotice('✓ Guardado.')
      if (field === 'invitation_status') await loadAll()
    } catch (err) { setError(err.message || 'No se pudo guardar el cambio.') }
  }

  async function updateSeatedCount(guest,value) {
    setError(''); setNotice('')
    try {
      const quantity=Math.max(1,Number(guest.party_size || 1))
      const seatedCount=Math.min(quantity,Math.max(0,Number(value || 0)))
      const patch={ seated_count:seatedCount, updated_at:new Date().toISOString() }
      if (seatedCount>0 && guest.invitation_status !== 'confirmed') patch.invitation_status='confirmed'
      const { error:updateError }=await supabase.from('guests').update(patch).eq('id',guest.id).eq('event_id',event.id)
      if (updateError) throw updateError
      setGuests(prev=>prev.map(row=>row.id===guest.id?{...row,...patch}:row))
      setNotice(seatedCount===quantity ? `✓ ${guest.full_name}: todos sentados.` : seatedCount>0 ? `✓ ${guest.full_name}: ${seatedCount}/${quantity} sentados.` : `✓ ${guest.full_name}: marcado sin sentar.`)
    } catch (err) { setError(err.message || 'No se pudo actualizar la asistencia.') }
  }

  async function addGuest() {
    if (!newGuest.full_name.trim()) return
    setError(''); setNotice('')
    try {
      const id = crypto.randomUUID()
      const payload = {
        id,event_id:event.id,full_name:newGuest.full_name.trim(),party_size:Math.max(1,Number(newGuest.party_size || 1)),
        side_label:newGuest.side_label || 'Ambos',relationship:newGuest.relationship || 'Amigos',invitation_status:newGuest.invitation_status || 'pending',
        meal_preference:cleanRestriction(newGuest.meal_preference),dietary_notes:newGuest.dietary_notes.trim() || null,
        phone:newGuest.phone.trim() || null,email:newGuest.email.trim() || null,notes:newGuest.notes.trim() || null,seated_count:0,updated_at:new Date().toISOString(),
      }
      const { error:insertError } = await supabase.from('guests').insert(payload)
      if (insertError) throw insertError
      if (newGuest.invitation_status !== 'declined' && String(newGuest.table_number || '').trim()) {
        const table = await getOrCreateTable(Number(newGuest.table_number))
        await saveSeat(id,table.id)
      }
      await syncGuestEstimate([...guests,payload])
      setNewGuest({ full_name:'', party_size:1, side_label:'Ambos', relationship:'Amigos', invitation_status:'pending', meal_preference:'Ninguna', dietary_notes:'', phone:'', email:'', notes:'', table_number:'' })
      setAddMode(false); setNotice('✓ Invitación agregada.'); await loadAll()
    } catch (err) { setError(err.message || 'No se pudo agregar la invitación.') }
  }

  async function removeGuest(guest) {
    if (!window.confirm(`¿Eliminar a ${guest.full_name}?`)) return
    setError('')
    const { error:deleteError } = await supabase.from('guests').delete().eq('id',guest.id).eq('event_id',event.id)
    if (deleteError) return setError(deleteError.message)
    const nextGuests = guests.filter(row => row.id !== guest.id)
    try { await syncGuestEstimate(nextGuests) } catch (err) { setError(err.message) }
    setNotice('✓ Invitación eliminada.'); setExpandedId(null); await loadAll()
  }

  async function clearAllGuests() {
    setClearing(true); setError('')
    try {
      const removed = guests.length
      const { error:seatError } = await supabase.from('seating_assignments').delete().eq('event_id',event.id)
      if (seatError) throw seatError
      const { error:guestError } = await supabase.from('guests').delete().eq('event_id',event.id)
      if (guestError) throw guestError
      const { error:eventError } = await supabase.from('events').update({ estimated_guests:0 }).eq('id',event.id)
      if (eventError) throw eventError
      await refreshEvent?.()
      setClearOpen(false); setSearch(''); setFilters({status:'',side:'',table:'',seated:''}); setExpandedId(null)
      setNotice(`✓ Se eliminaron ${removed} ${removed === 1 ? 'invitación' : 'invitaciones'}. Las mesas se conservaron.`)
      await loadAll()
    } catch (err) { setError(err.message || 'No se pudo limpiar la lista.') }
    setClearing(false)
  }

  async function autoAssignTables() {
    if (!guests.length) return
    setAutoAssigning(true); setError(''); setNotice('')
    try {
      const active = guests.filter(guest => guest.invitation_status !== 'declined')
      const existing = [...sortedTables]
      const assignments = []
      const occupancy = new Map(existing.map(table => [table.id,0]))
      let nextNumber = Math.max(0,...existing.map(numericTableName).filter(Boolean)) + 1
      for (const guest of active) {
        const quantity = Math.max(1,Number(guest.party_size || 1))
        let table = existing.find(item => (occupancy.get(item.id) || 0)+quantity <= Math.max(1,Number(item.capacity || tableSize)))
        if (!table) {
          if (quantity > tableSize) continue
          table = { id:crypto.randomUUID(),event_id:event.id,name:`Mesa ${nextNumber}`,capacity:tableSize,shape:'round' }
          const { error:tableError } = await supabase.from('event_tables').insert(table)
          if (tableError) throw tableError
          existing.push(table); occupancy.set(table.id,0); nextNumber += 1
        }
        occupancy.set(table.id,(occupancy.get(table.id) || 0)+quantity)
        assignments.push({ event_id:event.id,guest_id:guest.id,table_id:table.id })
      }
      const { error:clearError } = await supabase.from('seating_assignments').delete().eq('event_id',event.id)
      if (clearError) throw clearError
      if (assignments.length) {
        const { error:assignError } = await supabase.from('seating_assignments').insert(assignments)
        if (assignError) throw assignError
      }
      setNotice('✓ Mesas asignadas respetando la capacidad de 8, 10 o 12 personas.')
      await loadAll()
    } catch (err) { setError(err.message || 'No se pudieron asignar las mesas automáticamente.') }
    setAutoAssigning(false)
  }

  async function downloadTemplate() {
    try {
      const response = await fetch('/plantilla_invitados.xlsx',{ cache:'no-store' })
      if (!response.ok) throw new Error('No se pudo abrir la plantilla de invitados.')
      const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a')
      a.href=url; a.download=`plantilla_invitados_${safeName(event.name)}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setNotice('✓ Plantilla descargada.')
    } catch (err) { setError(err.message) }
  }

  async function exportExcel({ all=false }={}) {
    const rowsToExport = all ? sortedGuests(guests) : visible
    if (!rowsToExport.length) return setNotice('No hay invitados en esta vista para exportar.')
    try {
      await downloadWorkbook(`invitados_${safeName(event.name)}.xlsx`,async (XL,workbook) => {
        const rows = [['Nombre','Personas','Mesa','Lado','Parentesco','Confirmacion','Sentados','Restriccion','Telefono','Email','Notas alimentarias','Notas']]
        rowsToExport.forEach(guest => {
          const tableId=tableByGuest.get(guest.id); const number=tableNumberById.get(tableId) || ''
          const quantity=Math.max(1,Number(guest.party_size || 1))
          const seated=Math.min(quantity,Math.max(0,Number(guest.seated_count || 0)))
          rows.push([guest.full_name || '',quantity,number,guest.side_label || 'Ambos',guest.relationship || 'Otro',STATUS_LABELS[guest.invitation_status] || 'Pendiente',seated,cleanRestriction(guest.meal_preference),guest.phone || '',guest.email || '',guest.dietary_notes || '',guest.notes || ''])
        })
        const ws=XL.utils.aoa_to_sheet(rows)
        ws['!cols']=[{wch:30},{wch:10},{wch:8},{wch:12},{wch:18},{wch:16},{wch:10},{wch:18},{wch:18},{wch:28},{wch:26},{wch:30}]
        ws['!dataValidation']=[
          {sqref:`D2:D${Math.max(60,rows.length)}`,type:'list',formula1:'"Novio,Novia,Ambos"',allowBlank:true},
          {sqref:`E2:E${Math.max(60,rows.length)}`,type:'list',formula1:'"Familia directa,Familia,Amigos,Trabajo,Ninos,Otro"',allowBlank:true},
          {sqref:`F2:F${Math.max(60,rows.length)}`,type:'list',formula1:'"Pendiente,Confirmado,No va"',allowBlank:true},
          {sqref:`H2:H${Math.max(60,rows.length)}`,type:'list',formula1:'"Ninguna,Vegetariano,Vegano,Sin gluten,Sin lactosa,Kosher,Halal,Alergia,Otra"',allowBlank:true},
        ]
        XL.utils.book_append_sheet(workbook,ws,'Invitados')
      })
      setNotice(`✓ ${rowsToExport.length} invitaciones exportadas en el orden ${sortMode==='table'?'por mesa':'alfabético'}.`)
    } catch (err) { setError(err.message) }
  }

  async function prepareImport(e) {
    const file=e.target.files?.[0]; e.target.value=''; if (!file) return
    setImporting(true); setError(''); setNotice('')
    try {
      const { XL,workbook }=await readWorkbook(file)
      const rows=sheetRows(XL,workbook,'Invitados')
      if (!rows.length) throw new Error('No encontré la hoja “Invitados”.')
      setImportPreview(buildImportReview(rows,{ guests,tables,seating,tableSize }))
    } catch (err) { setError(err.message) }
    setImporting(false)
  }

  async function applyImport(mode='auto') {
    if (!importPreview) return
    setImporting(true); setError('')
    try {
      const plan = mode === 'auto' ? importPreview.autoPlan : importPreview.bankPlan
      const existingById = new Map(guests.map(g=>[g.id,g]))
      for (const row of plan.rows) {
        const id=row.id || crypto.randomUUID()
        const payload={...row.payload,meal_preference:cleanRestriction(row.payload.meal_preference),updated_at:new Date().toISOString()}
        if (row.id && existingById.has(row.id)) {
          const { error:updateError }=await supabase.from('guests').update(payload).eq('id',id).eq('event_id',event.id)
          if (updateError) throw updateError
        } else {
          const { error:insertError }=await supabase.from('guests').insert({ id,event_id:event.id,...payload })
          if (insertError) throw insertError
        }
        if (row.table_number) {
          const table=await getOrCreateTable(row.table_number)
          await saveSeat(id,table.id)
        } else await saveSeat(id,'')
      }
      const { data:latest,error:latestError }=await supabase.from('guests').select('*').eq('event_id',event.id)
      if (latestError) throw latestError
      await syncGuestEstimate(latest || [])
      setImportPreview(null); setNotice(`✓ Importación terminada: ${plan.rows.length} invitaciones procesadas.`); await loadAll()
    } catch (err) { setError(err.message || 'No se pudo completar la importación.') }
    setImporting(false)
  }

  function sortedGuests(rows) {
    return [...rows].sort((a,b) => {
      if (sortMode === 'table') {
        const aTable=tableNumberById.get(tableByGuest.get(a.id))
        const bTable=tableNumberById.get(tableByGuest.get(b.id))
        const av=Number.isFinite(aTable)?aTable:Number.MAX_SAFE_INTEGER
        const bv=Number.isFinite(bTable)?bTable:Number.MAX_SAFE_INTEGER
        if (av !== bv) return av-bv
      }
      return String(a.full_name || '').localeCompare(String(b.full_name || ''),'es',{ sensitivity:'base' })
    })
  }

  const activeFilterCount = [search,filters.status,filters.side,filters.table,filters.seated].filter(Boolean).length
  const filteredGuests = guests.filter(guest => {
    if (filters.status && guest.invitation_status !== filters.status) return false
    if (filters.side && guest.side_label !== filters.side) return false
    const tableId=tableByGuest.get(guest.id); const tableNumber=tableNumberById.get(tableId)
    if (filters.table === 'none' && tableId) return false
    if (filters.table && filters.table !== 'none' && String(tableNumber || '') !== filters.table) return false
    const quantity=Math.max(1,Number(guest.party_size || 1))
    const seated=Math.min(quantity,Math.max(0,Number(guest.seated_count || 0)))
    if (filters.seated === 'none' && seated !== 0) return false
    if (filters.seated === 'partial' && !(seated > 0 && seated < quantity)) return false
    if (filters.seated === 'all' && seated !== quantity) return false
    if (!search.trim()) return true
    const q=normalizeSpreadsheetKey(search)
    return [guest.full_name,guest.side_label,guest.relationship,tableNumber ? `mesa ${tableNumber}` : '',guest.phone,guest.email].filter(Boolean).some(value=>normalizeSpreadsheetKey(value).includes(q))
  })
  const visible = sortedGuests(filteredGuests)

  if (loading) return <div className="panel loading-panel">Cargando invitados…</div>

  const confirmedPct = stats.total ? Math.round(stats.confirmed/stats.total*100) : 0
  const hasUnassigned = guests.some(guest => guest.invitation_status !== 'declined' && !tableByGuest.get(guest.id))

  return <div className="guests-page tbo-guests">
    <section className="tbo-guests-hero">
      <div className="tbo-guests-topline">
        <div className="tbo-guests-title"><p className="eyebrow">INVITADOS</p><h2>Invitados</h2><p><strong>{stats.total} personas</strong> · {stats.invitations} invitaciones · {stats.located} ubicadas · {stats.waiting} en espera</p></div>
        <div className="tbo-guests-actions">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={prepareImport} hidden/>
          <button className="primary-btn tbo-add-primary" onClick={()=>setAddMode(true)}>+ Agregar</button>
          <button className="secondary-btn tbo-import-btn" onClick={()=>fileRef.current?.click()} disabled={importing}>↑ Importar</button>
          <button className="secondary-btn tbo-export-btn" onClick={()=>exportExcel()}>↓ Exportar lista</button>
          <div className="tbo-options-wrap"><button className="secondary-btn tbo-options-btn" onClick={()=>setOptionsOpen(value=>!value)}>Más ▾</button>{optionsOpen&&<div className="tbo-options-menu">
            <button onClick={()=>{downloadTemplate();setOptionsOpen(false)}}>▦ Descargar plantilla Excel</button>
            <span>Personas por mesa</span><div className="tbo-size-options">{TABLE_SIZES.map(size=><button key={size} className={tableSize===size?'active':''} onClick={()=>{setTableSize(size);setOptionsOpen(false)}}>{size}</button>)}</div>
            {hasUnassigned&&<button onClick={()=>{autoAssignTables();setOptionsOpen(false)}} disabled={autoAssigning}>🪑 {autoAssigning?'Asignando…':'Asignar mesas automáticamente'}</button>}
            <Link to="../mesas">Ir a Mesas y protocolo</Link>
            {guests.length>0&&<button className="tbo-menu-danger" onClick={()=>{setOptionsOpen(false);setClearOpen(true)}}>🗑 Limpiar toda la lista</button>}
          </div>}</div>
        </div>
      </div>

      <div className="tbo-guest-stats">
        {[[stats.invitations,'Invitaciones'],[stats.total,'Personas'],[stats.confirmed,'Confirmados'],[stats.pending,'Pendientes'],[stats.declined,'No van'],[stats.seated,'Sentados']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>

      <div className="tbo-guests-insights">
        {stats.total>0&&<div className="tbo-progress-wrap"><div className="tbo-progress-copy"><span>Confirmación general</span><strong>{confirmedPct}%</strong></div><div className="tbo-progress"><i style={{width:`${confirmedPct}%`}}/></div></div>}
        {stats.dietary.length>0&&<div className="tbo-restrictions"><small>Restricciones</small>{stats.dietary.map(([label,count])=><span key={label}>{label} <b>{count}</b></span>)}</div>}
      </div>
    </section>

    {error&&<p className="form-error panel guests-message">{error}</p>}
    {notice&&<p className="form-success panel guests-message">{notice}</p>}

    {addMode&&<section className="panel tbo-add-guest">
      <div className="tbo-section-heading"><div><p className="eyebrow">NUEVA INVITACIÓN</p><h3>Agregar invitado o grupo</h3></div><button className="icon-btn" onClick={()=>setAddMode(false)}>×</button></div>
      <div className="tbo-add-grid">
        <label className="wide">Nombre<input value={newGuest.full_name} autoFocus onChange={e=>setNewGuest({...newGuest,full_name:e.target.value})} placeholder="Ej. Familia Gómez"/></label>
        <label>Personas<input type="number" min="1" value={newGuest.party_size} onChange={e=>setNewGuest({...newGuest,party_size:e.target.value})}/></label>
        <label>Mesa Nº<input type="number" min="1" value={newGuest.table_number} onChange={e=>setNewGuest({...newGuest,table_number:e.target.value})} placeholder="—"/></label>
        <label>Lado<select value={newGuest.side_label} onChange={e=>setNewGuest({...newGuest,side_label:e.target.value})}>{SIDES.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Parentesco<select value={newGuest.relationship} onChange={e=>setNewGuest({...newGuest,relationship:e.target.value})}>{RELATIONSHIPS.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Restricción<select value={newGuest.meal_preference} onChange={e=>setNewGuest({...newGuest,meal_preference:e.target.value})}>{RESTRICTIONS.map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      {!newGuest.table_number&&guests.length>0&&(()=>{const suggestion=suggestTable(newGuest.relationship,newGuest.side_label,newGuest.party_size);return <button className="tbo-suggestion-pill" onClick={()=>setNewGuest({...newGuest,table_number:String(suggestion.number)})}>💡 Sugerida: <strong>Mesa {suggestion.number}</strong> · {suggestion.reason}. Ideal para {HUMAN_RELATIONSHIP[newGuest.relationship] || 'invitados afines'} — tocá para usar</button>})()}
      <details className="tbo-planner-extra"><summary>Datos de contacto / notas para la planner</summary><div className="tbo-add-grid"><label>Teléfono<input value={newGuest.phone} onChange={e=>setNewGuest({...newGuest,phone:e.target.value})}/></label><label>Email<input type="email" value={newGuest.email} onChange={e=>setNewGuest({...newGuest,email:e.target.value})}/></label><label className="wide">Notas<input value={newGuest.notes} onChange={e=>setNewGuest({...newGuest,notes:e.target.value})}/></label></div></details>
      <div className="tbo-form-actions"><button className="primary-btn" disabled={!newGuest.full_name.trim()} onClick={addGuest}>+ Agregar</button><button className="secondary-btn" onClick={()=>setAddMode(false)}>Cancelar</button></div>
    </section>}

    <nav className="tbo-guest-steps" aria-label="Recorrido de invitados">
      <button className="active"><b>1</b><span><strong>Lista de invitados</strong><small>Cargar, confirmar, buscar e importar.</small></span></button>
      <Link to="../mesas"><b>2</b><span><strong>Distribuir en mesas</strong><small>Banco de espera, capacidades y grupos.</small></span></Link>
      <Link to="../mesas?view=salon"><b>3</b><span><strong>Diseñar el salón</strong><small>Mesas, ubicación y protocolo.</small></span></Link>
    </nav>

    <section className="panel tbo-list-panel">
      <div className="tbo-list-toolbar">
        <div className="tbo-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, lado o mesa…"/>{search&&<button onClick={()=>setSearch('')}>×</button>}</div>
        <select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">Confirmación</option>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <select value={filters.side} onChange={e=>setFilters({...filters,side:e.target.value})}><option value="">Lado</option>{SIDES.map(value=><option key={value}>{value}</option>)}</select>
        <select value={filters.table} onChange={e=>setFilters({...filters,table:e.target.value})}><option value="">Todas las mesas</option><option value="none">Sin mesa</option>{sortedTables.map(table=>{const number=numericTableName(table);return number?<option key={table.id} value={String(number)}>Mesa {number}</option>:null})}</select>
        <select value={filters.seated} onChange={e=>setFilters({...filters,seated:e.target.value})}><option value="">Asistencia</option><option value="none">Sin sentar</option><option value="partial">Parcialmente sentados</option><option value="all">Todos sentados</option></select>
        <select className="tbo-sort-select" value={sortMode} onChange={e=>setSortMode(e.target.value)}><option value="alpha">Orden: A–Z</option><option value="table">Orden: Mesa</option></select>
        {activeFilterCount>0&&<button className="tbo-filter-clear" onClick={()=>{setSearch('');setFilters({status:'',side:'',table:'',seated:''})}}>✕ Limpiar {activeFilterCount} {activeFilterCount===1?'filtro':'filtros'}</button>}
      </div>

      {!visible.length?<div className="empty-state compact-empty"><h3>{guests.length?'No hay coincidencias':'Todavía no cargaste invitados'}</h3><p>{guests.length?'Probá quitar algún filtro.':'Agregá una invitación o importá tu Excel.'}</p>{!guests.length&&<button className="primary-btn" onClick={()=>setAddMode(true)}>Agregar primera invitación</button>}</div>:<div className="tbo-guest-list">{visible.map(guest=>{
        const expanded=expandedId===guest.id
        const tableId=tableByGuest.get(guest.id); const number=tableNumberById.get(tableId)
        const quantity=Math.max(1,Number(guest.party_size || 1))
        const statusClass=`status-${guest.invitation_status}`
        const seatedCount=Math.min(quantity,Math.max(0,Number(guest.seated_count || 0)))
        return <article key={guest.id} className={`tbo-guest-row ${statusClass}`}>
          <div className="tbo-guest-row-main" onClick={()=>setExpandedId(expanded?null:guest.id)}>
            <div className="tbo-guest-ident"><strong>{guest.full_name}</strong><span>{guest.side_label || 'Ambos'}{guest.relationship&&guest.relationship!=='Otro'?` · ${guest.relationship}`:''}{cleanRestriction(guest.meal_preference)!=='Ninguna'?` · ⚠️ ${cleanRestriction(guest.meal_preference)}`:''}</span></div>
            <div className="tbo-person-count">{quantity}</div>
            <div className={`tbo-table-label ${number?'has-table':''}`}>{number?`Mesa ${number}`:'En espera'}</div>
            <select className={`tbo-status-select ${statusClass}`} value={guest.invitation_status} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();updateGuestField(guest,'invitation_status',e.target.value)}}>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
            <select className={`tbo-seated-select ${seatedCount===quantity?'is-complete':seatedCount>0?'is-partial':''}`} value={seatedCount} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();updateSeatedCount(guest,e.target.value)}}>{Array.from({length:quantity+1},(_,count)=><option key={count} value={count}>{quantity===1?(count?'Sentado':'Sin sentar'):`${count}/${quantity} sentados`}</option>)}</select>
            <span className={`tbo-chevron ${expanded?'open':''}`}>▾</span>
          </div>
          {expanded&&<div className="tbo-guest-expand">
            <div className="tbo-edit-grid">
              <label>Mesa Nº<input type="number" min="1" defaultValue={number || ''} onBlur={e=>updateGuestField(guest,'table_number',e.target.value)} placeholder="Sin asignar"/><button className="tbo-inline-suggest" onClick={async()=>{await applySuggestedTable(guest,guest.id)}}>💡 Sugerir según parentesco</button></label>
              <label>Personas<input type="number" min="1" defaultValue={quantity} onBlur={e=>updateGuestField(guest,'party_size',e.target.value)}/></label>
              <label>Lado<select defaultValue={guest.side_label || 'Ambos'} onBlur={e=>updateGuestField(guest,'side_label',e.target.value)}>{SIDES.map(value=><option key={value}>{value}</option>)}</select></label>
              <label>Parentesco<select defaultValue={guest.relationship || 'Otro'} onBlur={e=>updateGuestField(guest,'relationship',e.target.value)}>{RELATIONSHIPS.map(value=><option key={value}>{value}</option>)}</select></label>
              <label>Restricción<select defaultValue={cleanRestriction(guest.meal_preference)} onBlur={e=>updateGuestField(guest,'meal_preference',e.target.value)}>{RESTRICTIONS.map(value=><option key={value}>{value}</option>)}</select></label>
            </div>
            <RecommendationBox items={guestRecommendations(guest)}/>
            <div className="tbo-contact-grid"><label>Teléfono<input defaultValue={guest.phone || ''} onBlur={e=>updateGuestField(guest,'phone',e.target.value.trim() || null)}/></label><label>Email<input type="email" defaultValue={guest.email || ''} onBlur={e=>updateGuestField(guest,'email',e.target.value.trim() || null)}/></label><label>Detalle alimentario<input defaultValue={guest.dietary_notes || ''} onBlur={e=>updateGuestField(guest,'dietary_notes',e.target.value.trim() || null)}/></label></div>
            <input className="tbo-notes" defaultValue={guest.notes || ''} onBlur={e=>updateGuestField(guest,'notes',e.target.value.trim() || null)} placeholder="Notas (opcional)…"/>
            <div className="tbo-row-actions"><button className="primary-btn" onClick={()=>setExpandedId(null)}>✓ Guardar</button><Link className="secondary-btn" to="../mesas">🏛️ Ver en salón</Link><button className="danger-link" onClick={()=>removeGuest(guest)}>🗑 Eliminar</button></div>
          </div>}
        </article>
      })}</div>}
    </section>

    {clearOpen&&<ClearGuestsModal count={guests.length} busy={clearing} onExport={()=>exportExcel({all:true})} onConfirm={clearAllGuests} onCancel={()=>setClearOpen(false)}/>} 
    {importPreview&&<ImportReviewModal review={importPreview} busy={importing} onAuto={()=>applyImport('auto')} onBank={()=>applyImport('bank')} onCancel={()=>setImportPreview(null)}/>} 
  </div>
}

function RecommendationBox({items}) {
  if (!items?.length) return null
  return <div className="tbo-recommendation-box"><strong>Recomendaciones de mesa</strong>{items.map((item,index)=><p key={index}>• {item}</p>)}</div>
}

function ClearGuestsModal({count,busy,onExport,onConfirm,onCancel}) {
  return <div className="modal-backdrop" onMouseDown={onCancel}><div className="modal-card tbo-clear-modal" onMouseDown={e=>e.stopPropagation()}><div className="tbo-trash-icon">🗑️</div><h2>¿Querés eliminar {count} {count===1?'invitación':'invitaciones'}?</h2><p>Se borrarán los invitados y sus asignaciones. Las mesas y el diseño del salón se conservarán.</p><div className="tbo-clear-modal-actions"><button className="secondary-btn" onClick={onExport}>Exportar copia antes de limpiar</button><div><button className="secondary-btn" onClick={onCancel} disabled={busy}>Cancelar</button><button className="tbo-delete-all" onClick={onConfirm} disabled={busy}>{busy?'Eliminando…':'Eliminar todo'}</button></div></div></div></div>
}

function ImportReviewModal({review,busy,onAuto,onBank,onCancel}) {
  const s=review.summary
  return <div className="modal-backdrop" onMouseDown={onCancel}><div className="modal-card tbo-import-review" onMouseDown={e=>e.stopPropagation()}><button className="icon-btn tbo-modal-close" onClick={onCancel}>×</button><p className="eyebrow">REVISAR ANTES DE IMPORTAR</p><h2>Encontramos {s.totalInvitations} invitaciones</h2><p>La app mantiene cada invitación o familia junta. Nadie se divide entre mesas y ninguna mesa debe superar la capacidad definida.</p><div className="tbo-import-match-summary"><span><b>{s.newRows}</b> nuevas</span><span><b>{s.updateRows}</b> actualizaciones</span>{s.identityMatches>0&&<span className="protected"><b>{s.identityMatches}</b> coincidencias protegidas contra duplicados</span>}</div><div className="tbo-import-stats"><div><strong>{s.totalPeople}</strong><span>Personas en el archivo</span></div><div><strong>{s.withoutTable}</strong><span>Sin mesa</span></div><div><strong>{s.overloadedTables}</strong><span>Mesas excedidas</span></div><div><strong>{s.toRelocate}</strong><span>A reubicar</span></div></div>{review.warnings.length>0&&<div className="guest-import-warnings">{review.warnings.slice(0,6).map((warning,index)=><span key={index}>• {warning}</span>)}</div>}<div className="tbo-import-options"><button className="primary-btn" onClick={onAuto} disabled={busy}><strong>Reorganizar respetando capacidades</strong><span>Recomendado · mantiene los grupos juntos y crea mesas nuevas si hace falta.</span></button><button className="secondary-btn" onClick={onBank} disabled={busy}><strong>Mantener solo asignaciones válidas</strong><span>Lo que no entra queda en el Banco de espera para revisarlo.</span></button><button className="text-link" onClick={onCancel}>Cancelar importación</button></div></div></div>
}

function buildImportReview(rows,{guests,tables,seating,tableSize}) {
  const recognized=['id invitado','nombre','personas','mesa','lado','lado / grupo','parentesco','confirmacion','confirmación','restriccion','restricción','notas','telefono','teléfono','email','notas alimentarias','sentados']
  const found=findHeader(rows,['nombre'],recognized)
  if (!found) throw new Error('No encontré la fila de encabezados. La hoja debe incluir “Nombre”.')
  const first=(...names)=>names.map(name=>found.headers.indexOf(normalizeSpreadsheetKey(name))).find(index=>index>=0) ?? -1
  const idx={ id:first('id invitado'),name:first('nombre'),size:first('personas'),table:first('mesa'),side:first('lado','lado / grupo'),rel:first('parentesco'),status:first('confirmacion','confirmación'),meal:first('restriccion','restricción'),notes:first('notas'),phone:first('telefono','teléfono'),email:first('email'),dietary:first('notas alimentarias'),seated:first('sentados') }
  const guestById=new Map(guests.map(guest=>[guest.id,guest]))
  const emailKey=value=>normalizeSpreadsheetKey(String(value||'').trim())
  const phoneKey=value=>String(value||'').replace(/\D/g,'')
  const fallbackKey=(name,size,side,relationship)=>`${normalizeSpreadsheetKey(name)}|${Number(size)||1}|${normalizeSpreadsheetKey(side)}|${normalizeSpreadsheetKey(relationship)}`
  const guestByEmail=new Map(guests.filter(g=>emailKey(g.email)).map(g=>[emailKey(g.email),g]))
  const guestByPhone=new Map(guests.filter(g=>phoneKey(g.phone)).map(g=>[phoneKey(g.phone),g]))
  const guestByFallback=new Map(guests.map(g=>[fallbackKey(g.full_name,g.party_size,g.side_label||'Ambos',g.relationship||'Otro'),g]))
  const tableById=new Map(tables.map(table=>[table.id,table]))
  const tableNumberById=new Map(tables.map(table=>[table.id,numericTableName(table)]))
  const capacityFor=number=>Math.max(1,Number(tables.find(table=>numericTableName(table)===Number(number))?.capacity || tableSize))
  const baseOccupancy=new Map()
  for (const seat of seating) {
    const guest=guestById.get(seat.guest_id); if (!guest || guest.invitation_status==='declined') continue
    const number=tableNumberById.get(seat.table_id); if (!number) continue
    baseOccupancy.set(number,(baseOccupancy.get(number)||0)+Math.max(1,Number(guest.party_size || 1)))
  }
  const parsed=[]; const warnings=[]; let identityMatches=0; const seenStrongKeys=new Set()
  for (let r=found.index+1;r<rows.length;r+=1) {
    const row=rows[r] || []; const name=String(row[idx.name] ?? '').trim(); if (!name) continue
    const exportedId=idx.id>=0?String(row[idx.id] ?? '').trim():''
    const statusKey=normalizeSpreadsheetKey(idx.status>=0?row[idx.status]:'Pendiente'); const status=STATUS_IMPORT[statusKey] || 'pending'
    const rawSide=idx.side>=0?String(row[idx.side] ?? '').trim():'Ambos'; const side=SIDES.find(item=>normalizeSpreadsheetKey(item)===normalizeSpreadsheetKey(rawSide)) || 'Ambos'
    const rawRel=idx.rel>=0?String(row[idx.rel] ?? '').trim():'Otro'; const relationship=RELATIONSHIPS.find(item=>normalizeSpreadsheetKey(item)===normalizeSpreadsheetKey(rawRel)) || 'Otro'
    const tableNumber=idx.table>=0?Number(String(row[idx.table] ?? '').match(/\d+/)?.[0] || 0):0
    const partySize=Math.max(1,Math.round(spreadsheetNumber(idx.size>=0?row[idx.size]:1) || 1))
    const email=idx.email>=0?String(row[idx.email] ?? '').trim():''
    const phone=idx.phone>=0?String(row[idx.phone] ?? '').trim():''
    const strongKey=emailKey(email)?`email:${emailKey(email)}`:(phoneKey(phone)?`phone:${phoneKey(phone)}`:'')
    if(strongKey&&seenStrongKeys.has(strongKey)){warnings.push(`Fila ${r+1}: coincide con otra fila del mismo archivo (${name}); se ignoró para evitar duplicarla.`);continue}
    if(strongKey)seenStrongKeys.add(strongKey)
    let existing=guestById.get(exportedId)
    if(!existing&&emailKey(email)) existing=guestByEmail.get(emailKey(email))
    if(!existing&&phoneKey(phone)) existing=guestByPhone.get(phoneKey(phone))
    if(!existing&&!emailKey(email)&&!phoneKey(phone)) existing=guestByFallback.get(fallbackKey(name,partySize,side,relationship))
    if(!exportedId&&existing){identityMatches+=1}
    if (rawSide && side==='Ambos' && normalizeSpreadsheetKey(rawSide)!=='ambos') warnings.push(`Fila ${r+1}: lado “${rawSide}” no reconocido; se usará Ambos.`)
    parsed.push({ id:existing?.id || '',payload:{ full_name:name,party_size:partySize,side_label:side,relationship,invitation_status:status,meal_preference:cleanRestriction(idx.meal>=0?row[idx.meal]:'Ninguna'),notes:idx.notes>=0?String(row[idx.notes] ?? '').trim() || null:null,phone:phone || null,email:email || null,dietary_notes:idx.dietary>=0?String(row[idx.dietary] ?? '').trim() || null:null,seated_count:status==='declined'?0:Math.min(partySize,Math.max(0,Math.round(spreadsheetNumber(idx.seated>=0?row[idx.seated]:0) || 0))) },table_number:status==='declined'?0:tableNumber })
  }
  if (!parsed.length) throw new Error('No se encontraron invitados válidos en el archivo.')

  const requested=new Map(baseOccupancy); const overloaded=new Set()
  parsed.forEach(row=>{if(!row.table_number||row.payload.invitation_status==='declined')return;const next=(requested.get(row.table_number)||0)+row.payload.party_size;requested.set(row.table_number,next);if(next>capacityFor(row.table_number))overloaded.add(row.table_number)})
  const makePlan=(auto)=>{
    const occupancy=new Map(baseOccupancy); let maxNumber=Math.max(0,...tables.map(numericTableName).filter(Boolean),...parsed.map(row=>row.table_number).filter(Boolean)); let moved=0
    const planned=parsed.map(row=>{
      if(!row.table_number||row.payload.invitation_status==='declined') return {...row,table_number:0}
      const used=occupancy.get(row.table_number)||0
      if(used+row.payload.party_size<=capacityFor(row.table_number)){occupancy.set(row.table_number,used+row.payload.party_size);return row}
      moved+=1
      if(!auto) return {...row,table_number:0}
      const candidates=[...new Set([...tables.map(numericTableName).filter(Boolean),...occupancy.keys()])].sort((a,b)=>a-b)
      const candidate=candidates.find(number=>(occupancy.get(number)||0)+row.payload.party_size<=capacityFor(number))
      if(candidate){occupancy.set(candidate,(occupancy.get(candidate)||0)+row.payload.party_size);return {...row,table_number:candidate}}
      if(row.payload.party_size>tableSize) return {...row,table_number:0}
      maxNumber+=1;occupancy.set(maxNumber,row.payload.party_size);return {...row,table_number:maxNumber}
    })
    return { rows:planned,moved }
  }
  const autoPlan=makePlan(true); const bankPlan=makePlan(false)
  return { summary:{ totalInvitations:parsed.length,totalPeople:parsed.reduce((sum,row)=>sum+row.payload.party_size,0),withoutTable:parsed.filter(row=>!row.table_number&&row.payload.invitation_status!=='declined').length,overloadedTables:overloaded.size,toRelocate:bankPlan.moved,newRows:parsed.filter(row=>!row.id).length,updateRows:parsed.filter(row=>row.id).length,identityMatches },warnings:[...new Set(warnings),...(identityMatches?[`${identityMatches} fila${identityMatches===1?'':'s'} coincide${identityMatches===1?'':'n'} con invitados existentes por email, teléfono o identidad básica; se actualizarán en vez de duplicarse.`]:[])],autoPlan,bankPlan }
}

function safeName(value='evento'){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase() || 'evento'}
