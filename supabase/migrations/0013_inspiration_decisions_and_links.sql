-- v1.5.3 · cerrar Diseño & Inspiración como flujo de decisión y ejecución.
-- Agrega estado, nota operativa y vínculos opcionales a proveedor/categoría.

alter table public.inspiration_items
  add column if not exists decision_status text not null default 'idea',
  add column if not exists execution_note text,
  add column if not exists event_vendor_id uuid references public.event_vendors(id) on delete set null,
  add column if not exists budget_category_id uuid references public.budget_categories(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspiration_items_decision_status_check'
  ) then
    alter table public.inspiration_items
      add constraint inspiration_items_decision_status_check
      check (decision_status in ('idea','shortlisted','selected','approved','discarded'));
  end if;
end $$;

create index if not exists inspiration_items_event_status_idx
  on public.inspiration_items(event_id, decision_status, sort_order, created_at desc);
create index if not exists inspiration_items_event_vendor_idx
  on public.inspiration_items(event_id, event_vendor_id);
create index if not exists inspiration_items_budget_category_idx
  on public.inspiration_items(event_id, budget_category_id);
