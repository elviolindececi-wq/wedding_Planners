-- Budget + payments fields for the professional event workspace.
-- This migration also restores the budget-total concept from Tu Boda Organizada,
-- so the planner can set a ceiling and distribute it among editable categories.

alter table public.events
  add column if not exists budget_total numeric(14,2) not null default 0;

alter table public.events
  drop constraint if exists events_budget_total_nonnegative;

alter table public.events
  add constraint events_budget_total_nonnegative check (budget_total >= 0);

alter table public.budget_categories
  add column if not exists planned_amount numeric(14,2) not null default 0,
  add column if not exists cost_type text not null default 'fixed';

alter table public.budget_categories
  drop constraint if exists budget_categories_cost_type_check;

alter table public.budget_categories
  add constraint budget_categories_cost_type_check
  check (cost_type in ('fixed','per_guest','mixed'));

alter table public.vendor_payments
  add column if not exists payment_method text,
  add column if not exists receipt_url text;

create index if not exists budget_items_event_category_idx
  on public.budget_items(event_id, category_id);
