-- v0.7.2 · completar proveedores/pagos luego de que 0007 ya fue aplicada.
-- Mantiene 0007 inmutable y agrega solo los cambios posteriores de v0.7.1.

alter table public.event_vendors
  add column if not exists has_contract boolean not null default false,
  add column if not exists contract_url text;

create index if not exists vendor_payments_event_vendor_idx
  on public.vendor_payments(event_id, event_vendor_id);

create or replace function public.sync_event_vendor_to_budget(p_event_vendor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.event_vendors%rowtype;
  e public.events%rowtype;
  v public.vendors%rowtype;
  c public.budget_categories%rowtype;
  item_id uuid;
  rate numeric;
  quoted_equiv numeric;
  contracted_equiv numeric;
  zero_decimal boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into ev
  from public.event_vendors
  where id = p_event_vendor_id
  for update;

  if ev.id is null then raise exception 'event_vendor_not_found'; end if;
  if not public.can_access_event(ev.event_id) then raise exception 'event_not_accessible'; end if;
  if ev.budget_category_id is null then raise exception 'budget_category_required'; end if;

  select * into e from public.events where id = ev.event_id;
  select * into v from public.vendors where id = ev.vendor_id;
  select * into c
  from public.budget_categories
  where id = ev.budget_category_id and event_id = ev.event_id;

  if c.id is null then raise exception 'invalid_budget_category'; end if;

  if upper(ev.currency) = upper(e.currency) then
    rate := 1;
  else
    rate := ev.exchange_rate;
  end if;

  if rate is null or rate <= 0 then raise exception 'exchange_rate_required'; end if;

  zero_decimal := upper(e.currency) in ('PYG','CLP','JPY','KRW');

  quoted_equiv := case
    when ev.quoted_amount is null then null
    when zero_decimal then round(ev.quoted_amount * rate, 0)
    else round(ev.quoted_amount * rate, 2)
  end;

  contracted_equiv := case
    when ev.contracted_amount is null then null
    when zero_decimal then round(ev.contracted_amount * rate, 0)
    else round(ev.contracted_amount * rate, 2)
  end;

  select id into item_id
  from public.budget_items
  where event_id = ev.event_id and event_vendor_id = ev.id
  order by created_at
  limit 1;

  if item_id is null then
    item_id := gen_random_uuid();
    insert into public.budget_items(
      id, event_id, category_id, event_vendor_id, description,
      quoted_amount, contracted_amount, currency, notes, updated_at
    ) values (
      item_id, ev.event_id, c.id, ev.id,
      coalesce(nullif(ev.service_category,''), v.company_name),
      quoted_equiv, contracted_equiv, e.currency,
      'Vinculado al proveedor ' || v.company_name,
      now()
    );
  else
    update public.budget_items
    set category_id = c.id,
        description = coalesce(nullif(ev.service_category,''), description),
        quoted_amount = quoted_equiv,
        contracted_amount = contracted_equiv,
        currency = e.currency,
        updated_at = now()
    where id = item_id;
  end if;

  update public.vendor_payments
  set budget_item_id = item_id
  where event_id = ev.event_id
    and event_vendor_id = ev.id
    and budget_item_id is null;

  return item_id;
end;
$$;

revoke execute on function public.sync_event_vendor_to_budget(uuid) from public;
revoke execute on function public.sync_event_vendor_to_budget(uuid) from anon;
grant execute on function public.sync_event_vendor_to_budget(uuid) to authenticated;

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
  ev_id uuid;
  item_id uuid;
  rate numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into q
  from public.quotes
  where id = p_quote_id
  for update;

  if q.id is null then raise exception 'quote_not_found'; end if;
  if not public.can_access_event(q.event_id) then raise exception 'event_not_accessible'; end if;
  if q.budget_category_id is null then raise exception 'budget_category_required'; end if;

  select * into e from public.events where id = q.event_id;
  select * into v from public.vendors where id = q.vendor_id;
  select * into c
  from public.budget_categories
  where id = q.budget_category_id and event_id = q.event_id;

  if c.id is null then raise exception 'invalid_budget_category'; end if;

  if upper(q.currency) = upper(e.currency) then
    rate := 1;
  else
    rate := q.exchange_rate;
  end if;

  if rate is null or rate <= 0 then raise exception 'exchange_rate_required'; end if;

  ev_id := q.event_vendor_id;

  if ev_id is null then
    select id into ev_id
    from public.event_vendors
    where event_id = q.event_id
      and vendor_id = q.vendor_id
      and budget_category_id = q.budget_category_id
    limit 1;
  end if;

  if ev_id is null then
    ev_id := gen_random_uuid();
    insert into public.event_vendors(
      id, event_id, vendor_id, service_category, budget_category_id,
      status, quoted_amount, contracted_amount, currency,
      exchange_rate, exchange_rate_source, exchange_rate_date, updated_at
    ) values (
      ev_id, q.event_id, q.vendor_id, c.name, c.id,
      case when p_contract then 'contracted' else 'selected' end,
      q.amount,
      case when p_contract then q.amount else null end,
      q.currency, rate, q.exchange_rate_source, q.exchange_rate_date, now()
    );
  else
    update public.event_vendors
    set budget_category_id = c.id,
        service_category = c.name,
        status = case when p_contract then 'contracted' else 'selected' end,
        quoted_amount = q.amount,
        contracted_amount = case when p_contract then q.amount else contracted_amount end,
        currency = q.currency,
        exchange_rate = rate,
        exchange_rate_source = q.exchange_rate_source,
        exchange_rate_date = q.exchange_rate_date,
        updated_at = now()
    where id = ev_id;
  end if;

  update public.quotes
  set is_selected = false
  where event_id = q.event_id
    and budget_category_id = q.budget_category_id
    and id <> q.id;

  update public.quotes
  set is_selected = true,
      event_vendor_id = ev_id
  where id = q.id;

  item_id := public.sync_event_vendor_to_budget(ev_id);

  update public.budget_items
  set quote_id = q.id
  where id = item_id;

  return item_id;
end;
$$;

revoke execute on function public.apply_quote_to_budget(uuid, boolean) from public;
revoke execute on function public.apply_quote_to_budget(uuid, boolean) from anon;
grant execute on function public.apply_quote_to_budget(uuid, boolean) to authenticated;
