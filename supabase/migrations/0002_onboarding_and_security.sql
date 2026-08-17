-- Planner Eventos App · onboarding y endurecimiento de seguridad
-- SOLO para el proyecto Supabase NUEVO de Wedding_planners.

-- 1) Crear/backfillear perfil público asociado a auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill por si ya existe algún usuario antes de instalar este trigger.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- El trigger no debe ser invocable desde la Data API.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- 2) RPC de onboarding: crea la organización, convierte al usuario en owner
-- y crea una suscripción trial del plan Solo, todo en una sola transacción.
create or replace function public.create_my_organization(
  p_name text,
  p_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_slug text := nullif(lower(btrim(p_slug)), '');
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if v_name is null then
    raise exception 'organization_name_required';
  end if;

  -- MVP: una organización propia por cuenta. Un usuario sí puede ser miembro
  -- de organizaciones ajenas mediante invitación en una etapa posterior.
  if exists (
    select 1
    from public.organization_members om
    where om.user_id = v_user_id
      and om.role = 'owner'
      and om.status = 'active'
  ) then
    raise exception 'organization_already_exists';
  end if;

  -- Asegura el perfil incluso si el usuario fue creado antes del trigger.
  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    v_org_id,
    v_user_id,
    'owner',
    'active'
  );

  insert into public.subscriptions (
    organization_id,
    plan_code,
    status,
    current_period_start
  )
  values (
    v_org_id,
    'solo',
    'trial',
    now()
  );

  return v_org_id;
end;
$$;

revoke execute on function public.create_my_organization(text, text) from public;
revoke execute on function public.create_my_organization(text, text) from anon;
grant execute on function public.create_my_organization(text, text) to authenticated;

-- 3) Las funciones SECURITY DEFINER usadas por RLS no necesitan quedar
-- expuestas a usuarios anónimos. Solo authenticated puede evaluarlas.
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.is_org_member(uuid) from anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke execute on function public.is_org_admin(uuid) from public;
revoke execute on function public.is_org_admin(uuid) from anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

revoke execute on function public.can_access_event(uuid) from public;
revoke execute on function public.can_access_event(uuid) from anon;
grant execute on function public.can_access_event(uuid) to authenticated;
