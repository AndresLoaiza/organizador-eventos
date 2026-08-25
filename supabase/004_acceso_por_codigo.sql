-- Acceso por código, para que la app pueda vivir en GitHub Pages.
--
-- En hosting estático no hay servidor donde esconder una llave: el navegador
-- habla con Supabase usando la llave publishable, que en este proyecto ya está
-- publicada dentro de los bundles de polla-app y viajes-app. Si las políticas se
-- abrieran a anon sin más, cualquiera con esa llave leería los códigos de
-- boleta, que son escaneables en la puerta de la sala.
--
-- La salida conserva el gesto elegido —un código, como en las otras dos apps—
-- pero lo hace verificar por Postgres: el cliente manda el código en la cabecera
-- x-acceso, RLS compara su hash, y el código nunca viaja dentro del bundle.
--
-- El hash NO está en este archivo. Si el repositorio se hace público para poder
-- usar Pages, un hash versionado se rompe por fuerza bruta en segundos, sobre
-- todo si el código sigue un patrón. Vive en eventos.acceso, que anon no puede
-- leer, y se pone con `npm run codigo`.

create extension if not exists pgcrypto with schema extensions;

create table if not exists eventos.acceso (
  id      int primary key default 1,
  hash    text not null,
  puesto  timestamptz not null default now(),
  constraint acceso_una_fila check (id = 1)
);

alter table eventos.acceso enable row level security;

create or replace function eventos.acceso_ok()
returns boolean
language sql
stable
security definer
set search_path = eventos, extensions, pg_temp
as $$
  select exists (
    select 1 from eventos.acceso a
     where a.hash = encode(
       digest(coalesce(current_setting('request.headers', true)::json ->> 'x-acceso', ''), 'sha256'),
       'hex')
  );
$$;

grant execute on function eventos.acceso_ok() to anon, authenticated;

grant usage on schema eventos to anon, authenticated;
grant select, insert, update, delete on all tables in schema eventos to anon, authenticated;
alter default privileges in schema eventos grant select, insert, update, delete on tables to anon, authenticated;

-- La tabla del hash queda fuera de ese grant: solo la lee la función, que corre
-- como su dueño. Si anon pudiera leerla, publicar el repo daría igual porque el
-- hash saldría por la API.
revoke all on eventos.acceso from anon, authenticated;

-- Una política por tabla, todas con la misma condición. Se recrean para poder
-- correr la migración dos veces sin romper nada.
do $$
declare t text;
begin
  foreach t in array array['festivales','salas','traslados','funciones','boletas',
                           'archivos','estados_compra','bitacora','avisos']
  loop
    execute format('drop policy if exists acceso_codigo on eventos.%I', t);
    execute format(
      'create policy acceso_codigo on eventos.%I for all to anon, authenticated
         using (eventos.acceso_ok()) with check (eventos.acceso_ok())', t);
  end loop;
end $$;

-- El baúl: mismo criterio para los archivos. Sin esta política el navegador no
-- puede pedir URLs firmadas con la llave publishable, y el bucket sigue privado
-- para todo el que no traiga el código.
drop policy if exists baul_acceso_codigo on storage.objects;
create policy baul_acceso_codigo on storage.objects for all to anon, authenticated
  using (bucket_id = 'baul-eventos' and eventos.acceso_ok())
  with check (bucket_id = 'baul-eventos' and eventos.acceso_ok());

-- PostgREST solo expone los schemas que le digan, y por defecto son public y
-- graphql_public. Sin esto la app estática recibe PGRST106 y no ve la base. Se
-- conservan los dos originales para no romper polla-app ni viajes-app, que viven
-- en public dentro de este mismo proyecto.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, eventos';
notify pgrst, 'reload config';
