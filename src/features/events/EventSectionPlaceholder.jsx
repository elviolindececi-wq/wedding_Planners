import { useLocation } from 'react-router-dom'
const copy = {
  plan: ['Planificación', 'Tareas, vencimientos, responsables, prioridades y templates por tipo de evento.'],
  presupuesto: ['Presupuesto', 'Estimado, cotizado, contratado, simulador por invitados y aportes.'],
  proveedores: ['Proveedores del evento', 'Asignaciones desde el directorio general de la organización.'],
  cotizaciones: ['Cotizaciones', 'Comparar propuestas, condiciones, vigencia y seleccionar proveedor.'],
  pagos: ['Pagos del evento', 'Señas, saldos y vencimientos a proveedores. Separado de lo que cobra la planner.'],
  invitados: ['Invitados', 'Confirmaciones, restricciones y resumen automático para catering.'],
  mesas: ['Mesas', 'Distribución de invitados y, más adelante, diseñador visual del salón.'],
  diseno: ['Diseño & inspiración', 'Moodboard, paleta, Pinterest/links, referencias y decoración.'],
  experiencia: ['Experiencia', 'Diseñar cómo se vive cada momento: llegada, ceremonia, recepción, fiesta y cierre.'],
  personas: ['Personas y roles', 'Padrinos, testigos, familia, responsables y contactos clave.'],
  dia: ['Día del evento', 'Run of show operativo con horarios, responsables, proveedores y notas.'],
  documentos: ['Documentos', 'Contratos, propuestas, comprobantes, planos y archivos relacionados.'],
  notas: ['Notas', 'Notas internas del equipo organizadas por evento.'],
}
export default function EventSectionPlaceholder(){const key=useLocation().pathname.split('/').pop();const [title,desc]=copy[key]||['Módulo',''];return <article className="panel module-placeholder"><p className="eyebrow">MÓDULO</p><h2>{title}</h2><p>{desc}</p><div className="placeholder-box">Estructura preparada. La lógica real se migrará desde el producto actual únicamente cuando corresponda.</div></article>}
