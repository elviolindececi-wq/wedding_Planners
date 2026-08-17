export const WEDDING_STAGE_ORDER = [
  "12 meses antes",
  "11 meses antes",
  "10 meses antes",
  "9 meses antes",
  "8 meses antes",
  "7 meses antes",
  "6 meses antes",
  "5 meses antes",
  "4 meses antes",
  "3 meses antes",
  "2 meses antes",
  "1 mes antes",
  "3 semanas antes",
  "2 semanas antes",
  "1 semana antes",
  "3 días antes",
  "Día anterior",
  "Día de la boda",
  "Día posterior"
]

export const TASK_CATEGORIES = [
  "Alianzas",
  "Bebidas",
  "Belleza",
  "Catering",
  "Ceremonia",
  "Decoración",
  "Documentación",
  "Día B",
  "Entretenimiento",
  "Estilo",
  "Finanzas",
  "Fotografía",
  "Invitados",
  "Lugar",
  "Luna de miel",
  "Música",
  "Padrinos",
  "Papelería",
  "Pastelería",
  "Planificación",
  "Regalos",
  "Transporte",
  "Vestuario",
  "Experiencia",
  "Personas y roles"
]

const weddingTemplate = [
  ["12 meses antes", "Finanzas", "Definir presupuesto total y aportes de cada familia", -365, "high"],
  ["12 meses antes", "Planificación", "Elegir fecha tentativa de la boda", -365, "high"],
  ["12 meses antes", "Ceremonia", "Definir tipo de ceremonia (civil, religiosa o ambas)", -362, "high"],
  ["12 meses antes", "Invitados", "Crear lista preliminar de invitados", -360, "high"],
  ["12 meses antes", "Lugar", "Investigar y visitar lugares de recepción", -355, "high"],
  ["12 meses antes", "Estilo", "Definir estilo de boda y paleta de colores", -350, "normal"],
  ["12 meses antes", "Planificación", "Crear carpeta compartida (Drive) para todo lo de la boda", -348, "low"],
  ["11 meses antes", "Finanzas", "Distribuir el presupuesto por categoría", -330, "high"],
  ["11 meses antes", "Invitados", "Definir lista A y lista B de invitados", -328, "normal"],
  ["11 meses antes", "Lugar", "Preseleccionar 3 salones para visitar", -325, "high"],
  ["11 meses antes", "Planificación", "Decidir si van a contratar wedding planner", -322, "normal"],
  ["11 meses antes", "Documentación", "Investigar requisitos y plazos del registro civil", -320, "high"],
  ["10 meses antes", "Lugar", "Reservar lugar de recepción", -300, "high"],
  ["10 meses antes", "Ceremonia", "Reservar ceremonia (civil y/o religiosa)", -300, "high"],
  ["10 meses antes", "Planificación", "Definir horario tentativo del evento", -298, "normal"],
  ["10 meses antes", "Catering", "Pedir cotizaciones de catering", -295, "high"],
  ["10 meses antes", "Fotografía", "Pedir cotizaciones de fotografía y video", -295, "high"],
  ["10 meses antes", "Planificación", "Contratar wedding planner (si aplica)", -290, "normal"],
  ["9 meses antes", "Fotografía", "Contratar fotografía y video", -270, "high"],
  ["9 meses antes", "Catering", "Contratar catering / banquete", -270, "high"],
  ["9 meses antes", "Música", "Cotizar música: DJ o banda", -265, "normal"],
  ["9 meses antes", "Decoración", "Cotizar decoración y flores", -262, "normal"],
  ["9 meses antes", "Vestuario", "Comenzar búsqueda de vestuario persona 1", -260, "normal"],
  ["9 meses antes", "Vestuario", "Comenzar búsqueda de vestuario persona 2", -258, "normal"],
  ["9 meses antes", "Padrinos", "Definir padrinos y roles", -255, "normal"],
  ["8 meses antes", "Música", "Contratar música y sonido", -240, "high"],
  ["8 meses antes", "Vestuario", "Elegir vestido / traje principal", -240, "high"],
  ["8 meses antes", "Documentación", "Reservar turno del registro civil", -238, "high"],
  ["8 meses antes", "Decoración", "Reservar decoración y flores", -235, "normal"],
  ["8 meses antes", "Fotografía", "Agendar sesión de fotos de compromiso", -232, "low"],
  ["8 meses antes", "Regalos", "Abrir mesa de regalos o lista de deseos", -230, "low"],
  ["8 meses antes", "Luna de miel", "Planificar destino de luna de miel", -225, "normal"],
  ["7 meses antes", "Decoración", "Contratar decoración y flores", -210, "high"],
  ["7 meses antes", "Pastelería", "Cotizar tortas y mesa dulce", -210, "normal"],
  ["7 meses antes", "Catering", "Agendar degustación de catering", -208, "normal"],
  ["7 meses antes", "Bebidas", "Definir proveedor de bebidas", -205, "normal"],
  ["7 meses antes", "Documentación", "Iniciar trámites de documentación civil", -205, "high"],
  ["7 meses antes", "Transporte", "Reservar transporte principal", -200, "normal"],
  ["6 meses antes", "Papelería", "Enviar save the date", -180, "normal"],
  ["6 meses antes", "Pastelería", "Contratar pastelería", -180, "normal"],
  ["6 meses antes", "Invitados", "Bloquear hoteles para invitados de otras ciudades", -178, "low"],
  ["6 meses antes", "Vestuario", "Primera prueba de vestuario", -175, "normal"],
  ["6 meses antes", "Planificación", "Definir plan B por lluvia", -172, "normal"],
  ["6 meses antes", "Belleza", "Reservar peinado y maquillaje", -170, "high"],
  ["6 meses antes", "Alianzas", "Comprar alianzas", -165, "normal"],
  ["5 meses antes", "Papelería", "Diseñar invitaciones", -150, "normal"],
  ["5 meses antes", "Catering", "Definir menú tentativo con el catering", -150, "high"],
  ["5 meses antes", "Vestuario", "Definir vestuario de padres y cortejo", -148, "normal"],
  ["5 meses antes", "Música", "Armar lista de canciones imprescindibles y prohibidas", -146, "low"],
  ["5 meses antes", "Entretenimiento", "Contratar entretenimiento extra (shows, cabina, etc.)", -145, "low"],
  ["5 meses antes", "Lugar", "Reservar hotel para la noche de bodas", -140, "normal"],
  ["4 meses antes", "Papelería", "Imprimir invitaciones", -120, "normal"],
  ["4 meses antes", "Luna de miel", "Confirmar luna de miel: vuelos y hotel", -120, "high"],
  ["4 meses antes", "Pastelería", "Prueba de torta", -118, "normal"],
  ["4 meses antes", "Bebidas", "Contratar barra / bartenders", -116, "normal"],
  ["4 meses antes", "Vestuario", "Segunda prueba de vestuario", -115, "normal"],
  ["4 meses antes", "Regalos", "Cotizar souvenirs", -112, "low"],
  ["4 meses antes", "Ceremonia", "Definir lecturas y música de la ceremonia", -110, "normal"],
  ["3 meses antes", "Papelería", "Enviar invitaciones", -90, "high"],
  ["3 meses antes", "Belleza", "Prueba de peinado y maquillaje", -90, "normal"],
  ["3 meses antes", "Vestuario", "Comprar zapatos y accesorios", -88, "normal"],
  ["3 meses antes", "Alianzas", "Mandar a grabar las alianzas", -86, "low"],
  ["3 meses antes", "Decoración", "Confirmar propuesta final de decoración", -85, "normal"],
  ["3 meses antes", "Música", "Coordinar la música de la ceremonia con los músicos", -82, "normal"],
  ["3 meses antes", "Finanzas", "Revisar pagos y saldos de proveedores", -80, "high"],
  ["2 meses antes", "Invitados", "Hacer seguimiento de confirmaciones", -60, "high"],
  ["2 meses antes", "Catering", "Prueba de menú final", -60, "high"],
  ["2 meses antes", "Decoración", "Confirmar con la florista las flores de estación", -58, "normal"],
  ["2 meses antes", "Belleza", "Prueba de corte / color de pelo", -56, "low"],
  ["2 meses antes", "Regalos", "Comprar recuerdos / souvenirs", -55, "low"],
  ["2 meses antes", "Entretenimiento", "Organizar despedidas de solteros", -52, "low"],
  ["2 meses antes", "Planificación", "Armar itinerario preliminar del día", -50, "high"],
  ["1 mes antes", "Invitados", "Cerrar lista de invitados confirmados", -30, "high"],
  ["1 mes antes", "Invitados", "Asignar mesas", -28, "high"],
  ["1 mes antes", "Finanzas", "Programar los pagos finales del mes", -27, "high"],
  ["1 mes antes", "Planificación", "Confirmar horarios con todos los proveedores", -26, "high"],
  ["1 mes antes", "Vestuario", "Prueba final de vestuario", -25, "high"],
  ["1 mes antes", "Música", "Armar la playlist final con el DJ", -24, "normal"],
  ["1 mes antes", "Belleza", "Reservar manicura y estética", -23, "low"],
  ["3 semanas antes", "Catering", "Entregar cantidad final de invitados al catering", -21, "high"],
  ["3 semanas antes", "Transporte", "Confirmar transporte de invitados", -20, "normal"],
  ["3 semanas antes", "Alianzas", "Retirar las alianzas", -19, "high"],
  ["3 semanas antes", "Papelería", "Enviar menús e imprimibles a imprenta", -18, "normal"],
  ["2 semanas antes", "Finanzas", "Preparar sobres de pagos finales", -14, "high"],
  ["2 semanas antes", "Planificación", "Entregar itinerario a padrinos y proveedores", -13, "high"],
  ["2 semanas antes", "Planificación", "Delegar responsables del día B (pagos, ramo, regalos)", -13, "high"],
  ["2 semanas antes", "Documentación", "Confirmar documentación civil completa", -12, "high"],
  ["2 semanas antes", "Planificación", "Confirmar timing final con cada proveedor", -11, "high"],
  ["1 semana antes", "Planificación", "Preparar kit de emergencia", -7, "normal"],
  ["1 semana antes", "Invitados", "Confirmar asistencias finales", -6, "high"],
  ["1 semana antes", "Luna de miel", "Armar valija de luna de miel", -6, "normal"],
  ["1 semana antes", "Vestuario", "Retirar vestuario final", -5, "high"],
  ["1 semana antes", "Decoración", "Armar kit de baño para invitados", -5, "low"],
  ["1 semana antes", "Belleza", "Priorizar descanso e hidratación", -4, "low"],
  ["3 días antes", "Ceremonia", "Ensayo de ceremonia", -3, "high"],
  ["3 días antes", "Decoración", "Confirmar horarios de montaje con decoración", -2, "normal"],
  ["3 días antes", "Planificación", "Revisar pronóstico y activar plan B si hace falta", -2, "normal"],
  ["Día anterior", "Planificación", "Entregar alianzas y elementos al responsable", -1, "high"],
  ["Día anterior", "Decoración", "Entregar decoración y souvenirs en el salón", -1, "high"],
  ["Día anterior", "Planificación", "Preparar maleta para la noche de bodas", -1, "normal"],
  ["Día anterior", "Planificación", "Cargar celulares y power bank", -1, "low"],
  ["Día de la boda", "Día B", "Desayunar bien y con calma", 0, "normal"],
  ["Día de la boda", "Finanzas", "Entregar los sobres de pago al responsable", 0, "high"],
  ["Día de la boda", "Día B", "Seguir el itinerario y disfrutar", 0, "high"],
  ["Día posterior", "Planificación", "Devolver alquileres y retirar regalos del salón", 1, "normal"],
  ["Día posterior", "Planificación", "Revisar objetos perdidos en el salón", 1, "normal"],
  ["Día posterior", "Invitados", "Enviar primeros agradecimientos", 1, "low"],
  ["Día posterior", "Documentación", "Iniciar cambio de documentos (si aplica)", 2, "low"],
]

