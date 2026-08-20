import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import './salonDesignerInteractions.css'
import {
  ELEMENT_CATALOG,
  GUEST_COUNT_OPTIONS,
  L_SHAPE_OPTIONS,
  ROOM_SIZE_OPTION_LABELS,
  SALON_PRESETS,
  SALON_SHAPES,
  TABLE_VISUAL_TYPES,
  U_SHAPE_OPTIONS,
  analyzeSalonCapacity,
  buildPresetLayout,
  getExactReferenceRoomSize,
  getRoomSize,
  shapeClipPath,
  suggestedCapacity,
  tableMeasuresForCapacity,
} from './salonPresets.js'

const STATUS_LABELS={pending:'Pendiente',confirmed:'Confirmado',declined:'No va'}
const ELEMENT_BY_ID=new Map(ELEMENT_CATALOG.map(item=>[item.id,item]))
const CATEGORY_ORDER=['Principales','Comida y bebida','Decoración','Lounge y música','Servicios','Ceremonia / zonas']

function partySize(guest){ return Math.max(1,Number(guest?.party_size||1)) }
function tableNumber(table){ const m=String(table?.name||'').match(/\d+/); return m?Number(m[0]):null }
function clamp(v,min,max){ return Math.min(max,Math.max(min,Number(v)||0)) }
function isUuid(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'')) }
function nextTableNumber(tables){ return Math.max(0,...tables.map(tableNumber).filter(Boolean))+1 }
function tableType(table){
  if(table?.visual_type && TABLE_VISUAL_TYPES[table.visual_type]) return table.visual_type
  if(table?.shape==='round') return 'round'
  if(table?.shape==='square') return 'square'
  return 'rect_h'
}
function positionOf(table,index,total){
  const x=Number(table?.pos_x),y=Number(table?.pos_y)
  if(Number.isFinite(x)&&Number.isFinite(y)) return {x:clamp(x,2,98),y:clamp(y,2,98)}
  const cols=Math.max(2,Math.ceil(Math.sqrt(Math.max(1,total))))
  const row=Math.floor(index/cols),col=index%cols
  return {x:15+col*(70/Math.max(1,cols-1)),y:22+row*18}
}
function displayPax(guests=[]){ return guests.reduce((sum,g)=>sum+partySize(g),0) }
function safeJson(value,fallback={}){ try{return value&&typeof value==='object'?value:JSON.parse(value||'{}')}catch{return fallback} }
function expandedPeople(guestList=[]){
  const people=[]
  guestList.forEach(guest=>{
    const count=partySize(guest)
    for(let i=0;i<count;i+=1){
      people.push({
        guestId:guest.id,
        personIndex:i,
        name:count>1?`${guest.full_name} ${i+1}`:guest.full_name,
        baseName:guest.full_name,
        status:guest.invitation_status,
      })
    }
  })
  return people
}
function seatPositions(type,count,widthM=1.8,heightM=1.8){
  // Port visual de Tu Boda Organizada: redondas en círculo; cuadradas,
  // rectangulares e imperiales reparten sillas sobre sus lados reales.
  const total=Math.max(1,Number(count)||1)
  if(type==='round'){
    return Array.from({length:total},(_,i)=>{
      const angle=(i/total)*Math.PI*2-Math.PI/2
      return {left:50+Math.cos(angle)*72,top:50+Math.sin(angle)*72,rotation:angle*180/Math.PI+90}
    })
  }
  const w=Math.max(.6,Number(widthM)||1.8),h=Math.max(.6,Number(heightM)||1.8)
  const nH=Math.max(w>=h?1:0,Math.floor(w/.55))
  const nV=Math.max(h>w?1:0,Math.floor(h/.55))
  const all=[]
  const addTop=()=>{for(let i=0;i<nH;i+=1)all.push({left:100*(i+1)/(nH+1),top:-22,rotation:0})}
  const addRight=()=>{for(let i=0;i<nV;i+=1)all.push({left:122,top:100*(i+1)/(nV+1),rotation:90})}
  const addBottom=()=>{for(let i=0;i<nH;i+=1)all.push({left:100*(i+1)/(nH+1),top:122,rotation:180})}
  const addLeft=()=>{for(let i=0;i<nV;i+=1)all.push({left:-22,top:100*(i+1)/(nV+1),rotation:-90})}
  addTop();addRight();addBottom();addLeft()
  // Si por una medida manual hay menos puntos geométricos que capacidad,
  // completamos por perímetro sin superponer todo en una sola cara.
  if(all.length<total){
    const missing=total-all.length
    for(let i=0;i<missing;i+=1){
      const k=i%4
      const step=(Math.floor(i/4)+1)/(Math.ceil(missing/4)+1)
      if(k===0)all.push({left:step*100,top:-22,rotation:0})
      if(k===1)all.push({left:122,top:step*100,rotation:90})
      if(k===2)all.push({left:(1-step)*100,top:122,rotation:180})
      if(k===3)all.push({left:-22,top:(1-step)*100,rotation:-90})
    }
  }
  return all.slice(0,total)
}
const SEAT_STATUS_CLASS={confirmed:'confirmed',pending:'pending',declined:'declined'}

