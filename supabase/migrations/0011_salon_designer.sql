-- v1.2.0 · Diseñador de salón completo
-- Agrega ambientes, dimensiones reales, elementos visuales y metadatos de mesas.
-- Conserva todas las mesas, invitados y asignaciones existentes.

create table if not exists public.event_environments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null default 'Salón principal',
  width_m numeric(8,2) not null default 26 check (width_m between 5 and 100),
  height_m numeric(8,2) not null default 18 check (height_m between 5 and 100),
  shape text not null default 'rectangle' check (shape in ('rectangle','square','L','U','oval')),
  shape_config jsonb not null default '{}'::jsonb,
  preset_id text,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_environments_event_idx
  on public.event_environments(event_id,sort_order);

alter table public.event_tables
  add column if not exists environment_id uuid references public.event_environments(id) on delete set null,
  add column if not exists visual_type text not null default 'round',
  add column if not exists width_m numeric(8,2),
  add column if not exists height_m numeric(8,2);

create index if not exists event_tables_environment_idx
  on public.event_tables(environment_id);

create table if not exists public.salon_elements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  environment_id uuid not null references public.event_environments(id) on delete cascade,
  type text not null,
  label text not null,
  pos_x numeric(8,3) not null default 50,
  pos_y numeric(8,3) not null default 50,
  width_m numeric(8,2) not null default 1,
  height_m numeric(8,2) not null default 1,
  rotation numeric(8,2) not null default 0,
  is_non_physical boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists salon_elements_event_environment_idx
  on public.salon_elements(event_id,environment_id);

-- Todos los eventos existentes reciben un ambiente principal sin tocar sus datos.
insert into public.event_environments(id,event_id,name,width_m,height_m,shape,shape_config,sort_order)
select gen_random_uuid(),e.id,'Salón principal',26,18,'rectangle','{}'::jsonb,0
from public.events e
where not exists (
  select 1 from public.event_environments env where env.event_id=e.id
);

-- Las mesas existentes se vinculan al primer ambiente de su evento.
update public.event_tables t
set environment_id=(
  select env.id
  from public.event_environments env
  where env.event_id=t.event_id
  order by env.sort_order,env.created_at
  limit 1
)
where t.environment_id is null;

-- Completa medidas visuales iniciales sin alterar capacidad ni posición.
update public.event_tables
set visual_type=case
      when shape='round' then 'round'
      when shape='square' then 'square'
      else 'rect_h'
    end,
    width_m=coalesce(width_m,case when shape='round' then 1.8 when shape='square' then 1.8 else 4 end),
    height_m=coalesce(height_m,case when shape='round' then 1.8 when shape='square' then 1.8 else 2.2 end)
where width_m is null or height_m is null or visual_type is null;

alter table public.event_environments enable row level security;
alter table public.salon_elements enable row level security;

drop policy if exists "event_environments_event_access" on public.event_environments;
create policy "event_environments_event_access"
  on public.event_environments for all
  using (public.can_access_event(event_id))
  with check (public.can_access_event(event_id));

drop policy if exists "salon_elements_event_access" on public.salon_elements;
create policy "salon_elements_event_access"
  on public.salon_elements for all
  using (public.can_access_event(event_id))
  with check (public.can_access_event(event_id));

-- Evita que una mesa apunte a un ambiente de otro evento.
create or replace function public.validate_table_environment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.environment_id is not null and not exists (
    select 1 from public.event_environments env
    where env.id=new.environment_id and env.event_id=new.event_id
  ) then
    raise exception 'table_environment_event_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists event_tables_validate_environment on public.event_tables;
create trigger event_tables_validate_environment
before insert or update of environment_id,event_id on public.event_tables
for each row execute function public.validate_table_environment();

create or replace function public.validate_salon_element_environment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.event_environments env
    where env.id=new.environment_id and env.event_id=new.event_id
  ) then
    raise exception 'salon_element_environment_event_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists salon_elements_validate_environment on public.salon_elements;
create trigger salon_elements_validate_environment
before insert or update of environment_id,event_id on public.salon_elements
for each row execute function public.validate_salon_element_environment();