// Por ahora quinceaños conserva una plantilla inicial propia.
// La ampliaremos con el mismo nivel de detalle sin mezclar tareas específicas de boda.
const quinceTemplate = [
  ["10 meses antes", "Planificación", "Definir alcance, prioridades y presupuesto inicial", -300, "high"],
  ["9 meses antes", "Experiencia", "Definir temática, estilo y experiencia del quinceaños", -270, "normal"],
  ["8 meses antes", "Lugar", "Buscar y reservar lugar del evento", -240, "high"],
  ["7 meses antes", "Vestuario", "Definir vestido, cambios de look y pruebas", -210, "normal"],
  ["6 meses antes", "Fotografía", "Cotizar y contratar fotografía / video", -180, "normal"],
  ["5 meses antes", "Entretenimiento", "Cotizar y contratar catering, DJ y entretenimiento", -150, "high"],
  ["4 meses antes", "Invitados", "Preparar lista preliminar de invitados", -135, "normal"],
  ["4 meses antes", "Papelería", "Definir y enviar invitaciones", -120, "normal"],
  ["3 meses antes", "Decoración", "Cerrar decoración, paleta y ambientación", -90, "normal"],
  ["2 meses antes", "Experiencia", "Definir vals, coreografía, tradiciones y momentos especiales", -75, "normal"],
  ["2 meses antes", "Personas y roles", "Confirmar corte, padrinos, familia y personas con roles", -60, "normal"],
  ["1 mes antes", "Catering", "Confirmar menú y necesidades alimentarias", -45, "normal"],
  ["1 mes antes", "Invitados", "Cerrar confirmaciones de invitados", -30, "high"],
  ["3 semanas antes", "Invitados", "Armar distribución de mesas", -21, "normal"],
  ["2 semanas antes", "Planificación", "Realizar ensayo / reunión técnica final", -10, "high"],
  ["1 semana antes", "Planificación", "Cerrar cronograma operativo del día", -7, "urgent"],
  ["3 días antes", "Finanzas", "Confirmar saldos, responsables y contactos de emergencia", -3, "urgent"],
]

