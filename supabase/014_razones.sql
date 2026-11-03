-- Razones escritas por Claude al cargar un festival, una por obra (el ojeo es
-- por obra: una obra repetida en cinco fechas no necesita cinco copias).

create table if not exists eventos.razones (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references eventos.festivales(id) on delete cascade,
  obra         text not null,
  texto        text not null check (char_length(texto) <= 280),
  creado       timestamptz not null default now(),
  unique (festival_id, obra)
);

alter table eventos.razones enable row level security;

drop policy if exists acceso_codigo on eventos.razones;
create policy acceso_codigo on eventos.razones for all to anon, authenticated
  using (eventos.acceso_ok()) with check (eventos.acceso_ok());

notify pgrst, 'reload schema';
