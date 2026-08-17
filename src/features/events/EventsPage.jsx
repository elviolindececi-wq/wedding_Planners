import { Link } from 'react-router-dom'
const rows = [
  ['ana-mateo', 'Ana & Mateo', 'Boda', '15/08/2027', 'En planificación', 'Cecilia'],
  ['valentina', 'Valentina', 'Quinceaños', '22/09/2027', 'En planificación', 'María'],
  ['sofia-juan', 'Sofía & Juan', 'Boda', '03/10/2027', 'Confirmaciones', 'Cecilia'],
]
export default function EventsPage(){return <section><div className="page-heading"><div><p className="eyebrow">OPERACIÓN</p><h1>Eventos</h1><p>Bodas y quinceaños comparten el mismo núcleo, con plantillas específicas.</p></div><button className="primary-btn">+ Nuevo evento</button></div><div className="table-card"><div className="table-row table-head"><span>Evento</span><span>Tipo</span><span>Fecha</span><span>Etapa</span><span>Planner</span></div>{rows.map(([id,name,type,date,status,planner])=><Link className="table-row" to={`/app/eventos/${id}`} key={id}><strong>{name}</strong><span>{type}</span><span>{date}</span><span>{status}</span><span>{planner}</span></Link>)}</div></section>}