export function getPlanningTemplate(event) {
  const source = event.event_type === "quince" ? quinceTemplate : weddingTemplate
  const templateKey = getPlanningTemplateKey(event)
  return source.map(([phase, category, title, offsetDays, priority], index) => ({
    id: crypto.randomUUID(),
    event_id: event.id,
    phase,
    category,
    title,
    due_date: addDays(event.event_date, offsetDays),
    due_date_source: "suggested",
    due_offset_days: offsetDays,
    status: "pending",
    priority,
    sort_order: index,
    template_key: templateKey,
  }))
}

export function getPlanningTemplateKey(event) {
  return event.event_type === "quince" ? "quince_base_v1" : "wedding_full_v2"
}

export function getPlanningTemplateCount(event) {
  return event.event_type === "quince" ? quinceTemplate.length : weddingTemplate.length
}

export function getPlanningStageOrder(event) {
  if (event.event_type !== "quince") return WEDDING_STAGE_ORDER
  return [...new Set(quinceTemplate.map(([phase]) => phase))]
}

export function addDays(dateString, days) {
  if (!dateString || days === null || days === undefined || days === '') return null
  const date = new Date(`${dateString}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + Number(days))
  return date.toISOString().slice(0, 10)
}

export function getSuggestedTaskDate(event, task) {
  if (!event?.event_date || task?.due_offset_days === null || task?.due_offset_days === undefined) return null
  return addDays(event.event_date, task.due_offset_days)
}
