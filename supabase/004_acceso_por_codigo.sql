-- Acceso por código, para que la app pueda vivir en GitHub Pages.
--
-- En hosting estático no hay servidor donde esconder una llave: el navegador
-- habla con Supabase usando la llave publishable, que en este proyecto ya está
-- publicada dentro de los bundles de polla-app y viajes-app. Si las políticas
-- se abrieran a anon sin más, cualquiera con esa llave leería los códigos de
-- boleta, que son escaneables en la puerta de la sala.
--
-- La salida conserva el gesto elegido —un código, como en las otras dos apps—
-- pero lo hace verificar por Postgres: el cliente manda el código en la
-- cabecera x-acceso, RLS compara su hash contra el que está aquí, y el código
-- nunca viaja dentro del bundle. Quien tenga la llave publishable y no el
-- código no lee ni una fila.

create extension if not exists pgcrypto with schema extensions;

-- sha256 del código de acceso. Para cambiarlo:
--   node -e "console.log(require('crypto').createHash('sha256').update('NUEVO').digest('hex'))"
create or replace function eventos.acceso_ok()
returns boolean
language sql
stable
as $$
  select coalesce(
    encode(
      extensions.digest(
        coalesce(current_setting('request.headers', true)::json ->> 'x-acceso', ''),
        'sha256'),
      'hex')
    = 'f60760823cfe46583df6f29d69b6659c4e683ee77b3d51b9439b12b367b89fe8',
    false);
$$;

grant usage on schema eventos to anon, authenticated;
grant select, insert, update, delete on all tables in schema eventos to anon, authenticated;
alter default privileges in schema eventos grant select, insert, update, delete on tables to anon, authenticated;

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

-- El baúl: mismo criterio para los archivos. Sin esta política, el navegador no
-- puede pedir URLs firmadas con la llave publishable, y el bucket sigue privado
-- para todo el que no traiga el código.
drop policy if exists baul_acceso_codigo on storage.objects;
create policy baul_acceso_codigo on storage.objects for all to anon, authenticated
  using (bucket_id = 'baul-eventos' and eventos.acceso_ok())
  with check (bucket_id = 'baul-eventos' and eventos.acceso_ok());

-- PostgREST solo expone los schemas que le digan, y por defecto son public y
-- graphql_public. Sin esto la app estática recibe PGRST106 y no ve la base.
-- Se conservan los dos originales para no romper polla-app ni viajes-app, que
-- viven en public dentro de este mismo proyecto.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, eventos';
notify pgrst, 'reload config';
