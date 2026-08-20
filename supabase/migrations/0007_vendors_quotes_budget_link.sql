-- v0.7 · proveedores + cotizaciones vinculados al presupuesto del evento.
-- Conserva la moneda original del proveedor y un snapshot del tipo de cambio usado.

alter table public.event_vendors
  add column if not exists budget_category_id uuid references public.budget_categories(id) on delete set null,
  add column if not exists quoted_amount numeric(14,2),
  add column if not exists exchange_rate numeric(20,8),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_date date;

alter table public.quotes
  add column if not exists budget_category_id uuid references public.budget_categories(id) on delete set null,
  add column if not exists exchange_rate numeric(20,8),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_date date;

alter table public.budget_items
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

create index if not exists event_vendors_budget_category_idx
  on public.event_vendors(event_id, budget_category_id);

create index if not exists quotes_event_category_idx
  on public.quotes(event_id, budget_category_id);

create or replace function public.apply_quote_to_budget(
  p_quote_id uuid,
  p_contract boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  e public.events%rowtype;
  v public.vendors%rowtype;
  c public.budget_categories%rowtype;
  v_event_vendor_id uuid;
  v_budget_item_id uuid;
  v_rate numeric;
  v_equivalent numeric;
  v_zero_decimal boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select * into q from public.quotes where id = p_quote_id for update;
  if q.id is null then raise exception 'quote_not_found'; end if;
  if not public.can_access_event(q.event_id) then raise exception 'event_not_accessible'; end if;

  select * into e from public.events where id = q.event_id;
  select * into v from public.vendors where id = q.vendor_id;
  if v.id is null then raise exception 'vendor_not_found'; end if;

  if q.budget_category_id is null then raise exception 'budget_category_required'; end if;
  select * into c from public.budget_categories where id = q.budget_category_id and event_id = q.event_id;
  if c.id is null then raise exception 'invalid_budget_category'; end if;

  if upper(q.currency) = upper(e.currency) then
    v_rate := 1;
  else
    v_rate := q.exchange_rate;
    if v_rate is null or v_rate <= 0 then raise exception 'exchange_rate_required'; end if;
  end if;

  v_zero_decimal := upper(e.currency) in ('PYG','CLP','JPY','KRW');
  v_equivalent := case
    when v_zero_decimal then round(q.amount * v_rate, 0)
    else round(q.amount * v_rate, 2)
  end;

  v_event_vendor_id := q.event_vendor_id;
  if v_event_vendor_id is null then
    select ev.id into v_event_vendor_id
    from public.event_vendors ev
    where ev.event_id = q.event_id
      and ev.vendor_id = q.vendor_id
      and ev.service_category = c.name
    limit 1;
  end if;

  if v_event_vendor_id is null then
    v_event_vendor_id := gen_random_uuid();
    insert into public.event_vendors (
      id, event_id, vendor_id, service_category, budget_category_id,
      status, quoted_amount, contracted_amount, currency,
      exchange_rate, exchange_rate_source, exchange_rate_date, updated_at
    ) values (
      v_event_vendor_id, q.event_id, q.vendor_id, c.name, c.id,
      case when p_contract then 'contracted' else 'selected' end,
      q.amount, case when p_contract then q.amount else null end, q.currency,
      v_rate, q.exchange_rate_source, q.exchange_rate_date, now()
    );
  else
    update public.event_vendors
    set budget_category_id = c.id,
        service_category = c.name,
        status = case when p_contract then 'contracted' else 'selected' end,
        quoted_amount = q.amount,
        contracted_amount = case when p_contract then q.amount else contracted_amount end,
        currency = q.currency,
        exchange_rate = v_rate,
        exchange_rate_source = q.exchange_rate_source,
        exchange_rate_date = q.exchange_rate_date,
        updated_at = now()
    where id = v_event_vendor_id;
  end if;

  update public.quotes
  set is_selected = false
  where event_id = q.event_id
    and budget_category_id = q.budget_category_id
    and id <> q.id;

  update public.quotes
  set is_selected = true,
      event_vendor_id = v_event_vendor_id
  where id = q.id;

  select bi.id into v_budget_item_id
  from public.budget_items bi
  where bi.event_id = q.event_id
    and bi.event_vendor_id = v_event_vendor_id
  order by bi.created_at asc
  limit 1;

  if v_budget_item_id is null then
    v_budget_item_id := gen_random_uuid();
    insert into public.budget_items (
      id, event_id, category_id, event_vendor_id, quote_id, description,
      quoted_amount, contracted_amount, currency, notes, updated_at
    ) values (
      v_budget_item_id, q.event_id, c.id, v_event_vendor_id, q.id,
      coalesce(nullif(q.title,''), v.company_name),
      v_equivalent, case when p_contract then v_equivalent else null end,
      e.currency,
      'Importado desde cotización de ' || v.company_name,
      now()
    );
  else
    update public.budget_items
    set category_id = c.id,
        quote_id = q.id,
        description = coalesce(nullif(q.title,''), description),
        quoted_amount = v_equivalent,
        contracted_amount = case when p_contract then v_equivalent else contracted_amount end,
        currency = e.currency,
        updated_at = now()
    where id = v_budget_item_id;
  end if;

  return v_budget_item_id;
end;
$$;

revoke execute on function public.apply_quote_to_budget(uuid, boolean) from public;
revoke execute on function public.apply_quote_to_budget(uuid, boolean) from anon;
grant execute on function public.apply_quote_to_budget(uuid, boolean) to authenticated;
