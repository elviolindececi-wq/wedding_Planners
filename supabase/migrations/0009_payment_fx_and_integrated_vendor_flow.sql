-- v0.8.1 · Pagos en moneda original + equivalente estable en moneda del evento.
-- Corrige el backfill de v0.8 para PostgreSQL evitando referenciar el alias
-- de la tabla objetivo dentro del JOIN de UPDATE ... FROM.

alter table public.vendor_payments
  add column if not exists exchange_rate numeric(20,8),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_date date,
  add column if not exists event_amount numeric(14,2);

create index if not exists vendor_payments_event_status_due_idx
  on public.vendor_payments(event_id, status, due_date);

-- Backfill seguro para pagos existentes. Hasta v0.7.x se guardaban en la
-- moneda base del evento.
update public.vendor_payments p
set exchange_rate = 1,
    exchange_rate_source = coalesce(p.exchange_rate_source, 'Misma moneda'),
    exchange_rate_date = coalesce(p.exchange_rate_date, current_date),
    event_amount = coalesce(p.event_amount, p.amount)
from public.events e
where e.id = p.event_id
  and upper(p.currency) = upper(e.currency)
  and (p.exchange_rate is null or p.event_amount is null);

-- Para pagos históricos vinculados a un proveedor en otra moneda, toma el
-- tipo de cambio guardado en event_vendors. El contexto se calcula primero
-- en un CTE para evitar el patrón inválido `... JOIN ... ON ev.id = p...`
-- dentro de UPDATE ... FROM.
with payment_context as (
  select
    vp.id as payment_id,
    e.currency as event_currency,
    ev.currency as vendor_currency,
    ev.exchange_rate as vendor_exchange_rate,
    ev.exchange_rate_source as vendor_exchange_rate_source,
    ev.exchange_rate_date as vendor_exchange_rate_date
  from public.vendor_payments vp
  join public.events e on e.id = vp.event_id
  left join public.event_vendors ev on ev.id = vp.event_vendor_id
  where vp.event_amount is null
)
update public.vendor_payments p
set exchange_rate = coalesce(p.exchange_rate, c.vendor_exchange_rate),
    exchange_rate_source = coalesce(
      p.exchange_rate_source,
      c.vendor_exchange_rate_source,
      case when c.vendor_exchange_rate is not null then 'Proveedor' else null end
    ),
    exchange_rate_date = coalesce(
      p.exchange_rate_date,
      c.vendor_exchange_rate_date,
      case when c.vendor_exchange_rate is not null then current_date else null end
    ),
    event_amount = coalesce(
      p.event_amount,
      case
        when upper(p.currency) = upper(c.event_currency) then p.amount
        when upper(p.currency) = upper(c.vendor_currency)
             and c.vendor_exchange_rate is not null then
          case
            when upper(c.event_currency) in ('PYG','CLP','JPY','KRW')
              then round(p.amount * c.vendor_exchange_rate, 0)
            else round(p.amount * c.vendor_exchange_rate, 2)
          end
        else null
      end
    )
from payment_context c
where c.payment_id = p.id;

-- Mantiene utilizables pagos históricos para los que no pudo inferirse un
-- tipo de cambio. Los nuevos pagos de v0.8 guardan event_amount explícitamente.
update public.vendor_payments
set event_amount = amount
where event_amount is null;
