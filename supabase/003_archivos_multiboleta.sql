-- Un archivo puede traer varias boletas.
--
-- El modelo original ataba una boleta a un archivo: storage_key y hash vivían en
-- la fila de la boleta, con índice único. Eso es falso para el operador que usa
-- este festival: cuando se compran dos entradas de la misma función, eTicketa
-- Blanca manda UN PDF con las dos, una por página. El PDF de Molienda de Danza
-- trae dos, y el de Habitar también.
--
-- Consecuencia del error: la app decía "necesitas 2 boletas y solo hay 1
-- registrada" para funciones que estaban completas desde el principio. Una
-- alarma falsa es peor que no tener alarma, porque enseña a ignorarlas.
--
-- La corrección separa las dos cosas que se estaban confundiendo:
--   archivos = lo que se sube y nunca se modifica, único por hash
--   boletas  = lo que sirve para entrar a una sala, una por persona

create table if not exists eventos.archivos (
  id                 uuid primary key default gen_random_uuid(),
  festival_id        uuid references eventos.festivales(id) on delete set null,
  storage_key        text unique not null,
  hash_contenido     text unique not null,
  mime               text,
  origen             text not null default 'subida',      -- subida | correo | taquilla
  extraccion_estado  text not null default 'pendiente',   -- pendiente | extraida | confirmada
  extraccion_json    jsonb,
  creado             timestamptz not null default now()
);

alter table eventos.boletas add column if not exists archivo_id uuid references eventos.archivos(id) on delete set null;
alter table eventos.boletas add column if not exists pagina int;

-- Traslada lo que ya existe: cada boleta actual era un archivo de una sola página.
insert into eventos.archivos (festival_id, storage_key, hash_contenido, mime, origen, extraccion_estado, extraccion_json, creado)
select b.festival_id, b.storage_key, b.hash_contenido, b.mime, b.origen, b.extraccion_estado, b.extraccion_json, b.creado
  from eventos.boletas b
 where b.storage_key is not null
   and not exists (select 1 from eventos.archivos a where a.hash_contenido = b.hash_contenido);

update eventos.boletas b
   set archivo_id = a.id,
       pagina = coalesce(b.pagina, 1)
  from eventos.archivos a
 where a.hash_contenido = b.hash_contenido
   and b.archivo_id is null;

-- Ya no son de la boleta: son del archivo.
alter table eventos.boletas drop column if exists storage_key;
alter table eventos.boletas drop column if exists hash_contenido;
alter table eventos.boletas drop column if exists mime;
alter table eventos.boletas drop column if exists origen;
alter table eventos.boletas drop column if exists extraccion_estado;
alter table eventos.boletas drop column if exists extraccion_json;

-- Dos boletas del mismo archivo no pueden compartir página, pero sí pueden ser
-- de la misma función: es justo el caso de ir acompañado.
create unique index if not exists boletas_archivo_pagina on eventos.boletas (archivo_id, pagina)
  where archivo_id is not null;

create index if not exists archivos_pendientes on eventos.archivos (extraccion_estado);

alter table eventos.archivos enable row level security;
