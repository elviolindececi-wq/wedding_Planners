-- Planner Eventos App · esquema inicial
-- SOLO para un proyecto Supabase NUEVO e independiente.

create extension if not exists pgcrypto;

-- ---------- SaaS / organización ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'planner' check (role in ('owner','admin','planner','assistant')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.plan_catalog (
  code text primary key,
  name text not null,
  max_internal_users integer,
  max_active_events integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_code text not null references public.plan_catalog(code),
  status text not null default 'trial' check (status in ('trial','active','past_due','paused','canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  external_provider text,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plan_catalog(code,name,max_internal_users,max_active_events,features)
values
  ('solo','Solo',1,5,'{"crm":true,"calendar":true}'::jsonb),
  ('studio','Studio',3,20,'{"crm":true,"calendar":true,"team":true}'::jsonb),
  ('agency','Agency',10,100,'{"crm":true,"calendar":true,"team":true,"advanced_permissions":true}'::jsonb)
on conflict (code) do nothing;

-- ---------- CRM / negocio ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'client' check (kind in ('lead','client','other')),
  display_name text not null,
  first_name text,
  last_name text,
  partner_name text,
  email text,
  phone text,
  instagram text,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_org_idx on public.contacts(organization_id);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  stage text not null default 'new' check (stage in ('new','meeting','proposal','negotiation','won','lost')),
  event_type text check (event_type in ('wedding','quince')),
  expected_event_date date,
  service_name text,
  potential_value numeric(14,2),
  currency text not null default 'USD',
  next_followup_at timestamptz,
  lost_reason text,
  won_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_opportunities_org_stage_idx on public.crm_opportunities(organization_id, stage);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  assigned_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null check (activity_type in ('note','call','meeting','email','followup','proposal')),
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Eventos ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id) on delete set null,
  source_opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  event_type text not null check (event_type in ('wedding','quince')),
  name text not null,
  partner_1 text,
  partner_2 text,
  honoree_name text,
  event_date date,
  event_time time,
  venue_name text,
  city text,
  estimated_guests integer,
  currency text not null default 'USD',
  status text not null default 'planning' check (status in ('lead','planning','confirmed','completed','canceled','archived')),
  style_summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_org_date_idx on public.events(organization_id, event_date);
create index if not exists events_org_status_idx on public.events(organization_id, status);

create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'planner' check (role in ('lead_planner','planner','assistant','viewer')),
  created_at timestamptz not null default now(),
  primary key(event_id,user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  phase text,
  due_date date,
  due_time time,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','done','canceled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  responsible_user_id uuid references auth.users(id) on delete set null,
  responsible_label text,
  sort_order integer not null default 0,
  template_key text,
  google_calendar_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_event_due_idx on public.tasks(event_id,due_date);

-- ---------- Proveedores / cotizaciones ----------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text,
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  instagram text,
  website text,
  address text,
  general_notes text,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_org_category_idx on public.vendors(organization_id,category);

create table if not exists public.event_vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  service_category text,
  status text not null default 'considering' check (status in ('considering','quoted','selected','contracted','completed','declined')),
  contracted_amount numeric(14,2),
  currency text not null default 'USD',
  contract_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,vendor_id,service_category)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  title text,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  includes text,
  extras text,
  payment_terms text,
  deposit_amount numeric(14,2),
  valid_until date,
  rating smallint check (rating between 1 and 5),
  is_selected boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Presupuesto y pagos DEL EVENTO ----------
create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique(event_id,name)
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid references public.budget_categories(id) on delete set null,
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  description text not null,
  estimated_amount numeric(14,2),
  quoted_amount numeric(14,2),
  contracted_amount numeric(14,2),
  currency text not null default 'USD',
  variable_per_guest boolean not null default false,
  unit_amount numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  description text,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  due_date date,
  paid_at timestamptz,
  status text not null default 'pending' check (status in ('pending','paid','overdue','canceled')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists vendor_payments_event_due_idx on public.vendor_payments(event_id,due_date);

create table if not exists public.budget_contributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  contributor_name text not null,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Invitados / mesas ----------
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  party_name text,
  phone text,
  email text,
  invitation_status text not null default 'pending' check (invitation_status in ('pending','confirmed','declined')),
  party_size integer not null default 1 check (party_size > 0),
  relationship text,
  side_label text,
  meal_preference text,
  dietary_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guests_event_status_idx on public.guests(event_id,invitation_status);

create table if not exists public.event_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  capacity integer not null default 10,
  shape text not null default 'round' check (shape in ('round','rectangular','square','other')),
  room_label text,
  pos_x numeric,
  pos_y numeric,
  rotation numeric,
  notes text,
  unique(event_id,name)
);

create table if not exists public.seating_assignments (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  table_id uuid not null references public.event_tables(id) on delete cascade,
  seat_number integer,
  primary key(event_id,guest_id)
);

-- ---------- Personas / roles ----------
create table if not exists public.people_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  role_name text not null,
  phone text,
  email text,
  responsibilities text,
  confirmed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Día del evento ----------
create table if not exists public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  start_at timestamptz,
  duration_minutes integer,
  location text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  responsible_label text,
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','confirmed','done','canceled')),
  notes text,
  sort_order integer not null default 0,
  google_calendar_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Diseño & Inspiración ----------
create table if not exists public.inspiration_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category text,
  title text,
  source_type text not null default 'link' check (source_type in ('link','pinterest','instagram','upload','other')),
  source_url text,
  storage_path text,
  color_hex text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- EXPERIENCIA (módulo dentro de boda/quinceaños) ----------
create table if not exists public.experience_moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  phase text,
  objective text,
  desired_feeling text,
  ambience text,
  music_notes text,
  food_drink_notes text,
  interaction_notes text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  responsible_label text,
  event_vendor_id uuid references public.event_vendors(id) on delete set null,
  timeline_item_id uuid references public.timeline_items(id) on delete set null,
  inspiration_item_id uuid references public.inspiration_items(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Google Calendar: solo referencias de sincronización ----------
-- Los tokens OAuth NO se guardan en tablas accesibles por el cliente.
create table if not exists public.calendar_sync_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  calendar_id text,
  source_type text not null check (source_type in ('event','task','timeline','crm_activity','vendor_payment')),
  source_id uuid not null,
  external_event_id text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,user_id,source_type,source_id)
);

-- ---------- Seguridad / RLS ----------
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  );
$$;

create or replace function public.can_access_event(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = target_event
      and public.is_org_member(e.organization_id)
      and (
        not exists (select 1 from public.event_members em where em.event_id = e.id)
        or exists (select 1 from public.event_members em where em.event_id = e.id and em.user_id = auth.uid())
        or public.is_org_admin(e.organization_id)
      )
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_activities enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.tasks enable row level security;
alter table public.vendors enable row level security;
alter table public.event_vendors enable row level security;
alter table public.quotes enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.budget_contributions enable row level security;
alter table public.guests enable row level security;
alter table public.event_tables enable row level security;
alter table public.seating_assignments enable row level security;
alter table public.people_roles enable row level security;
alter table public.timeline_items enable row level security;
alter table public.inspiration_items enable row level security;
alter table public.experience_moments enable row level security;
alter table public.calendar_sync_links enable row level security;

-- Perfil propio
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Organización / miembros
create policy "organizations_select_member" on public.organizations for select using (public.is_org_member(id));
create policy "organizations_update_admin" on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "organization_members_select_member" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "organization_members_manage_admin" on public.organization_members for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "subscriptions_select_member" on public.subscriptions for select using (public.is_org_member(organization_id));

-- Tablas con organization_id directo
create policy "contacts_org_access" on public.contacts for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "crm_opportunities_org_access" on public.crm_opportunities for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "crm_activities_org_access" on public.crm_activities for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "vendors_org_access" on public.vendors for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "calendar_sync_links_owner" on public.calendar_sync_links for all using (user_id = auth.uid() and public.is_org_member(organization_id)) with check (user_id = auth.uid() and public.is_org_member(organization_id));

-- Eventos
create policy "events_member_access" on public.events for select using (public.can_access_event(id));
create policy "events_insert_org_member" on public.events for insert with check (public.is_org_member(organization_id));
create policy "events_update_access" on public.events for update using (public.can_access_event(id)) with check (public.is_org_member(organization_id));
create policy "events_delete_admin" on public.events for delete using (public.is_org_admin(organization_id));
create policy "event_members_access" on public.event_members for select using (public.can_access_event(event_id));

-- Hijos del evento
create policy "tasks_event_access" on public.tasks for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event_vendors_event_access" on public.event_vendors for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "quotes_event_access" on public.quotes for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "budget_categories_event_access" on public.budget_categories for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "budget_items_event_access" on public.budget_items for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "vendor_payments_event_access" on public.vendor_payments for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "budget_contributions_event_access" on public.budget_contributions for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "guests_event_access" on public.guests for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "event_tables_event_access" on public.event_tables for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "seating_assignments_event_access" on public.seating_assignments for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "people_roles_event_access" on public.people_roles for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "timeline_items_event_access" on public.timeline_items for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "inspiration_items_event_access" on public.inspiration_items for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));
create policy "experience_moments_event_access" on public.experience_moments for all using (public.can_access_event(event_id)) with check (public.can_access_event(event_id));

-- Onboarding de organización y gestión de miembros se implementarán mediante RPC/server action
-- para no abrir políticas de INSERT demasiado amplias desde el cliente.
