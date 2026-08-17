-- v0.4.1 · categoría de tareas para checklist profesional completo
alter table public.tasks
  add column if not exists category text;

create index if not exists tasks_event_phase_category_idx
  on public.tasks(event_id, phase, category);
