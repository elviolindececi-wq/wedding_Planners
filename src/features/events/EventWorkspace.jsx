import { NavLink, Outlet, useParams } from 'react-router-dom'

const tabs = [
  ['', 'Resumen'], ['plan', 'Planificación'], ['presupuesto', 'Presupuesto'], ['proveedores', 'Proveedores'], ['cotizaciones', 'Cotizaciones'], ['pagos', 'Pagos'], ['invitados', 'Invitados'], ['mesas', 'Mesas'], ['diseno', 'Diseño & inspiración'], ['experiencia', 'Experiencia'], ['personas', 'Personas y roles'], ['dia', 'Día del evento'], ['documentos', 'Documentos'], ['notas', 'Notas'],
]

export default function EventWorkspace(){
  const { eventId } = useParams()
  const isQuince = eventId === 'valentina'
  const title = isQuince ? 'Valentina' : eventId === 'sofia-juan' ? 'Sofía & Juan' : 'Ana & Mateo'
  return <section><div className="event-hero"><div><span className="pill">{isQuince ? 'Quinceaños' : 'Boda'}</span><h1>{title}</h1><p>{isQuince ? '22 septiembre 2027' : '15 agosto 2027'} · Asunción</p></div><button className="secondary-btn">Editar evento</button></div><div className="workspace-tabs">{tabs.map(([path,label])=><NavLink end={path===''} key={label} to={path} className={({isActive})=>isActive?'active':''}>{label}</NavLink>)}</div><Outlet context={{ title, isQuince }} /></section>
}
