-- v0.6 · moneda del evento + conversión transaccional + país para clima/geocodificación.
-- SOLO para el proyecto Supabase NUEVO de Wedding_planners.

alter table public.events
  add column if not exists country text,
  add column if not exists currency_rate_from text,
  add column if not exists currency_rate_to text,
  add column if not exists currency_rate_value numeric(20,8),
  add column if not exists currency_rate_source text,
  add column if not exists currency_rate_date date;

create or replace function public.change_event_currency(
  p_event_id uuid,
  p_new_currency text,
  p_mode text,
  p_rate numeric,
  p_rate_source text,
  p_rate_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_currency text;
  v_factor numeric;
  v_zero_decimal boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.can_access_event(p_event_id) then
    raise exception 'event_not_accessible';
  end if;

  select e.currency
  into v_old_currency
  from public.events e
  where e.id = p_event_id
  for update;

  if v_old_currency is null then
    raise exception 'event_not_found';
  end if;

  if nullif(btrim(p_new_currency), '') is null then
    raise exception 'new_currency_required';
  end if;

  if v_old_currency = upper(btrim(p_new_currency)) then
    return;
  end if;

  if p_mode is null or p_mode not in ('convert', 'label_only') then
    raise exception 'invalid_currency_change_mode';
  end if;

  if p_mode = 'convert' and (p_rate is null or p_rate <= 0) then
    raise exception 'positive_exchange_rate_required';
  end if;

  v_factor := case when p_mode = 'convert' then p_rate else 1 end;
  v_zero_decimal := upper(btrim(p_new_currency)) in ('PYG','CLP','JPY','KRW');

  update public.events
  set
    budget_total = case
      when v_zero_decimal then round(coalesce(budget_total, 0) * v_factor, 0)
      else round(coalesce(budget_total, 0) * v_factor, 2)
    end,
    currency = upper(btrim(p_new_currency)),
    currency_rate_from = v_old_currency,
    currency_rate_to = upper(btrim(p_new_currency)),
    currency_rate_value = case when p_mode = 'convert' then p_rate else null end,
    currency_rate_source = case when p_mode = 'convert' then nullif(btrim(p_rate_source), '') else 'Sin conversión' end,
    currency_rate_date = case when p_mode = 'convert' then p_rate_date else null end,
    updated_at = now()
  where id = p_event_id;

  update public.budget_categories
  set planned_amount = case
    when v_zero_decimal then round(coalesce(planned_amount, 0) * v_factor, 0)
    else round(coalesce(planned_amount, 0) * v_factor, 2)
  end
  where event_id = p_event_id;

  update public.budget_items
  set
    estimated_amount = case when estimated_amount is null then null when v_zero_decimal then round(estimated_amount * v_factor, 0) else round(estimated_amount * v_factor, 2) end,
    quoted_amount = case when quoted_amount is null then null when v_zero_decimal then round(quoted_amount * v_factor, 0) else round(quoted_amount * v_factor, 2) end,
    contracted_amount = case when contracted_amount is null then null when v_zero_decimal then round(contracted_amount * v_factor, 0) else round(contracted_amount * v_factor, 2) end,
    unit_amount = case when unit_amount is null then null when v_zero_decimal then round(unit_amount * v_factor, 0) else round(unit_amount * v_factor, 2) end,
    currency = upper(btrim(p_new_currency)),
    updated_at = now()
  where event_id = p_event_id;

  update public.vendor_payments
  set
    amount = case when v_zero_decimal then round(amount * v_factor, 0) else round(amount * v_factor, 2) end,
    currency = upper(btrim(p_new_currency))
  where event_id = p_event_id;
end;
$$;

revoke execute on function public.change_event_currency(uuid, text, text, numeric, text, date) from public;
revoke execute on function public.change_event_currency(uuid, text, text, numeric, text, date) from anon;
grant execute on function public.change_event_currency(uuid, text, text, numeric, text, date) to authenticated;