export default function SalonDesignerWorkspace({
  event, guests, tables, setTables, seating, seatsByTable, occupancy, selectedTableId, setSelectedTableId,
  selectedGuestId, setSelectedGuestId, defaultCapacity, createTable, updateTable, assignGuest, moveToWaiting,
  emptyTable, deleteTable, loadAll, setError, setNotice, seatByProtocol, undoProtocol, undoSnapshot, busy:parentBusy=false,
}){
  const [environments,setEnvironments]=useState([])
  const [elements,setElements]=useState([])
  const [activeEnvId,setActiveEnvId]=useState('')
  const [selectedElementId,setSelectedElementId]=useState('')
  const [showPresets,setShowPresets]=useState(false)
  const [previewPreset,setPreviewPreset]=useState(null)
  const [previewModalPreset,setPreviewModalPreset]=useState(null)
  const [showElements,setShowElements]=useState(false)
  const [elementCategory,setElementCategory]=useState('Principales')
  const [guestSearch,setGuestSearch]=useState('')
  const [dragGuestId,setDragGuestId]=useState('')
  const [activeSeatCard,setActiveSeatCard]=useState(null)
  const [zoom,setZoom]=useState(1)
  const [busy,setBusy]=useState(false)
  const [presetAction,setPresetAction]=useState(null)
  const [guestCountChoice,setGuestCountChoice]=useState(150)
  const [roomSizeChoice,setRoomSizeChoice]=useState('recommended')
  const floorRef=useRef(null)
  const dragRef=useRef(null)
  const dragListenersRef=useRef(null)
  const suppressTableClickRef=useRef(false)
  const saveSequenceRef=useRef(0)
  const geometryRepairRef=useRef(new Set())
  const presetTouchRef=useRef(null)

  const activeGuests=useMemo(()=>guests.filter(g=>g.invitation_status!=='declined'),[guests])
  const guestById=useMemo(()=>new Map(guests.map(g=>[g.id,g])),[guests])
  const tableIdByGuest=useMemo(()=>new Map(seating.map(row=>[row.guest_id,row.table_id])),[seating])
  const activeEnv=environments.find(env=>env.id===activeEnvId)||environments[0]||null
  const activeTables=useMemo(()=>{
    if(!activeEnv) return []
    return tables.filter(table=>table.environment_id===activeEnv.id || (!table.environment_id && environments[0]?.id===activeEnv.id))
      .sort((a,b)=>(tableNumber(a)??9999)-(tableNumber(b)??9999)||String(a.name).localeCompare(String(b.name),'es'))
  },[tables,activeEnv,environments])
  const activeElements=useMemo(()=>activeEnv?elements.filter(el=>el.environment_id===activeEnv.id):[],[elements,activeEnv])
  const protocolReferences=useMemo(()=>{
    const centerOf=(el,fallback)=>el?{x:clamp(el.pos_x,0,100),y:clamp(el.pos_y,0,100)}:fallback
    const couple=activeElements.find(el=>el.type==='novios') || activeElements.find(el=>el.type==='presidencial')
    const dance=activeElements.find(el=>el.type==='pista')
    const entrance=activeElements.find(el=>el.type==='entrada') || activeElements.find(el=>el.type==='salida')
    return {couple:centerOf(couple,{x:50,y:8}),dance:centerOf(dance,{x:50,y:54}),entrance:centerOf(entrance,{x:50,y:94})}
  },[activeElements])
  const selectedTable=tables.find(table=>table.id===selectedTableId)||null
  const selectedElement=elements.find(el=>el.id===selectedElementId)||null
  const selectedTableGuests=selectedTable?(seatsByTable.get(selectedTable.id)||[]):[]
  const waiting=useMemo(()=>activeGuests.filter(g=>!tableIdByGuest.has(g.id)).sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),'es')),[activeGuests,tableIdByGuest])
  const visibleWaiting=useMemo(()=>{
    const q=guestSearch.trim().toLowerCase(); if(!q) return waiting
    return waiting.filter(g=>[g.full_name,g.relationship,g.side_label].some(v=>String(v||'').toLowerCase().includes(q)))
  },[waiting,guestSearch])
  const totalPeople=useMemo(()=>activeGuests.reduce((s,g)=>s+partySize(g),0),[activeGuests])
  const activePeople=useMemo(()=>activeTables.reduce((sum,t)=>sum+(occupancy.get(t.id)||0),0),[activeTables,occupancy])
  const capacityTarget=useMemo(()=>totalPeople||Number(event.estimated_guests)||guestCountChoice||150,[totalPeople,event.estimated_guests,guestCountChoice])
  const roomAnalysis=useMemo(()=>analyzeSalonCapacity({widthM:Number(activeEnv?.width_m)||26,heightM:Number(activeEnv?.height_m)||18,guestCount:capacityTarget,tables:activeTables}),[activeEnv?.width_m,activeEnv?.height_m,capacityTarget,activeTables])
  const activePreset=useMemo(()=>SALON_PRESETS.find(p=>p.id===activeEnv?.preset_id)||null,[activeEnv?.preset_id])
  const presetPlan=useMemo(()=>{
    if(!activePreset) return null
    return buildPresetLayout(activePreset.id,null,null,{guestCount:guestCountChoice||capacityTarget,roomSizeOption:roomSizeChoice}).layoutSummary||null
  },[activePreset,guestCountChoice,capacityTarget,roomSizeChoice])
  const presetCapacityShort=Boolean(presetPlan && Number(presetPlan.capacidadSentada||0)<capacityTarget)

  // Repara mesas redondas/cuadradas creadas por versiones anteriores donde X e Y
  // se habían escalado con proporciones distintas del salón y quedaban ovaladas.
  useEffect(()=>{
    for(const table of activeTables){
      const type=tableType(table)
      if(type!=='round' && type!=='square') continue
      const w=Number(table.width_m)||1.8,h=Number(table.height_m)||1.8
      if(Math.abs(w-h)<.03 || geometryRepairRef.current.has(table.id)) continue
      geometryRepairRef.current.add(table.id)
      const diameter=type==='round'?clamp((w+h)/2,1.6,2.2):clamp((w+h)/2,1.4,2.4)
      updateTable(table,{width_m:+diameter.toFixed(2),height_m:+diameter.toFixed(2)})
    }
  },[activeTables,updateTable])

  const loadDesigner=useCallback(async(preferredEnvId='')=>{
    const [envRes,elemRes]=await Promise.all([
      supabase.from('event_environments').select('*').eq('event_id',event.id).order('sort_order').order('created_at'),
      supabase.from('salon_elements').select('*').eq('event_id',event.id).order('created_at'),
    ])
    const firstError=envRes.error||elemRes.error
    if(firstError){ setError(firstError.message); return }
    let envs=envRes.data||[]
    if(!envs.length){
      const base=getRoomSize(event.estimated_guests||totalPeople||150,'recommended')
      const row={id:crypto.randomUUID(),event_id:event.id,name:'Salón principal',width_m:base.W,height_m:base.H,shape:'rectangle',shape_config:{},sort_order:0}
      const {error}=await supabase.from('event_environments').insert(row)
      if(error){setError(error.message);return}
      envs=[row]
    }
    setEnvironments(envs)
    setElements(elemRes.data||[])
    setActiveEnvId(current=>preferredEnvId&&envs.some(e=>e.id===preferredEnvId)?preferredEnvId:(current&&envs.some(e=>e.id===current)?current:envs[0].id))
  },[event.id,event.estimated_guests,totalPeople,setError])

  useEffect(()=>{ loadDesigner() },[loadDesigner])
  useEffect(()=>()=>detachDragListeners(),[])
  useEffect(()=>{
    const n=Number(event.estimated_guests)||totalPeople||150
    setGuestCountChoice(GUEST_COUNT_OPTIONS.reduce((best,x)=>Math.abs(x-n)<Math.abs(best-n)?x:best,150))
  },[event.estimated_guests,totalPeople])

  async function patchEnvironment(patch){
    if(!activeEnv) return
    setEnvironments(prev=>prev.map(env=>env.id===activeEnv.id?{...env,...patch}:env))
    const {error}=await supabase.from('event_environments').update({...patch,updated_at:new Date().toISOString()}).eq('id',activeEnv.id).eq('event_id',event.id)
    if(error) setError(error.message)
  }

  async function addEnvironment(){
    const base=getRoomSize(totalPeople||event.estimated_guests||150,'recommended')
    const next=environments.length+1
    const row={id:crypto.randomUUID(),event_id:event.id,name:`Ambiente ${next}`,width_m:base.W,height_m:base.H,shape:'rectangle',shape_config:{},sort_order:environments.length}
    const {error}=await supabase.from('event_environments').insert(row)
    if(error) return setError(error.message)
    setNotice(`✓ ${row.name} creado. Cada ambiente tiene su propio plano.`)
    await loadDesigner(row.id)
  }

  async function deleteEnvironment(){
    if(!activeEnv || environments.length<=1) return setError('El evento necesita al menos un ambiente.')
    const target=environments.find(env=>env.id!==activeEnv.id)
    const countTables=activeTables.length
    const text=countTables?` Las ${countTables} mesas pasarán a ${target.name}; sus invitados no se pierden.`:' Sus elementos visuales se eliminarán.'
    if(!window.confirm(`¿Eliminar “${activeEnv.name}”?${text}`)) return
    setBusy(true)
    if(countTables){
      const {error:moveError}=await supabase.from('event_tables').update({environment_id:target.id}).eq('event_id',event.id).eq('environment_id',activeEnv.id)
      if(moveError){setBusy(false);return setError(moveError.message)}
    }
    const {error}=await supabase.from('event_environments').delete().eq('id',activeEnv.id).eq('event_id',event.id)
    setBusy(false)
    if(error) return setError(error.message)
    setSelectedTableId('');setSelectedElementId('');setNotice('✓ Ambiente eliminado; la distribución de invitados se conservó.')
    await Promise.all([loadAll(),loadDesigner(target.id)])
  }

  async function applyRoomSize(option){
    if(!activeEnv) return
    const size=activeEnv?.preset_id?getExactReferenceRoomSize(guestCountChoice||capacityTarget,option):getRoomSize(guestCountChoice,option)
    setRoomSizeChoice(option)
    await patchEnvironment({width_m:size.W,height_m:size.H})
    setNotice(`✓ Medidas sugeridas aplicadas: ${size.label}.`)
  }

  function requestPreset(preset){
    if(!activeEnv) return
    const current=analyzeSalonCapacity({widthM:Number(activeEnv.width_m)||26,heightM:Number(activeEnv.height_m)||18,guestCount:capacityTarget,tables:activeTables})
    const recommended=getExactReferenceRoomSize(guestCountChoice||capacityTarget,roomSizeChoice)
    setPresetAction({preset,current,recommended})
  }

  function onPresetTouchStart(e,preset){
    const touch=e.touches?.[0]
    if(!touch) return
    presetTouchRef.current={preset,x:touch.clientX,y:touch.clientY,moved:false}
  }
  function onPresetTouchMove(e){
    const touch=e.touches?.[0],start=presetTouchRef.current
    if(!touch||!start) return
    if(Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>10) start.moved=true
  }
  function onPresetTouchEnd(e,preset){
    const start=presetTouchRef.current
    presetTouchRef.current=null
    if(start?.moved) return
    e.preventDefault();e.stopPropagation()
    setPreviewPreset(preset)
    setPreviewModalPreset(preset)
  }

  async function applyPreset(preset){
    if(!activeEnv) return
    const guestCount=guestCountChoice||capacityTarget||150
    // PORT DIRECTO de aplicarPreset() de Tu Boda Organizada:
    // el preset reemplaza el plano, conserva el número lógico de mesa (1..N)
    // y por eso las invitaciones que ya estaban en una mesa equivalente siguen allí.
    // Solo las asignaciones a mesas que dejan de existir vuelven al Banco de espera.
    const layout=buildPresetLayout(preset.id,null,null,{guestCount,roomSizeOption:roomSizeChoice})
    if(!layout) return setError('No se pudo generar el preset.')
    const hasLayout=activeTables.length>0||activeElements.length>0
    if(hasLayout&&!window.confirm('Esto reemplaza el plano actual por un preset profesional editable. Después vas a poder mover y redimensionar mesas, pista, barra, DJ, lounge y todos los elementos. ¿Querés continuar?')) return

    setBusy(true);setError('')
    try{
      const activeIds=activeTables.map(table=>table.id)
      const oldTableNumberById=new Map(activeTables.map(table=>[table.id,tableNumber(table)]))
      const oldAssignments=(seating||[])
        .filter(row=>oldTableNumberById.has(row.table_id))
        .map(row=>({guest_id:row.guest_id,table_number:oldTableNumberById.get(row.table_id)}))
        .filter(row=>Number.isFinite(row.table_number))

      if(activeIds.length){
        const {error:seatError}=await supabase.from('seating_assignments').delete().eq('event_id',event.id).in('table_id',activeIds)
        if(seatError) throw seatError
      }
      const {error:delElements}=await supabase.from('salon_elements').delete().eq('event_id',event.id).eq('environment_id',activeEnv.id)
      if(delElements) throw delElements
      if(activeIds.length){
        const {error:tableError}=await supabase.from('event_tables').delete().eq('event_id',event.id).in('id',activeIds)
        if(tableError) throw tableError
      }

      if(layout.elements.length){
        const rows=layout.elements.map(el=>({
          id:crypto.randomUUID(),event_id:event.id,environment_id:activeEnv.id,type:el.type,label:el.label,
          pos_x:el.pos_x,pos_y:el.pos_y,width_m:el.width_m,height_m:el.height_m,rotation:el.rotation,
          is_non_physical:el.is_non_physical,metadata:{...(el.metadata||{}),source:'tu-boda-organizada'}
        }))
        const {error}=await supabase.from('salon_elements').insert(rows)
        if(error) throw error
      }

      // Igual que el SalonView original: las mesas del preset vuelven a ser 1..N.
      // No usamos el siguiente número global porque eso rompería la relación invitado ↔ mesa.
      const tableRows=layout.tables.map((slot,index)=>({
        id:crypto.randomUUID(),event_id:event.id,environment_id:activeEnv.id,name:`Mesa ${index+1}`,
        capacity:slot.capacity,shape:slot.shape,visual_type:slot.visual_type,pos_x:slot.pos_x,pos_y:slot.pos_y,
        width_m:slot.width_m,height_m:slot.height_m,rotation:0,room_label:slot.room_label,
      }))
      if(tableRows.length){
        const {error}=await supabase.from('event_tables').insert(tableRows)
        if(error) throw error
      }

      // Reproduce la persistencia lógica del original: Mesa 1 sigue siendo Mesa 1,
      // Mesa 2 sigue siendo Mesa 2, etc. Las mesas que ya no existen quedan en espera.
      const newTableByNumber=new Map(tableRows.map((table,index)=>[index+1,table.id]))
      const restoredAssignments=oldAssignments
        .filter(row=>newTableByNumber.has(row.table_number))
        .map(row=>({event_id:event.id,guest_id:row.guest_id,table_id:newTableByNumber.get(row.table_number)}))
      if(restoredAssignments.length){
        const {error:restoreError}=await supabase.from('seating_assignments').insert(restoredAssignments)
        if(restoreError) throw restoreError
      }

      const envPatch={
        preset_id:preset.id,width_m:layout.salonW,height_m:layout.salonH,shape:'rectangle',shape_config:{},updated_at:new Date().toISOString()
      }
      const {error:envError}=await supabase.from('event_environments').update(envPatch).eq('id',activeEnv.id).eq('event_id',event.id)
      if(envError) throw envError

      setPreviewPreset(null);setPresetAction(null);setShowPresets(false);setSelectedElementId('');setSelectedTableId('');setSelectedGuestId('')
      await Promise.all([loadAll(),loadDesigner(activeEnv.id)])
      const cap=Number(layout.layoutSummary?.capacidadSentada||0)
      const released=Math.max(0,oldAssignments.length-restoredAssignments.length)
      const warning=cap<capacityTarget
        ? ` Este estilo, tal como está armado, contempla ${cap} asientos para ${capacityTarget} invitados: podés agregar mesas, subir capacidad por mesa o elegir otro estilo.`
        : ''
      const releaseText=released?` ${released} invitación${released!==1?'es':''} de mesas que ya no existen quedó${released!==1?'aron':''} en Banco de espera.`:''
      setNotice(`✓ Preset aplicado: ${preset.label} · ${layout.tables.length} mesas del boceto original.${releaseText}${warning}`)
    }catch(err){setError(err.message||'No se pudo aplicar el preset.');setPresetAction(null)}
    setBusy(false)
  }

  async function emptyAllTables(){
    if(!activeTables.length) return
    const ids=activeTables.map(table=>table.id)
    const people=activeTables.reduce((sum,table)=>sum+(occupancy.get(table.id)||0),0)
    if(!window.confirm(`¿Vaciar todas las mesas de ${activeEnv.name}? ${people} personas volverán al Banco de espera. Las mesas se conservan.`)) return
    setBusy(true)
    const {error}=await supabase.from('seating_assignments').delete().eq('event_id',event.id).in('table_id',ids)
    setBusy(false)
    if(error)return setError(error.message)
    setSelectedGuestId('');setSelectedTableId('');setNotice(`✓ Mesas vaciadas. ${people} personas volvieron al Banco de espera.`)
    await loadAll()
  }

  async function deleteAllTables(){
    if(!activeTables.length) return
    const people=activeTables.reduce((sum,table)=>sum+(occupancy.get(table.id)||0),0)
    if(!window.confirm(`¿Eliminar las ${activeTables.length} mesas de ${activeEnv.name}? ${people?`${people} personas volverán al Banco de espera. `:''}Los elementos del salón no se eliminan.`)) return
    setBusy(true)
    const ids=activeTables.map(table=>table.id)
    const {error:seatError}=await supabase.from('seating_assignments').delete().eq('event_id',event.id).in('table_id',ids)
    if(seatError){setBusy(false);return setError(seatError.message)}
    const {error}=await supabase.from('event_tables').delete().eq('event_id',event.id).in('id',ids)
    setBusy(false)
    if(error)return setError(error.message)
    setSelectedGuestId('');setSelectedTableId('');setNotice(`✓ Mesas eliminadas.${people?` ${people} personas volvieron al Banco de espera.`:''}`)
    await loadAll()
  }

  async function clearCanvas(){
    if(!activeEnv) return
    if(!window.confirm('¿Crear desde cero? Se eliminan los elementos visuales y se mantienen las mesas y sus invitados.')) return
    const {error}=await supabase.from('salon_elements').delete().eq('event_id',event.id).eq('environment_id',activeEnv.id)
    if(error) return setError(error.message)
    await patchEnvironment({preset_id:null})
    setElements(prev=>prev.filter(el=>el.environment_id!==activeEnv.id));setSelectedElementId('');setNotice('✓ Canvas limpio. Tus mesas e invitados se conservaron.')
  }

  async function addElement(item){
    if(!activeEnv) return
    const same=activeElements.filter(el=>el.type===item.id).length
    const row={id:crypto.randomUUID(),event_id:event.id,environment_id:activeEnv.id,type:item.id,label:same?`${item.label} ${same+1}`:item.label,pos_x:50,pos_y:50,width_m:item.w,height_m:item.h,rotation:0,is_non_physical:false,metadata:{}}
    const {error}=await supabase.from('salon_elements').insert(row)
    if(error)return setError(error.message)
    setElements(prev=>[...prev,row]);setSelectedElementId(row.id);setSelectedTableId('');setShowElements(false);setNotice(`✓ ${item.label} agregado. Arrastralo a su lugar.`)
  }

  async function patchElement(element,patch){
    setElements(prev=>prev.map(el=>el.id===element.id?{...el,...patch}:el))
    const {error}=await supabase.from('salon_elements').update({...patch,updated_at:new Date().toISOString()}).eq('id',element.id).eq('event_id',event.id)
    if(error)setError(error.message)
  }

  async function deleteElement(element){
    const {error}=await supabase.from('salon_elements').delete().eq('id',element.id).eq('event_id',event.id)
    if(error)return setError(error.message)
    setElements(prev=>prev.filter(el=>el.id!==element.id));setSelectedElementId('');setNotice(`✓ ${element.label} eliminado del plano.`)
  }

  function pointerPos(event){
    const rect=floorRef.current?.getBoundingClientRect();if(!rect)return null
    return {x:clamp(((event.clientX-rect.left)/rect.width)*100,0,100),y:clamp(((event.clientY-rect.top)/rect.height)*100,0,100)}
  }

  function detachDragListeners(){
    const listeners=dragListenersRef.current
    if(!listeners)return
    window.removeEventListener('pointermove',listeners.move)
    window.removeEventListener('pointerup',listeners.up)
    window.removeEventListener('pointercancel',listeners.up)
    dragListenersRef.current=null
  }

  function startDrag(event,kind,entity){
    if(event.button!=null&&event.button!==0)return
    const isTable=kind.startsWith('table-')
    const current=entity && typeof entity==='object' ? entity : (isTable?tables.find(t=>t.id===entity):elements.find(el=>el.id===entity))
    const id=current?.id
    if(!isUuid(id)){
      setError(`No pudimos identificar ${isTable?'esta mesa':'este elemento'} para editarlo. Recargá la pantalla y volvé a intentarlo.`)
      return
    }
    const pointer=pointerPos(event)
    const rect=floorRef.current?.getBoundingClientRect()
    if(!pointer||!rect)return
    event.preventDefault();event.stopPropagation()
    detachDragListeners()
    const type=isTable?tableType(current):null
    const cfg=isTable?(TABLE_VISUAL_TYPES[type]||TABLE_VISUAL_TYPES.round):null
    const startWidth=Number(current.width_m)||(isTable?cfg.width:1)
    const startHeight=Number(current.height_m)||(isTable?cfg.height:1)
    const startX=Number(current.pos_x)||50,startY=Number(current.pos_y)||50
    const centerX=rect.left+(startX/100)*rect.width
    const centerY=rect.top+(startY/100)*rect.height
    dragRef.current={
      kind,id,isTable,type,
      original:{pos_x:startX,pos_y:startY,width_m:startWidth,height_m:startHeight,rotation:Number(current.rotation||0),capacity:isTable?Number(current.capacity||defaultCapacity):undefined},
      startPointer:pointer,lastPointer:pointer,
      startClientX:event.clientX,startClientY:event.clientY,
      centerClientX:centerX,centerClientY:centerY,
      startAngle:Math.atan2(event.clientY-centerY,event.clientX-centerX),
      moved:false,lastPatch:null,used:isTable?(occupancy.get(id)||0):0,
    }
    if(isTable){setSelectedTableId(id);setSelectedElementId('')}
    else{setSelectedElementId(id);setSelectedTableId('')}
    const listeners={move:moveDrag,up:endDrag}
    dragListenersRef.current=listeners
    window.addEventListener('pointermove',listeners.move,{passive:false})
    window.addEventListener('pointerup',listeners.up,{passive:false})
    window.addEventListener('pointercancel',listeners.up,{passive:false})
  }

  function moveDrag(event){
    const drag=dragRef.current;if(!drag)return
    const pointer=pointerPos(event);if(!pointer)return
    if(event.cancelable)event.preventDefault()
    const dxPct=pointer.x-drag.startPointer.x,dyPct=pointer.y-drag.startPointer.y
    if(Math.hypot(event.clientX-drag.startClientX,event.clientY-drag.startClientY)>3)drag.moved=true
    drag.lastPointer=pointer
    let patch=null
    if(drag.kind==='table-move'||drag.kind==='element-move'){
      patch={pos_x:+clamp(drag.original.pos_x+dxPct,1,99).toFixed(3),pos_y:+clamp(drag.original.pos_y+dyPct,1,99).toFixed(3)}
    }else if(drag.kind==='element-resize'){
      const dxM=(dxPct/100)*envWidth,dyM=(dyPct/100)*envHeight
      patch={width_m:+clamp(drag.original.width_m+dxM,.3,40).toFixed(2),height_m:+clamp(drag.original.height_m+dyM,.3,40).toFixed(2)}
    }else if(drag.kind==='table-resize'){
      const dxM=(dxPct/100)*envWidth,dyM=(dyPct/100)*envHeight
      let width,height
      if(drag.type==='round'||drag.type==='square'){
        const delta=Math.abs(dxM)>=Math.abs(dyM)?dxM:dyM
        const size=clamp(drag.original.width_m+delta,.8,20)
        width=height=+size.toFixed(2)
      }else{
        width=+clamp(drag.original.width_m+dxM,.8,25).toFixed(2)
        height=+clamp(drag.original.height_m+dyM,.8,25).toFixed(2)
      }
      patch={width_m:width,height_m:height,capacity:Math.max(drag.used,suggestedCapacity(drag.type,width,height))}
    }else if(drag.kind==='table-rotate'||drag.kind==='element-rotate'){
      const angle=Math.atan2(event.clientY-drag.centerClientY,event.clientX-drag.centerClientX)
      const delta=(angle-drag.startAngle)*(180/Math.PI)
      patch={rotation:Math.round((drag.original.rotation+delta)/15)*15}
    }
    if(!patch)return
    drag.lastPatch=patch
    if(drag.isTable)setTables(prev=>prev.map(item=>item.id===drag.id?{...item,...patch}:item))
    else setElements(prev=>prev.map(item=>item.id===drag.id?{...item,...patch}:item))
  }

  async function endDrag(pointerEvent){
    const drag=dragRef.current;if(!drag)return
    if(pointerEvent?.clientX!=null&&pointerEvent?.clientY!=null)moveDrag(pointerEvent)
    const finalDrag={...dragRef.current,lastPatch:dragRef.current?.lastPatch?{...dragRef.current.lastPatch}:null}
    dragRef.current=null
    detachDragListeners()
    if(finalDrag.moved) suppressTableClickRef.current=true
    if(!finalDrag.lastPatch||!finalDrag.moved)return
    if(!isUuid(finalDrag.id)){
      setError(`No pudimos guardar el cambio porque ${finalDrag.isTable?'la mesa':'el elemento'} perdió su identificador.`)
      return
    }
    const seq=++saveSequenceRef.current
    if(finalDrag.isTable){
      const patch=finalDrag.lastPatch
      const {data,error}=await supabase.from('event_tables').update(patch).eq('id',finalDrag.id).eq('event_id',event.id).select('*').single()
      if(seq!==saveSequenceRef.current)return
      if(error){
        setTables(prev=>prev.map(item=>item.id===finalDrag.id?{...item,...finalDrag.original}:item))
        setError(`No pudimos guardar el cambio de la mesa: ${error.message}`)
        return
      }
      setTables(prev=>prev.map(item=>item.id===finalDrag.id?{...item,...data}:item))
    }else{
      const patch={...finalDrag.lastPatch,updated_at:new Date().toISOString()}
      const {data,error}=await supabase.from('salon_elements').update(patch).eq('id',finalDrag.id).eq('event_id',event.id).select('*').single()
      if(seq!==saveSequenceRef.current)return
      if(error){
        setElements(prev=>prev.map(item=>item.id===finalDrag.id?{...item,...finalDrag.original}:item))
        setError(`No pudimos guardar el cambio del elemento: ${error.message}`)
        return
      }
      setElements(prev=>prev.map(item=>item.id===finalDrag.id?{...item,...data}:item))
    }
  }

  async function changeTableType(table,typeId){
    const cfg=TABLE_VISUAL_TYPES[typeId]||TABLE_VISUAL_TYPES.round
    const used=occupancy.get(table.id)||0
    const baseCapacity=Math.max(used,Number(cfg.defaultCapacity||cfg.capacities?.[0]||8))
    const measures=tableMeasuresForCapacity(typeId,baseCapacity)
    const patch={
      visual_type:typeId,
      shape:cfg.dbShape,
      width_m:measures.width,
      height_m:measures.height,
      capacity:baseCapacity,
      rotation:typeId==='round'?0:Number(table.rotation||0),
    }
    await updateTable(table,patch)
  }

  async function setTableCapacity(table,capacity){
    const type=tableType(table)
    const used=occupancy.get(table.id)||0
    const next=Math.max(used,Number(capacity)||0)
    const measures=tableMeasuresForCapacity(type,next)
    await updateTable(table,{capacity:next,width_m:measures.width,height_m:measures.height})
  }

  async function setTableMeasures(table,widthValue,heightValue){
    const type=tableType(table)
    const w=clamp(widthValue,.6,25)
    const h=(type==='round'||type==='square')?w:clamp(heightValue,.6,25)
    const recommended=suggestedCapacity(type,w,h)
    const used=occupancy.get(table.id)||0
    await updateTable(table,{width_m:+w.toFixed(2),height_m:+h.toFixed(2),capacity:Math.max(used,recommended)})
  }

  async function moveTableEnvironment(table,environmentId){
    await updateTable(table,{environment_id:environmentId,pos_x:50,pos_y:50})
    setNotice(`✓ ${table.name} movida de ambiente sin cambiar sus invitados.`)
  }

  const envShapeConfig=safeJson(activeEnv?.shape_config,{})
  const floorClip=shapeClipPath(activeEnv?.shape||'rectangle',envShapeConfig)
  const elementCategories=useMemo(()=>CATEGORY_ORDER.map(category=>({category,items:ELEMENT_CATALOG.filter(item=>item.category===category)})),[])
  const envWidth=Number(activeEnv?.width_m)||26,envHeight=Number(activeEnv?.height_m)||18

  if(!activeEnv)return <div className="panel loading-panel">Preparando diseñador del salón…</div>

  return <div className="salon-designer-v12">
    <div className="salon-v12-envbar">
      <div className="salon-v12-envtabs">
        {environments.map(env=>{
          const envTables=tables.filter(t=>t.environment_id===env.id),people=envTables.reduce((s,t)=>s+(occupancy.get(t.id)||0),0)
          return <button key={env.id} className={env.id===activeEnv.id?'active':''} onClick={()=>{setActiveEnvId(env.id);setSelectedTableId('');setSelectedElementId('')}}><strong>{env.name}</strong><small>{Number(env.width_m)}×{Number(env.height_m)} m · {envTables.length} mesas · {people} personas</small></button>
        })}
        <button className="salon-v12-add-env" onClick={addEnvironment}>+ Agregar ambiente</button>
      </div>
    </div>

    <div className="salon-v12-toolbar">
      <div className="salon-v12-toolbar-title"><p className="eyebrow">DISEÑO DEL SALÓN</p><h3>{activeEnv.name}</h3><span>Plano conectado con Invitados y Mesas. Arrastrá, medí, agregá ambientes y mové invitados sin duplicar datos.</span></div>
      <div className="salon-v12-toolbar-actions">
        <button className="secondary-btn" onClick={()=>setShowPresets(v=>!v)}>▦ Presets</button>
        <button className="secondary-btn" onClick={()=>setShowElements(v=>!v)}>＋ Elementos</button>
        <button className="secondary-btn" onClick={()=>createTable({environmentId:activeEnv.id})}>＋ Mesa</button>
        <button className="secondary-btn" onClick={clearCanvas}>Crear desde cero</button>
      </div>
    </div>

    {showPresets&&<div className="salon-v12-presets salon-v141-presets">
      <div className="salon-v12-presets-head"><div><strong>Presets de Tu Boda Organizada</strong><span>Un clic previsualiza. Doble clic abre la vista grande para usar el preset. Si no entran todos en pantalla, desplazate horizontalmente sin ampliar la página.</span></div><button onClick={()=>setShowPresets(false)}>×</button></div>
      <div className="salon-v141-preset-scroll" aria-label="Presets del salón">
        <div className="salon-v12-preset-strip salon-v141-preset-strip">
          {SALON_PRESETS.map(preset=>{
            const active=activeEnv.preset_id===preset.id
            const preview=previewPreset?.id===preset.id
            return <article key={preset.id} className={`${active?'active':''} ${preview?'preview':''}`.trim()}>
              <button
                type="button"
                className="salon-v141-preset-card"
                onClick={()=>setPreviewPreset(preset)}
                onDoubleClick={e=>{e.preventDefault();e.stopPropagation();setPreviewPreset(preset);setPreviewModalPreset(preset)}}
                onTouchStart={e=>onPresetTouchStart(e,preset)}
                onTouchMove={onPresetTouchMove}
                onTouchEnd={e=>onPresetTouchEnd(e,preset)}
                aria-label={`${preset.label}. Un clic para previsualizar; doble clic para ver grande y usar.`}
              >
                <span className="salon-v12-preset-image"><img src={preset.image} alt={`Preset ${preset.label}`} />{active&&<em>ACTIVO</em>}{preview&&!active&&<em className="preview">VISTA</em>}</span>
                <span className="salon-v141-preset-copy"><strong>{preset.emoji} {preset.label}</strong><small>{preset.vibe} · {preset.idealPax} invitados</small><span>{preset.space}</span></span>
              </button>
            </article>
          })}
        </div>
      </div>
      {previewPreset&&<div className="salon-v141-preview-note"><span>Previsualizando <strong>{previewPreset.label}</strong>. Doble clic sobre la tarjeta para verla grande antes de usar.</span><button className="secondary-btn" onClick={()=>setPreviewModalPreset(previewPreset)}>Ver grande / usar</button></div>}
    </div>}

    {showElements&&<div className="salon-v12-elements-picker">
      <div className="salon-v12-presets-head"><div><strong>Agregar elementos</strong><span>Los mismos tipos operativos del diseñador original.</span></div><button onClick={()=>setShowElements(false)}>×</button></div>
      <div className="salon-v12-category-tabs">{elementCategories.map(group=><button key={group.category} className={elementCategory===group.category?'active':''} onClick={()=>setElementCategory(group.category)}>{group.category}</button>)}</div>
      <div className="salon-v12-element-grid">{ELEMENT_CATALOG.filter(item=>item.category===elementCategory).map(item=><button key={item.id} onClick={()=>addElement(item)}><b>{item.emoji}</b><span>{item.label}</span><small>{item.w}×{item.h} m</small></button>)}</div>
    </div>}

    <div className="salon-v12-configbar">
      <label>Nombre del ambiente<input value={activeEnv.name} onChange={e=>setEnvironments(prev=>prev.map(x=>x.id===activeEnv.id?{...x,name:e.target.value}:x))} onBlur={e=>patchEnvironment({name:e.target.value.trim()||'Ambiente'})}/></label>
      <label>Ancho<input type="number" min="5" max="100" step="0.5" value={activeEnv.width_m} onChange={e=>setEnvironments(prev=>prev.map(x=>x.id===activeEnv.id?{...x,width_m:e.target.value}:x))} onBlur={e=>patchEnvironment({width_m:clamp(e.target.value,5,100)})}/><span>m</span></label>
      <label>Largo<input type="number" min="5" max="100" step="0.5" value={activeEnv.height_m} onChange={e=>setEnvironments(prev=>prev.map(x=>x.id===activeEnv.id?{...x,height_m:e.target.value}:x))} onBlur={e=>patchEnvironment({height_m:clamp(e.target.value,5,100)})}/><span>m</span></label>
      <label>Forma<select value={activeEnv.shape||'rectangle'} onChange={e=>patchEnvironment({shape:e.target.value})}>{SALON_SHAPES.map(shape=><option key={shape.id} value={shape.id}>{shape.label}</option>)}</select></label>
      {activeEnv.shape==='L'&&<label>Orientación<select value={envShapeConfig?.L?.orientation||'cutTopRight'} onChange={e=>patchEnvironment({shape_config:{...envShapeConfig,L:{...(envShapeConfig.L||{}),orientation:e.target.value}}})}>{L_SHAPE_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
      {activeEnv.shape==='U'&&<label>Orientación<select value={envShapeConfig?.U?.orientation||'openTop'} onChange={e=>patchEnvironment({shape_config:{...envShapeConfig,U:{...(envShapeConfig.U||{}),orientation:e.target.value}}})}>{U_SHAPE_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
      <div className="salon-v12-room-size"><select value={guestCountChoice} onChange={e=>setGuestCountChoice(Number(e.target.value))}>{GUEST_COUNT_OPTIONS.map(n=><option key={n} value={n}>{n} invitados</option>)}</select><select value={roomSizeChoice} onChange={e=>setRoomSizeChoice(e.target.value)}>{Object.entries(ROOM_SIZE_OPTION_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
      <button className="salon-v12-delete-env" onClick={deleteEnvironment} disabled={environments.length<=1||busy}>Eliminar ambiente…</button>
    </div>

    <div className={`salon-v122-room-health ${roomAnalysis.roomStatus} ${roomAnalysis.enoughSeats?'enough':'short'}`}>
      <div><p>CAPACIDAD DEL AMBIENTE</p><strong>{envWidth} × {envHeight} m · {roomAnalysis.area} m²</strong><span>{capacityTarget} invitados activos · {roomAnalysis.seats} lugares en {activeTables.length} mesas</span></div>
      <div className="salon-v122-health-copy">{roomAnalysis.warnings.length?<><b>⚠ Revisar antes de cerrar el plano</b><span>{roomAnalysis.warnings.join(' ')}</span></>:<><b>✓ Distribución coherente</b><span>La superficie y los lugares sentados alcanzan como referencia operativa para la cantidad actual de invitados.</span></>}</div>
      <div className="salon-v122-health-actions"><button className="secondary-btn" onClick={()=>applyRoomSize('recommended')}>Usar medida recomendada</button>{activeTables.length>0&&<><button className="secondary-btn" onClick={emptyAllTables}>Vaciar todas</button><button className="text-danger-btn" onClick={deleteAllTables}>Eliminar mesas</button></>}</div>
    </div>

    {activePreset&&presetPlan&&<div className={`salon-v123-preset-plan ${presetCapacityShort?'incomplete':'complete'}`}>
      <div>
        <p>PRESET ACTIVO · {activePreset.label}</p>
        <strong>Boceto original: {activePreset.tables.length} mesas · {presetPlan.capacidadSentada} lugares · Plano actual: {activeTables.length} mesas · {roomAnalysis.seats} lugares</strong>
        <span>{roomAnalysis.seats<capacityTarget
          ? `El plano actual todavía queda corto para ${capacityTarget} invitados activos. Igual que en Tu Boda Organizada, el preset no inventa mesas fuera del boceto: agregalas manualmente, aumentá capacidad por mesa o elegí otro preset.`
          : `✓ El plano actual ya alcanza para ${capacityTarget} invitados activos. El boceto original sigue siendo la referencia visual y todo permanece editable.`}</span>
      </div>
      <div className="salon-v124-plan-actions">
        {roomAnalysis.seats<capacityTarget&&<button className="secondary-btn" disabled={busy||parentBusy} onClick={()=>createTable({environmentId:activeEnv.id})}>＋ Agregar mesa</button>}
        {waiting.length>0&&seatByProtocol&&<button className="primary-btn" disabled={busy||parentBusy} onClick={()=>seatByProtocol(protocolReferences)}>👨‍👩‍👧 Sentar por protocolo</button>}
        {undoSnapshot&&undoProtocol&&<button className="secondary-btn" disabled={busy||parentBusy} onClick={undoProtocol}>↩ Deshacer</button>}
      </div>
    </div>}

    {activeTables.length>0&&activePeople===0&&waiting.length>0&&<div className="salon-v124-next-step">
      <div><b>Plano listo · las mesas todavía están vacías</b><span>Podés distribuir las invitaciones por protocolo usando la ubicación real de mesa de novios, pista y entrada, o moverlas manualmente desde el Banco de espera.</span></div>
      {seatByProtocol&&<button className="primary-btn" disabled={busy||parentBusy} onClick={()=>seatByProtocol(protocolReferences)}>Sentar {displayPax(waiting)} personas ahora</button>}
    </div>}

    <div className="salon-v12-main">
      <aside className="salon-v12-bank" onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('guest-over')}} onDragLeave={e=>e.currentTarget.classList.remove('guest-over')} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('guest-over');const id=dragGuestId||e.dataTransfer?.getData('text/plain');if(id)moveToWaiting(id);setDragGuestId('')}}>
        <div className="salon-v12-bank-head"><div><p>BANCO DE ESPERA</p><strong>{waiting.length} invitaciones</strong></div><b>{displayPax(waiting)} personas</b></div>
        <input value={guestSearch} onChange={e=>setGuestSearch(e.target.value)} placeholder="Buscar invitación…"/>
        <div className="salon-v12-bank-list">{visibleWaiting.map(guest=><button key={guest.id} draggable className={selectedGuestId===guest.id?'selected':''} onClick={()=>setSelectedGuestId(selectedGuestId===guest.id?'':guest.id)} onDragStart={e=>{setDragGuestId(guest.id);e.dataTransfer?.setData('text/plain',guest.id)}}><span><strong>{guest.full_name}</strong><small>{STATUS_LABELS[guest.invitation_status]||'Pendiente'} · {guest.side_label||'Ambos'} · {guest.relationship||'Otro'}</small></span><b>×{partySize(guest)}</b></button>)}</div>
        {!visibleWaiting.length&&<div className="salon-v12-empty-bank">{guestSearch?'Sin resultados.':'✓ Todos los invitados activos tienen mesa.'}</div>}
        {selectedGuestId&&<div className="salon-v12-bank-tip">Ahora tocá una mesa del plano. El grupo completo se moverá junto.</div>}
      </aside>

      <main className="salon-v12-canvas-column">
        <div className="salon-v12-canvas-tools"><div><strong>{envWidth} × {envHeight} m</strong><span>{activeTables.length} mesas · {activePeople} personas en este ambiente</span></div><div><button onClick={()=>setZoom(z=>Math.max(.7,+(z-.1).toFixed(1)))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(1)))}>+</button><button onClick={()=>setZoom(1)}>Ajustar</button></div></div>
        <div className="salon-v12-scroll">
          <div className="salon-v12-floor-wrap" style={{width:`${zoom*100}%`,minWidth:zoom>1?'900px':'0'}}>
            <div className="salon-v12-floor" ref={floorRef} style={{aspectRatio:`${Math.max(5,envWidth)} / ${Math.max(5,envHeight)}`,clipPath:floorClip}} onClick={()=>{setSelectedElementId('');setSelectedTableId('');setActiveSeatCard(null)}}>
              <div className="salon-v12-grid"/>
              {activeElements.map(element=>{
                const item=ELEMENT_BY_ID.get(element.type)||{emoji:'✦',label:element.type}
                const selected=selectedElementId===element.id
                const w=clamp((Number(element.width_m||1)/envWidth)*100,2,80),h=clamp((Number(element.height_m||1)/envHeight)*100,2,80)
                return <div key={element.id} role="button" tabIndex={0} aria-label={`${element.label}. Arrastrá para mover.`} className={`salon-v12-element salon-v146-editable ${selected?'selected':''} ${element.is_non_physical?'nonphysical':''}`} style={{left:`${element.pos_x}%`,top:`${element.pos_y}%`,width:`${w}%`,height:`${h}%`,transform:`translate(-50%,-50%) rotate(${Number(element.rotation||0)}deg)`}} onClick={e=>{e.stopPropagation();setSelectedElementId(element.id);setSelectedTableId('');setActiveSeatCard(null)}} onPointerDown={e=>startDrag(e,'element-move',element)} title={`${element.label} · ${Number(element.width_m).toFixed(1)}×${Number(element.height_m).toFixed(1)} m`}><b>{item.emoji}</b><span>{element.label}</span>{selected&&<><span className="salon-v146-selected-tag">Seleccionado</span><button type="button" className="salon-v146-handle salon-v146-rotate-handle" title="Arrastrá para rotar" aria-label={`Rotar ${element.label}`} onPointerDown={e=>startDrag(e,'element-rotate',element)}>↻</button><button type="button" className="salon-v146-handle salon-v146-resize-handle" title="Arrastrá para cambiar tamaño" aria-label={`Cambiar tamaño de ${element.label}`} onPointerDown={e=>startDrag(e,'element-resize',element)}>↘</button></>}</div>
              })}
              {activeTables.map((table,index)=>{
                const pos=positionOf(table,index,activeTables.length),type=tableType(table),cfg=TABLE_VISUAL_TYPES[type]||TABLE_VISUAL_TYPES.round
                const storedW=Number(table.width_m)||cfg.width,storedH=Number(table.height_m)||cfg.height
                const physicalDiameter=(type==='round'||type==='square')?Math.max(.8,(storedW+storedH)/2):null
                const widthM=physicalDiameter||storedW,heightM=physicalDiameter||storedH
                const w=clamp((widthM/envWidth)*100,3,38),h=clamp((heightM/envHeight)*100,3,38),used=occupancy.get(table.id)||0,cap=Math.max(1,Number(table.capacity||defaultCapacity))
                const tableGuests=seatsByTable.get(table.id)||[]
                const people=expandedPeople(tableGuests)
                const seatTotal=Math.max(cap,people.length)
                const positions=seatPositions(type,seatTotal,widthM,heightM)
                const selected=selectedTableId===table.id
                return <div key={table.id} data-salon-table={table.id} className={`salon-v121-table-node type-${type} ${selected?'selected':''} ${used>cap?'over':''}`} style={{left:`${pos.x}%`,top:`${pos.y}%`,width:`${w}%`,height:(type==='round'||type==='square')?'auto':`${h}%`,aspectRatio:(type==='round'||type==='square')?'1 / 1':'auto',transform:`translate(-50%,-50%) rotate(${Number(table.rotation||0)}deg)`}} onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('guest-over')}} onDragLeave={e=>e.currentTarget.classList.remove('guest-over')} onDrop={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('guest-over');const id=dragGuestId||e.dataTransfer?.getData('text/plain');if(id){setActiveSeatCard(null);assignGuest(id,table.id)}setDragGuestId('')}}>
                  {positions.map((seat,i)=>{
                    const person=people[i]
                    const statusClass=person?SEAT_STATUS_CLASS[person.status]||'pending':'empty'
                    const seatCardOpen=Boolean(person&&activeSeatCard?.tableId===table.id&&activeSeatCard?.seatIndex===i&&activeSeatCard?.guestId===person.guestId)
                    return <button key={`${table.id}-seat-${i}`} type="button" draggable={Boolean(person)} className={`salon-v121-seat ${statusClass} ${person&&selectedGuestId===person.guestId?'selected':''} ${seatCardOpen?'card-open':''}`} style={{left:`${seat.left}%`,top:`${seat.top}%`,'--chair-rotation':`${Number(seat.rotation||0)}deg`}} aria-label={person?`${person.name} · ${table.name}`:`Lugar libre · ${table.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{
                      e.stopPropagation();if(!person)return
                      const seatRect=e.currentTarget.getBoundingClientRect(),floorRect=floorRef.current?.getBoundingClientRect()
                      if(!floorRect?.width||!floorRect?.height)return
                      const xPct=clamp(((seatRect.left+seatRect.width/2-floorRect.left)/floorRect.width)*100,12,88)
                      const rawYPct=((seatRect.top+seatRect.height/2-floorRect.top)/floorRect.height)*100
                      const placement=rawYPct<24?'below':'above'
                      const yPct=clamp(rawYPct,10,90)
                      setSelectedTableId(table.id);setSelectedElementId('')
                      setActiveSeatCard(current=>current&&current.tableId===table.id&&current.seatIndex===i&&current.guestId===person.guestId?null:{tableId:table.id,seatIndex:i,guestId:person.guestId,xPct,yPct,placement})
                    }} onDragStart={person?e=>{e.stopPropagation();setActiveSeatCard(null);setDragGuestId(person.guestId);e.dataTransfer?.setData('text/plain',person.guestId);e.dataTransfer.effectAllowed='move'}:undefined} onDragEnd={()=>setDragGuestId('')}>
                      <i aria-hidden="true"/><b>{person?String(person.name||'?').charAt(0).toUpperCase():''}</b>
                    </button>
                  })}
                  <button type="button" className={`salon-v12-table type-${type} ${selected?'selected':''} ${used>cap?'over':''}`} onClick={e=>{e.stopPropagation();if(suppressTableClickRef.current){suppressTableClickRef.current=false;return}if(selectedGuestId){setActiveSeatCard(null);assignGuest(selectedGuestId,table.id)}else{setSelectedTableId(table.id);setSelectedElementId('');setActiveSeatCard(null)}}} onPointerDown={e=>startDrag(e,'table-move',table)}>
                    {selected&&<span className="salon-v147-table-kicker">MESA</span>}<strong>{tableNumber(table)||table.name}</strong><small>{used}/{cap}</small>{table.room_label&&<span>{table.room_label}</span>}
                  </button>
                  {selected&&<><span className="salon-v146-selected-tag salon-v146-table-tag">{table.name} · seleccionada</span>{type!=='round'&&<button type="button" className="salon-v146-handle salon-v146-rotate-handle" title="Arrastrá para rotar" aria-label={`Rotar ${table.name}`} onPointerDown={e=>startDrag(e,'table-rotate',table)}>↻</button>}<button type="button" className="salon-v146-handle salon-v146-resize-handle" title="Arrastrá para cambiar tamaño" aria-label={`Cambiar tamaño de ${table.name}`} onPointerDown={e=>startDrag(e,'table-resize',table)}>↘</button></>}
                </div>
              })}
              {activeSeatCard&&(()=>{
                const guestRecord=guestById.get(activeSeatCard.guestId)
                const cardTable=tables.find(t=>t.id===activeSeatCard.tableId)
                if(!guestRecord||!cardTable)return null
                return <div className={`salon-v1411-seat-popover ${activeSeatCard.placement==='below'?'below':'above'}`} style={{left:`${activeSeatCard.xPct}%`,top:`${activeSeatCard.yPct}%`}} role="dialog" aria-label={`Detalle de ${guestRecord.full_name}`} onClick={e=>e.stopPropagation()}>
                  <button type="button" className="salon-v1411-seat-popover-close" aria-label="Cerrar" onClick={()=>setActiveSeatCard(null)}>×</button>
                  <span className="salon-v1411-seat-popover-kicker">{cardTable.name} · silla {Number(activeSeatCard.seatIndex||0)+1}</span>
                  <strong>{guestRecord.full_name}</strong>
                  <small>{STATUS_LABELS[guestRecord.invitation_status]||'Pendiente'} · {guestRecord.side_label||'Ambos'}{guestRecord.relationship?` · ${guestRecord.relationship}`:''}</small>
                  {partySize(guestRecord)>1&&<em>Invitación de {partySize(guestRecord)} personas</em>}
                  <div className="salon-v1411-seat-popover-actions">
                    <button type="button" onClick={()=>{setSelectedGuestId(guestRecord.id);setActiveSeatCard(null);setNotice(`Elegí otra mesa para mover a ${guestRecord.full_name}.`)}}>Mover a otra mesa</button>
                    <button type="button" className="ghost" onClick={()=>{moveToWaiting(guestRecord.id);setActiveSeatCard(null)}}>Banco de espera</button>
                  </div>
                </div>
              })()}
              {!activeTables.length&&!activeElements.length&&<div className="salon-v12-canvas-empty"><strong>Este ambiente está vacío</strong><p>Elegí un preset profesional o empezá desde cero agregando mesas y elementos.</p><div><button className="primary-btn" onClick={e=>{e.stopPropagation();setShowPresets(true)}}>Ver presets</button><button className="secondary-btn" onClick={e=>{e.stopPropagation();createTable({environmentId:activeEnv.id})}}>+ Mesa</button></div></div>}
            </div>
          </div>
        </div>
        <div className="salon-v12-canvas-foot"><span>Seleccioná una mesa u objeto · arrastrá para mover · ↻ rotar · ↘ cambiar tamaño</span><span>Los cambios se guardan al soltar. Los invitados se siguen moviendo desde sus sillas o desde el Banco de espera.</span></div>
      </main>

      <aside className="salon-v12-inspector">
        {selectedTable?<TableInspector table={selectedTable} activeEnv={activeEnv} environments={environments} guests={selectedTableGuests} tables={tables} occupancy={occupancy} defaultCapacity={defaultCapacity} updateTable={updateTable} changeTableType={changeTableType} setTableCapacity={setTableCapacity} setTableMeasures={setTableMeasures} moveTableEnvironment={moveTableEnvironment} assignGuest={assignGuest} moveToWaiting={moveToWaiting} emptyTable={emptyTable} deleteTable={deleteTable} setDragGuestId={setDragGuestId} setSelectedTableId={setSelectedTableId}/>
        :selectedElement?<ElementInspector element={selectedElement} patchElement={patchElement} deleteElement={deleteElement}/>
        :<div className="salon-v12-inspector-empty"><div>✦</div><strong>Seleccioná algo del plano</strong><p>Una mesa te muestra capacidad e invitados. Un elemento te deja editar medida, nombre y rotación.</p></div>}
      </aside>
    </div>

    {presetAction&&<div className="salon-v12-modal salon-v122-preset-action" onMouseDown={()=>!busy&&setPresetAction(null)}><div onMouseDown={e=>e.stopPropagation()}><div className="salon-v12-modal-copy"><p className="eyebrow">GENERAR PRESET</p><h3>{presetAction.preset.emoji} {presetAction.preset.label}</h3><p>Este flujo porta la lógica real de <b>aplicarPreset()</b> de Tu Boda Organizada: reemplaza el plano por el preset profesional editable, mantiene las mesas numeradas 1…N y conserva las asignaciones de invitados cuando esa misma mesa sigue existiendo.</p><div className={`salon-v122-preset-warning ${presetAction.current.roomStatus}`}><b>Referencia del preset</b><span>{guestCountChoice} invitados · {ROOM_SIZE_OPTION_LABELS[roomSizeChoice]} · plano original {presetAction.recommended.W} × {presetAction.recommended.H} m · {presetAction.preset.tables.length} mesas.</span></div><div className="salon-v122-preset-choices"><button className="primary-btn" disabled={busy} onClick={()=>applyPreset(presetAction.preset)}><strong>Generar plano</strong><span>Reemplaza el plano actual. Mesa 1 sigue siendo Mesa 1, Mesa 2 sigue siendo Mesa 2, etc.; solo los invitados de mesas que desaparecen vuelven al Banco de espera.</span></button></div><button className="salon-v122-cancel" disabled={busy} onClick={()=>setPresetAction(null)}>Cancelar</button></div></div></div>}

    {previewModalPreset&&<div className="salon-v12-modal" onMouseDown={()=>setPreviewModalPreset(null)}><div onMouseDown={e=>e.stopPropagation()}><button className="salon-v12-modal-close" onClick={()=>setPreviewModalPreset(null)}>×</button><img src={previewModalPreset.image} alt={previewModalPreset.label}/><div className="salon-v12-modal-copy"><p className="eyebrow">PREVISUALIZACIÓN DE ESTILO</p><h3>{previewModalPreset.emoji} {previewModalPreset.label}</h3><p>{previewModalPreset.tip}</p><div><span><b>Ideal</b>{previewModalPreset.idealPax} invitados</span><span><b>Funciona en</b>{previewModalPreset.space}</span></div><div className="salon-v12-modal-actions"><button className="secondary-btn" onClick={()=>setPreviewModalPreset(null)}>Solo mirar</button><button className="primary-btn" disabled={busy} onClick={()=>{const preset=previewModalPreset;setPreviewModalPreset(null);requestPreset(preset)}}>Usar este preset</button></div></div></div></div>}
  </div>
}

function buildTableRecommendations(table,guests,capacity){
  const used=displayPax(guests)
  const free=Math.max(0,Number(capacity||0)-used)
  const tips=[]
  if(used>capacity) tips.push(`La mesa supera su capacidad por ${used-capacity} persona${used-capacity!==1?'s':''}. Ampliá la mesa o mové una invitación.`)
  else if(free>0) tips.push(`Todavía tiene ${free} lugar${free!==1?'es':''}: completala por afinidad o protocolo.`)
  else tips.push('La mesa está completa. Evitá sumar otra invitación sin aumentar su medida o capacidad.')
  const counts=new Map()
  guests.forEach(g=>{const rel=String(g.relationship||'Otro');counts.set(rel,(counts.get(rel)||0)+partySize(g))})
  const majority=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]
  if(majority?.[1]>0) tips.push(`Esta mesa tiene mayoría de ${String(majority[0]).toLowerCase()} (${majority[1]} persona${majority[1]!==1?'s':''}).`)
  if(!String(table.room_label||'').trim()) tips.push('Agregá una etiqueta como Familia, Amigos, Presidencial, Padrinos o Testigos para entender rápido el plano.')
  tips.push('Mantené alrededor de 1 m de separación con pista, barras, buffet y otras mesas para circulación.')
  return tips
}

function TableInspector({table,activeEnv,environments,guests,tables,occupancy,defaultCapacity,updateTable,changeTableType,setTableCapacity,setTableMeasures,moveTableEnvironment,assignGuest,moveToWaiting,emptyTable,deleteTable,setDragGuestId,setSelectedTableId}){
  const type=tableType(table),cfg=TABLE_VISUAL_TYPES[type]||TABLE_VISUAL_TYPES.round
  const used=occupancy.get(table.id)||0
  const capacity=Number(table.capacity||defaultCapacity)
  const width=Number(table.width_m)||cfg.width,height=Number(table.height_m)||cfg.height
  const suggestion=suggestedCapacity(type,width,height)
  const recommendations=buildTableRecommendations(table,guests,capacity)
  const quickLabels=['Familia','Amigos','Presidencial','Padrinos','Testigos']
  const capacityChoices=[...new Set([capacity,...(cfg.capacities||[])])].filter(cap=>cap===capacity||cap>=used).sort((a,b)=>a-b)
  const presetCapacityIsCustom=Boolean(capacity&&!cfg.capacities?.includes(capacity))
  return <>
    <div className="salon-v147-inspector-selected">
      <div className="salon-v12-inspector-head salon-v147-inspector-head"><div><p>MESA SELECCIONADA</p><h3>{table.room_label||table.name}</h3></div><button type="button" className="salon-v147-inspector-close" onClick={()=>setSelectedTableId?.('')} aria-label="Cerrar mesa seleccionada">×</button></div>

      <div className="salon-v147-capacity-card">
        <div className="salon-v147-capacity-top"><span>PERSONAS</span><strong className={used>capacity?'over':''}>{used}<small> / {capacity}</small></strong></div>
        <div className="salon-v147-capacity-buttons">{capacityChoices.map(cap=><button type="button" key={cap} className={capacity===cap?'active':''} disabled={cap<used} onClick={()=>setTableCapacity(table,cap)}>{cap}{capacity===cap&&presetCapacityIsCustom?<small>preset</small>:null}</button>)}</div>
        {presetCapacityIsCustom&&<div className="salon-v1411-capacity-note">El preset nació con {capacity} lugares. Esta mesa admite ampliarse a {cfg.capacities.filter(n=>n>capacity).join(', ')||'una medida mayor'} según su tipo.</div>}
        <div className="salon-v147-measure-row">
          <span>{type==='round'?'Ø':'Medida'}</span>
          <input type="number" min="0.6" max="25" step="0.1" key={`mw-${table.id}-${width}`} defaultValue={width.toFixed(1)} onBlur={e=>setTableMeasures(table,e.target.value,height)} onPointerDown={e=>e.stopPropagation()}/>
          {type!=='round'&&type!=='square'&&<><b>×</b><input type="number" min="0.6" max="25" step="0.1" key={`mh-${table.id}-${height}`} defaultValue={height.toFixed(1)} onBlur={e=>setTableMeasures(table,width,e.target.value)} onPointerDown={e=>e.stopPropagation()}/></>}
          <em>m</em>
        </div>
        <div className="salon-v147-chair-hint">Sillas recomendadas: {suggestion}</div>
      </div>

      <div className="salon-v147-recommendations"><p>💡 RECOMENDACIONES</p><ul>{recommendations.map((tip,i)=><li key={i}>{tip}</li>)}</ul></div>

      <label className="salon-v147-name-field">Nombre de la mesa<input defaultValue={table.room_label||''} onBlur={e=>updateTable(table,{room_label:e.target.value.trim()||null})} placeholder="Nombre de la mesa (se ve en el plano)"/></label>
      <div className="salon-v147-label-chips">{quickLabels.map(label=><button type="button" key={label} className={table.room_label===label?'active':''} onClick={()=>updateTable(table,{room_label:label})}>{label}</button>)}</div>

      <div className="salon-v12-field-title salon-v147-section-title">TIPO</div>
      <div className="salon-v147-type-grid">{Object.entries(TABLE_VISUAL_TYPES).map(([id,item])=><button type="button" key={id} className={type===id?'active':''} onClick={()=>changeTableType(table,id)}><b>{item.icon||'○'}</b><span>{item.shortLabel||item.label}</span></button>)}</div>

      {type!=='round'&&<div className="salon-v147-rotation-block"><div className="salon-v12-field-title salon-v147-section-title">ROTACIÓN</div><div className="salon-v147-rotation-row"><button type="button" onClick={()=>updateTable(table,{rotation:((Number(table.rotation||0)-45)%360+360)%360})}>↺ −45°</button><span>{Number(table.rotation||0)}°</span><button type="button" onClick={()=>updateTable(table,{rotation:(Number(table.rotation||0)+45)%360})}>↻ +45°</button><button type="button" onClick={()=>updateTable(table,{rotation:0})}>0°</button></div><small>O arrastrá el ↻ en la esquina de la mesa.</small></div>}

      <label>Ambiente<select value={table.environment_id||activeEnv.id} onChange={e=>moveTableEnvironment(table,e.target.value)}>{environments.map(env=><option key={env.id} value={env.id}>{env.name}</option>)}</select></label>
    </div>

    <div className="salon-v12-field-title salon-v147-assigned-title">ASIGNADOS · {used}/{capacity}</div>
    <div className="salon-v12-table-guests">{guests.map(guest=><div key={guest.id} draggable onDragStart={e=>{setDragGuestId(guest.id);e.dataTransfer?.setData('text/plain',guest.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragGuestId('')}><span><strong>{guest.full_name}</strong><small>×{partySize(guest)} · {guest.relationship||'Otro'}</small></span><select value={table.id} onChange={e=>e.target.value==='waiting'?moveToWaiting(guest.id):assignGuest(guest.id,e.target.value)}><option value={table.id}>{table.name}</option>{tables.filter(t=>t.id!==table.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="waiting">Banco de espera</option></select></div>)}</div>
    {!guests.length&&<p className="salon-v12-soft-empty">Esta mesa está vacía. Arrastrá una invitación desde el Banco de espera.</p>}
    <div className="salon-v12-inspector-actions"><button className="secondary-btn" disabled={!guests.length} onClick={()=>emptyTable(table)}>Vaciar mesa</button><button className="text-danger-btn" onClick={()=>deleteTable(table)}>Eliminar mesa…</button></div>
  </>
}

function ElementInspector({element,patchElement,deleteElement}){
  const item=ELEMENT_BY_ID.get(element.type)||{emoji:'✦',label:element.type}
  return <>
    <div className="salon-v12-inspector-head"><div><p>ELEMENTO SELECCIONADO</p><h3>{item.emoji} {element.label}</h3></div></div>
    <label>Nombre<input defaultValue={element.label} onBlur={e=>patchElement(element,{label:e.target.value.trim()||item.label})}/></label>
    <div className="salon-v12-two"><label>Ancho (m)<input type="number" min="0.3" max="40" step="0.1" value={Number(element.width_m)||1} onChange={e=>patchElement(element,{width_m:clamp(e.target.value,.3,40)})}/></label><label>Largo (m)<input type="number" min="0.3" max="40" step="0.1" value={Number(element.height_m)||1} onChange={e=>patchElement(element,{height_m:clamp(e.target.value,.3,40)})}/></label></div>
    <label>Rotación<div className="salon-v12-rotation"><button onClick={()=>patchElement(element,{rotation:Number(element.rotation||0)-15})}>↺ 15°</button><span>{Number(element.rotation||0)}°</span><button onClick={()=>patchElement(element,{rotation:Number(element.rotation||0)+15})}>15° ↻</button></div></label>
    <label className="salon-v12-check"><input type="checkbox" checked={Boolean(element.is_non_physical)} onChange={e=>patchElement(element,{is_non_physical:e.target.checked})}/><span>Es referencia visual / no bloquea circulación</span></label>
    <div className="salon-v12-inspector-actions"><button className="text-danger-btn" onClick={()=>deleteElement(element)}>Eliminar del plano…</button></div>
  </>
}
