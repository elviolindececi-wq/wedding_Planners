-- Seguimiento operativo del día del evento.
-- Una invitación puede representar a varias personas, por eso guardamos cantidad sentada
-- en vez de un simple booleano.
alter table public.guests
  add column if not exists seated_count integer not null default 0;

alter table public.guests
  drop constraint if exists guests_seated_count_nonnegative;

alter table public.guests
  add constraint guests_seated_count_nonnegative check (seated_count >= 0);

comment on column public.guests.seated_count is
  'Cantidad de personas de esta invitación que efectivamente se sentaron/asistieron el día del evento.';
