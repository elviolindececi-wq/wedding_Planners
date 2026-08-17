# Arquitectura v0.1

## Separación de dominios

### Organización / SaaS
- organizations
- organization_members
- plan_catalog
- subscriptions

### Negocio / CRM
- contacts
- crm_opportunities
- crm_activities
- client_invoices / client_payments (siguiente iteración)

### Operación de eventos
- events (`wedding` | `quince`)
- event_members
- tasks
- budget_categories / budget_items
- vendors / event_vendors / quotes / vendor_payments
- guests / event_tables / seating_assignments
- people_roles
- timeline_items
- inspiration_items
- experience_moments

## Regla financiera
Los pagos del evento a proveedores y los cobros de la planner a su clienta son dominios distintos.

## Regla de acceso
El acceso se concede por membresía a la organización y, cuando se necesite, por asignación específica al evento.

## Calendario
La app conserva su calendario interno como fuente de verdad. Google Calendar será una integración opcional de salida en el MVP; la sincronización bidireccional se deja para después.
