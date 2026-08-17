# Alcance acordado · v0.1

## Producto
Plataforma SaaS para wedding/event planners que administra dos dominios separados:

1. **El negocio de la planner**: CRM, clientas, pipeline, cobros, equipo y plan.
2. **La operación de eventos**: inicialmente **Boda** y **Quinceaños**.

## Regla de producto
**Experiencia es un módulo dentro de Boda y Quinceaños**, no un tipo de evento.

## Módulos globales
- Inicio / dashboard
- CRM
- Eventos
- Directorio general de proveedores
- Calendario
- Recursos profesionales
- Mi equipo
- Mi plan
- Configuración

## Workspace de cada evento
- Resumen
- Planificación / tareas
- Presupuesto
- Proveedores
- Cotizaciones
- Pagos a proveedores
- Invitados
- Mesas
- Diseño & inspiración
- Experiencia
- Personas y roles
- Día del evento
- Documentos
- Notas

## Fuera del producto nuevo
- Módulo musical de Tu Boda Organizada
- Hotmart actual
- webhook actual
- Supabase actual
- Vercel actual
- datos de producción
- checkout/UTMs/analytics actuales

## Google Calendar
La app tendrá calendario interno. La integración con Google Calendar será opcional y, para el MVP, preferentemente de la plataforma hacia Google Calendar para elementos seleccionados. No se guardarán tokens OAuth en tablas expuestas al cliente.

## Planes
La arquitectura soportará límites por:
- usuarios internos de la organización;
- eventos activos.

Las clientas/parejas no se consideran usuarios internos pagos.
