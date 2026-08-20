-- Diseño & Inspiración · imágenes privadas por evento
-- La tabla public.inspiration_items ya existe desde 0001.

create index if not exists inspiration_items_event_sort_idx
  on public.inspiration_items(event_id, sort_order, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-inspiration',
  'event-inspiration',
  false,
  12582912,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_inspiration_storage(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  event_text text;
begin
  event_text := split_part(coalesce(object_name, ''), '/', 1);
  if event_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_access_event(event_text::uuid);
end;
$$;

drop policy if exists "event_inspiration_select" on storage.objects;
drop policy if exists "event_inspiration_insert" on storage.objects;
drop policy if exists "event_inspiration_update" on storage.objects;
drop policy if exists "event_inspiration_delete" on storage.objects;

create policy "event_inspiration_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-inspiration'
  and public.can_access_inspiration_storage(name)
);

create policy "event_inspiration_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-inspiration'
  and public.can_access_inspiration_storage(name)
);

create policy "event_inspiration_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-inspiration'
  and public.can_access_inspiration_storage(name)
)
with check (
  bucket_id = 'event-inspiration'
  and public.can_access_inspiration_storage(name)
);

create policy "event_inspiration_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-inspiration'
  and public.can_access_inspiration_storage(name)
);
