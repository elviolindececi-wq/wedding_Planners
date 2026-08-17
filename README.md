# Planner Eventos App — base independiente

Proyecto nuevo y separado de **Tu Boda Organizada**. El nombre es de trabajo.

## Principios de seguridad

- No contiene secretos ni credenciales del producto actual.
- No reutiliza Hotmart, webhooks, IDs comerciales, UTMs ni analytics del producto actual.
- No se conecta a Supabase si no se define explícitamente el `project-ref` esperado del proyecto NUEVO.
- La entidad operativa es `event`, no `wedding`, para soportar **Boda** y **Quinceaños** con un mismo núcleo.
- **Experiencia** es un módulo dentro del evento, no un tipo de evento.

## Primer alcance estructural

- Dashboard de negocio + operación
- CRM
- Eventos (Boda / Quinceaños)
- Workspace por evento
- Proveedores generales
- Calendario interno + futura integración opcional con Google Calendar
- Recursos profesionales
- Equipo, plan y configuración preparados

## Ejecutar localmente

```bash
npm install
npm run dev
```

Sin `.env`, la interfaz funciona en modo maqueta local y **no intenta conectarse a Supabase**.

## Supabase nuevo

1. Crear un proyecto nuevo.
2. Copiar `.env.example` a `.env.local`.
3. Completar URL, anon key y `VITE_EXPECTED_SUPABASE_PROJECT_REF` del proyecto nuevo.
4. Aplicar migraciones solamente contra ese proyecto nuevo.

La guarda en `src/lib/supabase.js` bloquea conexiones cuyo project-ref no coincida con el esperado.
