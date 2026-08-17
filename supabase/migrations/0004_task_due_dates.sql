-- v0.4.2 — Fechas sugeridas/editables para planificación

alter table public.tasks
  add column if not exists due_date_source text,
  add column if not exists due_offset_days integer;

-- Las tareas que venían de templates existentes se consideran sugeridas.
-- El offset se reconstruye a partir de la fecha actual de la tarea y del evento.
update public.tasks t
set
  due_date_source = 'suggested',
  due_offset_days = (t.due_date - e.event_date)
from public.events e
where t.event_id = e.id
  and t.template_key is not null
  and t.due_date is not null
  and e.event_date is not null
  and t.due_date_source is null;

-- Las tareas manuales preexistentes quedan como fechas personalizadas.
update public.tasks
set due_date_source = 'manual'
where due_date_source is null;

alter table public.tasks
  alter column due_date_source set default 'manual',
  alter column due_date_source set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_due_date_source_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_due_date_source_check
      check (due_date_source in ('suggested','manual','relative'));
  end if;
end $$;

-- Recalcula únicamente fechas automáticas; las personalizadas se conservan.
create or replace function public.recalculate_event_task_dates(
  p_event_id uuid,
  p_event_date date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.tasks
  set
    due_date = p_event_date + due_offset_days,
    updated_at = now()
  where event_id = p_event_id
    and due_date_source in ('suggested','relative')
    and due_offset_days is not null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.recalculate_event_task_dates(uuid, date) from public;
grant execute on function public.recalculate_event_task_dates(uuid, date) to authenticated;
