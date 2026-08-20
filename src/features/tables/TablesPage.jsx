import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { downloadWorkbook } from '../../lib/spreadsheets.js'
import SalonDesignerWorkspace from './SalonDesignerWorkspace.jsx'
import { TABLE_VISUAL_TYPES, tableMeasuresForCapacity } from './salonPresets.js'

const DEFAULT_CAPACITIES = [8,10,12]
const STATUS_LABELS = { pending:'Pendiente', confirmed:'Confirmado', declined:'No va' }
const SIDE_ORDER = ['Novia','Novio','Ambos']

function partySize(guest) {
  return Math.max(1,Number(guest?.party_size || 1))
}

function tableNumber(table) {
  const match = String(table?.name || '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function safeName(value='evento') {
  return String(value || 'evento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'').toLowerCase() || 'evento'
}

function tablePosition(table,index,total) {
  const x=Number(table?.pos_x), y=Number(table?.pos_y)
  if (Number.isFinite(x) && Number.isFinite(y)) return { x:Math.min(94,Math.max(6,x)), y:Math.min(90,Math.max(13,y)) }
  const cols=Math.max(2,Math.ceil(Math.sqrt(Math.max(1,total))))
  const rows=Math.max(1,Math.ceil(total/cols))
  const col=index%cols, row=Math.floor(index/cols)
  const xx=cols===1?50:15+(col*(70/(cols-1)))
  const yy=rows===1?46:28+(row*(50/Math.max(1,rows-1)))
  return { x:xx,y:yy }
}

function labelForGroup(key) {
  if (!key || key==='Otro') return ''
  const [relationship,side]=key.split('·')
  const base=relationship==='Familia directa'?'Familia':relationship
  return side && side!=='Ambos' ? `${base} ${side}` : base
}

export default function TablesPage() {
  const { event } = useOutletContext()
  const [searchParams,setSearchParams] = useSearchParams()
  const view=searchParams.get('view')==='salon'?'salon':'tables'
  const [guests,setGuests]=useState([])
  const [tables,setTables]=useState([])
  const [seating,setSeating]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [selectedTableId,setSelectedTableId]=useState('')
  const [selectedGuestId,setSelectedGuestId]=useState('')
  const [waitingSearch,setWaitingSearch]=useState('')
  const [defaultCapacity,setDefaultCapacity]=useState(()=>{
    try { return Number(localStorage.getItem(`planner:tables-default-capacity:${event.id}`)) || 8 } catch { return 8 }
  })
  const [busy,setBusy]=useState(false)
  const [undoSnapshot,setUndoSnapshot]=useState(null)
  const [deletedTable,setDeletedTable]=useState(null)
  const [dragGuestId,setDragGuestId]=useState('')
  const [draggingTableId,setDraggingTableId]=useState('')
  const canvasRef=useRef(null)
  // El canvas necesita una UX optimista: mover una invitación no debe volver a cargar
  // toda la pantalla. Estos refs permiten persistir en segundo plano y revertir
  // solamente la invitación afectada si Supabase rechazara el cambio.
  const seatingRef=useRef([])
  const seatingMutationRef=useRef(new Map())

  const loadAll=useCallback(async()=>{
    setLoading(true); setError('')
    const [guestRes,tableRes,seatingRes]=await Promise.all([
      supabase.from('guests').select('*').eq('event_id',event.id).order('full_name'),
      supabase.from('event_tables').select('*').eq('event_id',event.id),
      supabase.from('seating_assignments').select('*').eq('event_id',event.id),
    ])
    const firstError=guestRes.error || tableRes.error || seatingRes.error
    if (firstError) setError(firstError.message)
    setGuests(guestRes.data || [])
    setTables((tableRes.data || []).sort((a,b)=>(tableNumber(a)??9999)-(tableNumber(b)??9999)||String(a.name).localeCompare(String(b.name))))
    setSeating(seatingRes.data || [])
    setLoading(false)
  },[event.id])

  useEffect(()=>{ loadAll() },[loadAll])
  useEffect(()=>{ seatingRef.current=seating },[seating])
  useEffect(()=>{ try { localStorage.setItem(`planner:tables-default-capacity:${event.id}`,String(defaultCapacity)) } catch {} },[defaultCapacity,event.id])

  const activeGuests=useMemo(()=>guests.filter(guest=>guest.invitation_status!=='declined'),[guests])
  const guestById=useMemo(()=>new Map(guests.map(guest=>[guest.id,guest])),[guests])
  const tableById=useMemo(()=>new Map(tables.map(table=>[table.id,table])),[tables])
  const tableIdByGuest=useMemo(()=>new Map(seating.map(row=>[row.guest_id,row.table_id])),[seating])
  const seatsByTable=useMemo(()=>{
    const map=new Map(tables.map(table=>[table.id,[]]))
    seating.forEach(row=>{
      const guest=guestById.get(row.guest_id)
      if (!guest || guest.invitation_status==='declined') return
      if (!map.has(row.table_id)) map.set(row.table_id,[])
      map.get(row.table_id).push(guest)
    })
    return map
  },[tables,seating,guestById])
  const occupancy=useMemo(()=>{
    const map=new Map()
    tables.forEach(table=>map.set(table.id,(seatsByTable.get(table.id)||[]).reduce((sum,guest)=>sum+partySize(guest),0)))
    return map
  },[tables,seatsByTable])
  const waiting=useMemo(()=>activeGuests.filter(guest=>!tableIdByGuest.get(guest.id)).sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'es')),[activeGuests,tableIdByGuest])
  const filteredWaiting=useMemo(()=>{
    const q=waitingSearch.trim().toLowerCase()
    if (!q) return waiting
    return waiting.filter(guest=>[guest.full_name,guest.relationship,guest.side_label].some(value=>String(value||'').toLowerCase().includes(q)))
  },[waiting,waitingSearch])
  const selectedTable=tableById.get(selectedTableId) || null
  const selectedTableGuests=selectedTable ? (seatsByTable.get(selectedTable.id)||[]) : []

  const stats=useMemo(()=>{
    const totalPeople=activeGuests.reduce((sum,guest)=>sum+partySize(guest),0)
    const locatedPeople=activeGuests.filter(guest=>tableIdByGuest.get(guest.id)).reduce((sum,guest)=>sum+partySize(guest),0)
    const waitingPeople=totalPeople-locatedPeople
    const capacity=tables.reduce((sum,table)=>sum+Math.max(1,Number(table.capacity||defaultCapacity)),0)
    const over=tables.filter(table=>(occupancy.get(table.id)||0)>Math.max(1,Number(table.capacity||defaultCapacity))).length
    const complete=tables.filter(table=>{
      const used=occupancy.get(table.id)||0, cap=Math.max(1,Number(table.capacity||defaultCapacity))
      return used===cap
    }).length
    return { totalPeople,locatedPeople,waitingPeople,capacity,over,complete,tables:tables.length }
  },[activeGuests,tables,tableIdByGuest,occupancy,defaultCapacity])

  const missingCapacity=Math.max(0,stats.totalPeople-stats.capacity)
  const neededTables=missingCapacity>0?Math.ceil(missingCapacity/defaultCapacity):0

  function clearMessages() { setError(''); setNotice('') }

  async function ensureDefaultEnvironment() {
    const { data:existing,error:readError }=await supabase.from('event_environments').select('id').eq('event_id',event.id).order('sort_order').limit(1)
    if (readError) throw readError
    if (existing?.[0]?.id) return existing[0].id
    const id=crypto.randomUUID()
    const { error:insertError }=await supabase.from('event_environments').insert({
      id,event_id:event.id,name:'Salón principal',width_m:26,height_m:18,shape:'rectangle',shape_config:{},sort_order:0,
    })
    if (insertError) throw insertError
    return id
  }

  async function createTable({capacity=defaultCapacity,environmentId=null,position=null,visualType='round'}={}) {
    clearMessages(); setBusy(true)
    try {
      const used=tables.map(tableNumber).filter(Boolean)
      const next=Math.max(0,...used)+1
      const pos=position || tablePosition(null,tables.length,tables.length+1)
      const envId=environmentId || await ensureDefaultEnvironment()
      const typeCfg=TABLE_VISUAL_TYPES[visualType]||TABLE_VISUAL_TYPES.round
      const tableCapacity=Math.max(1,Number(capacity)||Number(typeCfg.defaultCapacity)||8)
      const measures=tableMeasuresForCapacity(visualType,tableCapacity)
      const payload={ id:crypto.randomUUID(),event_id:event.id,environment_id:envId,name:`Mesa ${next}`,capacity:tableCapacity,shape:typeCfg.dbShape,visual_type:visualType,pos_x:pos.x,pos_y:pos.y,width_m:measures.width,height_m:measures.height,rotation:0 }
      const { error:insertError }=await supabase.from('event_tables').insert(payload)
      if (insertError) throw insertError
      setNotice(`✓ Mesa ${next} creada.`); setSelectedTableId(payload.id); await loadAll()
      setBusy(false)
      return payload
    } catch(err) { setError(err.message || 'No se pudo crear la mesa.') }
    setBusy(false)
    return null
  }

  async function createNeededTables() {
    if (!neededTables) return setNotice('La capacidad total ya alcanza para las personas activas.')
    clearMessages(); setBusy(true)
    try {
      const envId=await ensureDefaultEnvironment()
      let next=Math.max(0,...tables.map(tableNumber).filter(Boolean))+1
      const rows=[]
      for (let i=0;i<neededTables;i+=1) {
        const pos=tablePosition(null,tables.length+i,tables.length+neededTables)
        const measures=tableMeasuresForCapacity('round',defaultCapacity)
        rows.push({ id:crypto.randomUUID(),event_id:event.id,environment_id:envId,name:`Mesa ${next}`,capacity:defaultCapacity,shape:'round',visual_type:'round',pos_x:pos.x,pos_y:pos.y,width_m:measures.width,height_m:measures.height,rotation:0 })
        next+=1
      }
      const { error:insertError }=await supabase.from('event_tables').insert(rows)
      if (insertError) throw insertError
      setNotice(`✓ ${rows.length} ${rows.length===1?'mesa creada':'mesas creadas'} para cubrir la capacidad faltante.`); await loadAll()
    } catch(err) { setError(err.message || 'No se pudieron crear las mesas necesarias.') }
    setBusy(false)
  }

  async function updateTable(table,patch) {
    clearMessages()
    const { error:updateError }=await supabase.from('event_tables').update(patch).eq('id',table.id).eq('event_id',event.id)
    if (updateError) return setError(updateError.message)
    setTables(prev=>prev.map(item=>item.id===table.id?{...item,...patch}:item))
  }

  async function assignGuest(guestId,tableId) {
    clearMessages()
    const guest=guestById.get(guestId), table=tableById.get(tableId)
    if (!guest || !table || guest.invitation_status==='declined') return false

    const oldTableId=tableIdByGuest.get(guestId)
    if (oldTableId===tableId) {
      setSelectedGuestId('')
      return true
    }

    const current=(occupancy.get(tableId)||0)-(oldTableId===tableId?partySize(guest):0)
    const capacity=Math.max(1,Number(table.capacity||defaultCapacity))
    if (current+partySize(guest)>capacity) {
      setError(`${table.name} no tiene lugar para ${guest.full_name} completo/a (${partySize(guest)} personas). En Tu Boda Organizada los grupos no se dividen.`)
      return false
    }

    // UI optimista: la persona cambia de mesa AHORA. No usamos loadAll(), porque
    // eso hacía parpadear/recargar el canvas después de cada movimiento.
    const mutation=(seatingMutationRef.current.get(guestId)||0)+1
    seatingMutationRef.current.set(guestId,mutation)
    const before=seatingRef.current.find(row=>row.guest_id===guestId) || null
    const optimistic=before
      ? {...before,event_id:event.id,guest_id:guestId,table_id:tableId}
      : {event_id:event.id,guest_id:guestId,table_id:tableId}

    setSeating(prev=>{
      const exists=prev.some(row=>row.guest_id===guestId)
      const next=exists
        ? prev.map(row=>row.guest_id===guestId?optimistic:row)
        : [...prev,optimistic]
      seatingRef.current=next
      return next
    })
    setSelectedGuestId('')

    const { error:seatError }=await supabase
      .from('seating_assignments')
      .upsert({event_id:event.id,guest_id:guestId,table_id:tableId},{onConflict:'event_id,guest_id'})

    // Si mientras este request estaba en vuelo la planner ya volvió a mover a la
    // misma invitación, esta respuesta antigua no puede pisar el movimiento nuevo.
    if (seatingMutationRef.current.get(guestId)!==mutation) return !seatError

    if (seatError) {
      setSeating(prev=>{
        const without=prev.filter(row=>row.guest_id!==guestId)
        const next=before?[...without,before]:without
        seatingRef.current=next
        return next
      })
      setError(`No pudimos guardar el cambio de mesa: ${seatError.message}`)
      return false
    }

    return true
  }

  async function moveToWaiting(guestId) {
    clearMessages()
    const guest=guestById.get(guestId)
    const mutation=(seatingMutationRef.current.get(guestId)||0)+1
    seatingMutationRef.current.set(guestId,mutation)
    const before=seatingRef.current.find(row=>row.guest_id===guestId) || null
    if (!before) {
      if (selectedGuestId===guestId) setSelectedGuestId('')
      return true
    }

    // Igual que al mover entre mesas: sale al Banco de espera inmediatamente y se
    // persiste en segundo plano, sin refrescar invitados/mesas/asignaciones completas.
    setSeating(prev=>{
      const next=prev.filter(row=>row.guest_id!==guestId)
      seatingRef.current=next
      return next
    })
    if (selectedGuestId===guestId) setSelectedGuestId('')

    const { error:deleteError }=await supabase
      .from('seating_assignments')
      .delete()
      .eq('event_id',event.id)
      .eq('guest_id',guestId)

    if (seatingMutationRef.current.get(guestId)!==mutation) return !deleteError

    if (deleteError) {
      setSeating(prev=>{
        if (prev.some(row=>row.guest_id===guestId)) return prev
        const next=[...prev,before]
        seatingRef.current=next
        return next
      })
      setError(`No pudimos mover ${guest?.full_name || 'la invitación'} al Banco de espera: ${deleteError.message}`)
      return false
    }

    return true
  }

  async function emptyTable(table) {
    const assigned=seatsByTable.get(table.id)||[]
    if (!assigned.length) return setNotice(`${table.name} ya está vacía.`)
    if (!window.confirm(`¿Vaciar ${table.name}? ${assigned.length} ${assigned.length===1?'invitación volverá':'invitaciones volverán'} al Banco de espera.`)) return
    clearMessages()
    const { error:deleteError }=await supabase.from('seating_assignments').delete().eq('event_id',event.id).eq('table_id',table.id)
    if (deleteError) return setError(deleteError.message)
    setNotice(`✓ ${table.name} vaciada.`); await loadAll()
  }

  async function emptyAllTables() {
    if (!seating.length) return setNotice('Todas las invitaciones ya están en el Banco de espera.')
    if (!window.confirm(`¿Vaciar todas las mesas? ${seating.length} invitaciones volverán al Banco de espera.`)) return
    clearMessages()
    const { error:deleteError }=await supabase.from('seating_assignments').delete().eq('event_id',event.id)
    if (deleteError) return setError(deleteError.message)
    setUndoSnapshot(seating.map(row=>({guest_id:row.guest_id,table_id:row.table_id})))
    setSelectedTableId(''); setNotice('✓ Todas las invitaciones volvieron al Banco de espera.'); await loadAll()
  }

  async function deleteTable(table) {
    const assigned=(seatsByTable.get(table.id)||[])
    const people=assigned.reduce((sum,guest)=>sum+partySize(guest),0)
    const detail=assigned.length?` ${assigned.length} invitaciones (${people} personas) volverán al Banco de espera.`:' La mesa está vacía.'
    if (!window.confirm(`¿Eliminar ${table.name}?${detail}`)) return
    clearMessages()
    const snapshot={ table:{...table},seating:seating.filter(row=>row.table_id===table.id).map(row=>({...row})) }
    const { error:deleteError }=await supabase.from('event_tables').delete().eq('id',table.id).eq('event_id',event.id)
    if (deleteError) return setError(deleteError.message)
    setDeletedTable(snapshot); setSelectedTableId(''); setNotice(`✓ ${table.name} eliminada.`); await loadAll()
  }

  async function undoDeleteTable() {
    if (!deletedTable) return
    clearMessages(); setBusy(true)
    try {
      const { error:tableError }=await supabase.from('event_tables').insert(deletedTable.table)
      if (tableError) throw tableError
      if (deletedTable.seating.length) {
        const { error:seatError }=await supabase.from('seating_assignments').insert(deletedTable.seating.map(row=>({event_id:event.id,guest_id:row.guest_id,table_id:deletedTable.table.id,seat_number:row.seat_number ?? null})))
        if (seatError) throw seatError
      }
      setNotice(`↩ ${deletedTable.table.name} restaurada.`); setDeletedTable(null); await loadAll()
    } catch(err) { setError(err.message || 'No se pudo restaurar la mesa.') }
    setBusy(false)
  }

  async function undoProtocol() {
    if (!undoSnapshot) return
    clearMessages(); setBusy(true)
    try {
      const { error:clearError }=await supabase.from('seating_assignments').delete().eq('event_id',event.id)
      if (clearError) throw clearError
      if (undoSnapshot.length) {
        const valid=undoSnapshot.filter(row=>tableById.has(row.table_id) && guestById.has(row.guest_id))
        if (valid.length) {
          const { error:insertError }=await supabase.from('seating_assignments').insert(valid.map(row=>({event_id:event.id,guest_id:row.guest_id,table_id:row.table_id})))
          if (insertError) throw insertError
        }
      }
      setUndoSnapshot(null); setNotice('↩ Volviste a la distribución anterior.'); await loadAll()
    } catch(err) { setError(err.message || 'No se pudo deshacer la distribución.') }
    setBusy(false)
  }

  async function seatByProtocol(referenceOverride=null) {
    if (!activeGuests.length) return setError('Primero cargá invitados activos.')
    if (!tables.length) return setError('Primero creá mesas. Podés usar “Crear mesas necesarias”.')
    clearMessages(); setBusy(true)
    try {
      const previous=seating.map(row=>({guest_id:row.guest_id,table_id:row.table_id}))
      const positions=new Map(tables.map((table,index)=>[table.id,tablePosition(table,index,tables.length)]))
      const reference={
        couple:referenceOverride?.couple || {x:50,y:8},
        dance:referenceOverride?.dance || {x:50,y:54},
        entrance:referenceOverride?.entrance || {x:50,y:94},
      }
      const distance=(table,point)=>{const pos=positions.get(table.id);return Math.hypot(pos.x-point.x,pos.y-point.y)}
      const nearCouple=[...tables].sort((a,b)=>distance(a,reference.couple)-distance(b,reference.couple))
      const nearDance=[...tables].sort((a,b)=>distance(a,reference.dance)-distance(b,reference.dance))
      const nearEntrance=[...tables].sort((a,b)=>distance(a,reference.entrance)-distance(b,reference.entrance))
      const remaining=new Map(tables.map(table=>[table.id,Math.max(1,Number(table.capacity||defaultCapacity))]))
      const owner=new Map()
      const pairs=[]
      const unplaced=[]
      const handled=new Set()

      const members=(relationship,side=null)=>activeGuests
        .filter(guest=>(guest.relationship||'Otro')===relationship && (side===null || (guest.side_label||'Ambos')===side))
        .sort((a,b)=>partySize(b)-partySize(a)||String(a.full_name).localeCompare(String(b.full_name),'es'))

      const placeGroup=(membersList,key,candidates)=>{
        for (const guest of membersList) {
          if (handled.has(guest.id)) continue
          handled.add(guest.id)
          const size=partySize(guest)
          let table=candidates.find(item=>owner.get(item.id)===key && (remaining.get(item.id)||0)>=size)
          if (!table) table=candidates.find(item=>owner.get(item.id)===undefined && (remaining.get(item.id)||0)>=size)
          // Port literal del fallback de Tu Boda Organizada: primero busca una mesa
          // donde entre el grupo completo; como último recurso usa una mesa con algún
          // lugar disponible y deja la mesa excedida para revisión, en vez de separar
          // automáticamente a la familia/invitación.
          if (!table) table=candidates.find(item=>(remaining.get(item.id)||0)>=size) || candidates.find(item=>(remaining.get(item.id)||0)>0)
          if (!table) { unplaced.push(guest); continue }
          pairs.push({event_id:event.id,guest_id:guest.id,table_id:table.id})
          remaining.set(table.id,(remaining.get(table.id)||0)-size)
          if (owner.get(table.id)===undefined) owner.set(table.id,key)
        }
      }

      placeGroup(members('Niños',null),'Niños',nearEntrance)
      for (const relationship of ['Familia directa','Familia']) {
        for (const side of SIDE_ORDER) placeGroup(members(relationship,side),`${relationship}·${side}`,nearCouple)
      }
      for (const side of SIDE_ORDER) placeGroup(members('Amigos',side),`Amigos·${side}`,nearDance)
      placeGroup(members('Trabajo',null),'Trabajo',nearCouple)
      placeGroup(members('Otro',null),'Otro',nearCouple)
      activeGuests.filter(guest=>!handled.has(guest.id)).forEach(guest=>unplaced.push(guest))

      const { error:clearError }=await supabase.from('seating_assignments').delete().eq('event_id',event.id)
      if (clearError) throw clearError
      if (pairs.length) {
        const { error:insertError }=await supabase.from('seating_assignments').insert(pairs)
        if (insertError) throw insertError
      }
      const labelUpdates=[]
      tables.forEach(table=>{
        const key=owner.get(table.id)
        if (key && !String(table.room_label||'').trim()) labelUpdates.push({table,label:labelForGroup(key)})
      })
      for (const item of labelUpdates) {
        if (!item.label) continue
        await supabase.from('event_tables').update({room_label:item.label}).eq('id',item.table.id).eq('event_id',event.id)
      }
      setUndoSnapshot(previous)
      const placedPeople=pairs.reduce((sum,row)=>sum+partySize(guestById.get(row.guest_id)),0)
      const waitingPeople=unplaced.reduce((sum,guest)=>sum+partySize(guest),0)
      setNotice(`✓ Protocolo aplicado: ${placedPeople} personas ubicadas${waitingPeople?` · ${waitingPeople} quedaron en Banco de espera`:''}.`)
      await loadAll()
    } catch(err) { setError(err.message || 'No se pudo aplicar el protocolo.') }
    setBusy(false)
  }

  async function exportDistribution() {
    if (!guests.length && !tables.length) return setNotice('Todavía no hay datos para exportar.')
    clearMessages()
    try {
      await downloadWorkbook(`mesas_${safeName(event.name)}.xlsx`,async(XL,workbook)=>{
        const tableRows=[['Mesa','Etiqueta','Forma','Capacidad','Personas','Lugares libres','Estado']]
        tables.forEach(table=>{
          const used=occupancy.get(table.id)||0, cap=Math.max(1,Number(table.capacity||defaultCapacity))
          tableRows.push([table.name,table.room_label||'',shapeLabel(table.shape),cap,used,Math.max(0,cap-used),used>cap?'Excedida':used===cap?'Completa':'Disponible'])
        })
        const distRows=[['Mesa','Invitación','Personas','Lado','Parentesco','Confirmación','Restricción','Sentados']]
        tables.forEach(table=>{
          ;(seatsByTable.get(table.id)||[]).sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'es')).forEach(guest=>{
            distRows.push([table.name,guest.full_name,partySize(guest),guest.side_label||'Ambos',guest.relationship||'Otro',STATUS_LABELS[guest.invitation_status]||'Pendiente',guest.meal_preference||'Ninguna',Math.min(partySize(guest),Math.max(0,Number(guest.seated_count||0)))])
          })
        })
        const waitRows=[['Invitación','Personas','Lado','Parentesco','Confirmación','Restricción']]
        waiting.forEach(guest=>waitRows.push([guest.full_name,partySize(guest),guest.side_label||'Ambos',guest.relationship||'Otro',STATUS_LABELS[guest.invitation_status]||'Pendiente',guest.meal_preference||'Ninguna']))
        const wsTables=XL.utils.aoa_to_sheet(tableRows), wsDist=XL.utils.aoa_to_sheet(distRows), wsWait=XL.utils.aoa_to_sheet(waitRows)
        wsTables['!cols']=[{wch:16},{wch:22},{wch:15},{wch:12},{wch:12},{wch:14},{wch:14}]
        wsDist['!cols']=[{wch:16},{wch:30},{wch:10},{wch:12},{wch:18},{wch:16},{wch:20},{wch:10}]
        wsWait['!cols']=[{wch:30},{wch:10},{wch:12},{wch:18},{wch:16},{wch:20}]
        XL.utils.book_append_sheet(workbook,wsTables,'Mesas')
        XL.utils.book_append_sheet(workbook,wsDist,'Distribución')
        XL.utils.book_append_sheet(workbook,wsWait,'Banco de espera')
      })
      setNotice('✓ Distribución exportada a Excel.')
    } catch(err) { setError(err.message || 'No se pudo exportar la distribución.') }
  }

  function startTableDrag(event,table) {
    if (view!=='salon') return
    event.preventDefault(); event.stopPropagation()
    setDraggingTableId(table.id); setSelectedTableId(table.id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveTable(event,table) {
    if (draggingTableId!==table.id || !canvasRef.current) return
    const rect=canvasRef.current.getBoundingClientRect()
    const x=Math.min(95,Math.max(5,((event.clientX-rect.left)/rect.width)*100))
    const y=Math.min(92,Math.max(12,((event.clientY-rect.top)/rect.height)*100))
    setTables(prev=>prev.map(item=>item.id===table.id?{...item,pos_x:x,pos_y:y}:item))
  }

  async function endTableDrag(event,table) {
    if (draggingTableId!==table.id) return
    event.preventDefault(); event.stopPropagation()
    setDraggingTableId('')
    const current=tables.find(item=>item.id===table.id)
    if (!current) return
    const { error:updateError }=await supabase.from('event_tables').update({pos_x:current.pos_x,pos_y:current.pos_y}).eq('id',table.id).eq('event_id',event.id)
    if (updateError) setError(updateError.message)
    else setNotice(`✓ Posición de ${table.name} guardada.`)
  }

  if (loading) return <div className="panel loading-panel">Cargando mesas…</div>

  return <section className="tables-module">
    <header className="tables-hero">
      <div className="tables-hero-top">
        <div>
          <p className="eyebrow">MESAS · PROTOCOLO</p>
          <h2>Distribución de mesas</h2>
          <p>{stats.totalPeople} personas activas · {stats.locatedPeople} ubicadas · <strong>{stats.waitingPeople} en espera</strong></p>
        </div>
        <div className="tables-actions">
          <button className="primary-btn" onClick={()=>createTable()} disabled={busy}>+ Mesa</button>
          <button className="secondary-btn tables-protocol-btn" onClick={seatByProtocol} disabled={busy || !tables.length}>👨‍👩‍👧 Sentar por protocolo</button>
          {undoSnapshot&&<button className="secondary-btn" onClick={undoProtocol} disabled={busy}>↩ Deshacer</button>}
          <button className="secondary-btn" onClick={exportDistribution}>↓ Exportar distribución</button>
        </div>
      </div>
      <div className="tables-stats">
        <Stat value={stats.tables} label="Mesas" />
        <Stat value={stats.capacity} label="Capacidad total" />
        <Stat value={stats.locatedPeople} label="Ubicados" tone="good" />
        <Stat value={stats.waitingPeople} label="En espera" tone={stats.waitingPeople?'warn':''} />
        <Stat value={stats.complete} label="Completas" />
        <Stat value={stats.over} label="Excedidas" tone={stats.over?'bad':''} />
      </div>
      <div className="tables-progress"><i style={{width:`${stats.totalPeople?Math.min(100,(stats.locatedPeople/stats.totalPeople)*100):0}%`}} /></div>
    </header>

    {error&&<div className="form-error tables-message">{error}</div>}
    {notice&&<div className="success-message tables-message">{notice}</div>}
    {deletedTable&&<div className="tables-undo-delete"><span>{deletedTable.table.name} fue eliminada.</span><button onClick={undoDeleteTable} disabled={busy}>↩ Deshacer eliminación</button></div>}

    <div className="tables-step-row">
      <Link to="../invitados"><b>1</b><span><strong>Lista de invitados</strong><small>Confirmaciones, grupos y restricciones.</small></span></Link>
      <button className={view==='tables'?'active':''} onClick={()=>setSearchParams({})}><b>2</b><span><strong>Distribuir en mesas</strong><small>Banco de espera, capacidades y grupos.</small></span></button>
      <button className={view==='salon'?'active':''} onClick={()=>setSearchParams({view:'salon'})}><b>3</b><span><strong>Diseñar el salón</strong><small>Presets, ambientes, medidas y canvas conectado.</small></span></button>
    </div>

    <div className="tables-tools-strip">
      <div><strong>Personas por mesa</strong><span>Valor por defecto para nuevas mesas</span></div>
      <div className="tables-cap-buttons">{DEFAULT_CAPACITIES.map(cap=><button key={cap} className={defaultCapacity===cap?'active':''} onClick={()=>setDefaultCapacity(cap)}>{cap}</button>)}</div>
      {neededTables>0&&<button className="secondary-btn" onClick={createNeededTables} disabled={busy}>+ Crear {neededTables} {neededTables===1?'mesa necesaria':'mesas necesarias'}</button>}
      <button className="text-danger-btn" onClick={emptyAllTables}>Vaciar todas las mesas</button>
    </div>

    {view==='tables'
      ? <DistributionWorkspace
          tables={tables} waiting={filteredWaiting} waitingAll={waiting} waitingSearch={waitingSearch} setWaitingSearch={setWaitingSearch}
          occupancy={occupancy} seatsByTable={seatsByTable} selectedGuestId={selectedGuestId} setSelectedGuestId={setSelectedGuestId}
          selectedTableId={selectedTableId} setSelectedTableId={setSelectedTableId} assignGuest={assignGuest} moveToWaiting={moveToWaiting}
          dragGuestId={dragGuestId} setDragGuestId={setDragGuestId} defaultCapacity={defaultCapacity}
          createTable={createTable} updateTable={updateTable} emptyTable={emptyTable} deleteTable={deleteTable}
        />
      : <SalonDesignerWorkspace
          event={event} guests={guests} tables={tables} setTables={setTables} seating={seating} seatsByTable={seatsByTable} occupancy={occupancy}
          selectedTableId={selectedTableId} setSelectedTableId={setSelectedTableId} selectedGuestId={selectedGuestId} setSelectedGuestId={setSelectedGuestId}
          defaultCapacity={defaultCapacity} createTable={createTable} updateTable={updateTable} assignGuest={assignGuest} moveToWaiting={moveToWaiting}
          emptyTable={emptyTable} deleteTable={deleteTable} loadAll={loadAll} setError={setError} setNotice={setNotice}
          seatByProtocol={seatByProtocol} undoProtocol={undoProtocol} undoSnapshot={undoSnapshot} busy={busy}
        />
    }

    <div className="tables-protocol-note">
      <div>💡</div><div><strong>Cómo aplica el protocolo</strong><p>Conserva cada invitación o familia completa. Prioriza familia directa cerca de la mesa principal, amigos cerca de la pista, niños cerca de la entrada y grupos de trabajo juntos. Solo mezcla grupos como último recurso; lo que no entra queda en el Banco de espera.</p></div>
    </div>
  </section>
}

function DistributionWorkspace({ tables,waiting,waitingAll,waitingSearch,setWaitingSearch,occupancy,seatsByTable,selectedGuestId,setSelectedGuestId,selectedTableId,setSelectedTableId,assignGuest,moveToWaiting,dragGuestId,setDragGuestId,defaultCapacity,createTable,updateTable,emptyTable,deleteTable }) {
  const selected=tables.find(table=>table.id===selectedTableId)||null
  const selectedGuests=selected?(seatsByTable.get(selected.id)||[]):[]
  return <div className="tables-workspace">
    <aside className="tables-waiting-bank" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragGuestId)moveToWaiting(dragGuestId);setDragGuestId('')}}>
      <div className="tables-bank-head"><div><p>Banco de espera</p><strong>{waitingAll.length} invitaciones</strong></div><span>{waitingAll.reduce((sum,g)=>sum+partySize(g),0)} personas</span></div>
      <input value={waitingSearch} onChange={e=>setWaitingSearch(e.target.value)} placeholder="Buscar invitación…" />
      <div className="tables-bank-list">
        {waiting.map(guest=><GuestChip key={guest.id} guest={guest} selected={selectedGuestId===guest.id} onClick={()=>setSelectedGuestId(selectedGuestId===guest.id?'':guest.id)} onDragStart={()=>setDragGuestId(guest.id)} />)}
        {!waiting.length&&<div className="tables-empty-bank">{waitingSearch?'Sin resultados.':'✓ No quedan invitaciones en espera.'}</div>}
      </div>
      {selectedGuestId&&<div className="tables-bank-tip">Invitación seleccionada. Ahora tocá una mesa disponible.</div>}
    </aside>

    <main className="tables-grid-area">
      <div className="tables-grid-head"><div><p className="eyebrow">DISTRIBUCIÓN</p><h3>Mesas del evento</h3></div><small>Arrastrá una invitación o seleccionala y después tocá una mesa.</small></div>
      <div className="tables-card-grid">
        {tables.map(table=>{
          const used=occupancy.get(table.id)||0, cap=Math.max(1,Number(table.capacity||defaultCapacity)), over=used>cap, full=used===cap
          const people=(seatsByTable.get(table.id)||[])
          return <article key={table.id} className={`seating-table-card ${selectedTableId===table.id?'selected':''} ${over?'over':full?'full':''}`}
            onClick={()=>{ if(selectedGuestId) assignGuest(selectedGuestId,table.id); else setSelectedTableId(table.id) }}
            onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('drag-over')}}
            onDragLeave={e=>e.currentTarget.classList.remove('drag-over')}
            onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('drag-over');if(dragGuestId)assignGuest(dragGuestId,table.id);setDragGuestId('')}}>
            <div className="seating-table-card-head"><div><span>{table.room_label||shapeLabel(table.shape)}</span><strong>{table.name}</strong></div><b>{used} / {cap}</b></div>
            <div className="seating-cap-track"><i style={{width:`${Math.min(100,(used/cap)*100)}%`}} /></div>
            <div className="seating-preview">
              {people.slice(0,3).map(guest=><div key={guest.id}><span>{guest.full_name}</span><small>×{partySize(guest)}</small></div>)}
              {people.length>3&&<button type="button" onClick={e=>{e.stopPropagation();setSelectedTableId(table.id)}}>Ver {people.length-3} más →</button>}
            </div>
            <div className="seating-table-foot">{over?<span className="bad">⚠ Excedida por {used-cap}</span>:full?<span className="good">✓ Mesa completa</span>:<span>{cap-used} lugares disponibles</span>}</div>
          </article>
        })}
        <button className="seating-add-table" onClick={()=>createTable()}><b>+</b><strong>Agregar mesa</strong><span>{defaultCapacity} personas por defecto</span></button>
      </div>
    </main>

    <aside className="tables-inspector">
      {selected ? <>
        <div className="tables-inspector-head"><div><p>MESA SELECCIONADA</p><h3>{selected.name}</h3></div><strong>{occupancy.get(selected.id)||0} / {Number(selected.capacity||defaultCapacity)}</strong></div>
        <label>Etiqueta / grupo<input key={`label-${selected.id}-${selected.room_label||''}`} defaultValue={selected.room_label||''} onBlur={e=>updateTable(selected,{room_label:e.target.value.trim() || null})} placeholder="Ej. Familia Novia" /></label>
        <label>Forma<select value={selected.shape||'round'} onChange={e=>updateTable(selected,{shape:e.target.value})}><option value="round">Redonda</option><option value="square">Cuadrada</option><option value="rectangular">Rectangular</option><option value="other">Otra</option></select></label>
        <div className="tables-inspector-label">Capacidad</div>
        <div className="tables-inspector-caps">{DEFAULT_CAPACITIES.map(cap=><button key={cap} className={Number(selected.capacity)===cap?'active':''} onClick={()=>updateTable(selected,{capacity:cap})}>{cap}</button>)}</div>
        <div className="tables-inspector-label">Invitaciones asignadas · {selectedGuests.length}</div>
        <div className="tables-inspector-guests">
          {selectedGuests.map(guest=><div key={guest.id} draggable onDragStart={()=>setDragGuestId(guest.id)}><span><strong>{guest.full_name}</strong><small>{partySize(guest)} {partySize(guest)===1?'persona':'personas'} · {guest.relationship||'Otro'}</small></span><button title="Mover al Banco de espera" onClick={()=>moveToWaiting(guest.id)}>×</button></div>)}
          {!selectedGuests.length&&<p>Esta mesa está vacía. Elegí una invitación del Banco de espera y después tocá esta mesa.</p>}
        </div>
        <div className="tables-inspector-actions"><button className="secondary-btn" disabled={!selectedGuests.length} onClick={()=>emptyTable(selected)}>Vaciar esta mesa</button><button className="text-danger-btn" onClick={()=>deleteTable(selected)}>Eliminar mesa…</button></div>
      </> : <div className="tables-inspector-empty"><div>👆</div><strong>Elegí una mesa</strong><p>Vas a ver sus invitaciones, cambiar la capacidad, poner una etiqueta o vaciarla.</p></div>}
    </aside>
  </div>
}

function GuestChip({guest,selected,onClick,onDragStart}) {
  return <button type="button" draggable className={`waiting-guest-chip ${selected?'selected':''}`} onClick={onClick} onDragStart={onDragStart}>
    <span><strong>{guest.full_name}</strong><small>{STATUS_LABELS[guest.invitation_status]||'Pendiente'} · {guest.side_label||'Ambos'} · {guest.relationship||'Otro'}{guest.meal_preference && guest.meal_preference!=='Ninguna'?` · ⚠ ${guest.meal_preference}`:''}</small></span>
    <b>×{partySize(guest)}</b>
  </button>
}

function Stat({value,label,tone=''}) { return <div className={tone}><strong>{value}</strong><span>{label}</span></div> }

function shapeLabel(shape) {
  return ({round:'Redonda',square:'Cuadrada',rectangular:'Rectangular',other:'Otra'})[shape] || 'Redonda'
}
