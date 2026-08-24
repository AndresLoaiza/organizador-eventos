-- Organizador de Eventos — schema aislado dentro del proyecto nuestros-viajes.
-- Se usa un schema propio para no chocar con polla-app ni viajes-app, que viven en public.

create schema if not exists eventos;

-- ---------------------------------------------------------------------------
-- Catálogo

create table if not exists eventos.festivales (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  nombre        text not null,
  ciudad        text not null default 'Medellín',
  fecha_inicio  date not null,
  fecha_fin     date not null,
  creado        timestamptz not null default now()
);

create table if not exists eventos.salas (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  nombre     text not null,
  direccion  text,
  telefono   text,
  ciudad     text not null default 'Medellín',
  zona       text not null
);

-- Matriz de traslados por zona. Estimados de carro o transporte público,
-- sin contar parqueo ni fila de entrada.
create table if not exists eventos.traslados (
  ciudad   text not null,
  zona_a   text not null,
  zona_b   text not null,
  minutos  int  not null,
  primary key (ciudad, zona_a, zona_b)
);

-- ---------------------------------------------------------------------------
-- Programación

create table if not exists eventos.funciones (
  id                   uuid primary key default gen_random_uuid(),
  festival_id          uuid not null references eventos.festivales(id) on delete cascade,
  sala_id              uuid references eventos.salas(id),
  fecha                date not null,
  hora_min             int  not null,          -- minutos desde medianoche: 19:30 -> 1170
  duracion_min         int  not null default 80,
  duracion_confirmada  boolean not null default false,
  obra                 text not null,          -- título normalizado, SIN la compañía
  compania             text,                   -- compañía, ciudad, notas de ficha
  precio_pleno         int  not null default 0,
  precio_dcto          int,
  nota_boleteria       text,
  acompanantes         int  not null default 0, -- personas además de Andrés
  agendada             boolean not null default false, -- está en MI agenda, no solo en el volante
  fuente_horario       text not null default 'volante', -- volante | fe-de-erratas | boleta | sala
  creado               timestamptz not null default now()
);

create index if not exists funciones_festival_fecha on eventos.funciones (festival_id, fecha, hora_min);
create index if not exists funciones_obra on eventos.funciones (festival_id, obra);

-- ---------------------------------------------------------------------------
-- Boletas. El archivo original vive en Storage y jamás se modifica:
-- toda corrección ocurre en estas columnas.

create table if not exists eventos.boletas (
  id                  uuid primary key default gen_random_uuid(),
  funcion_id          uuid references eventos.funciones(id) on delete set null,
  festival_id         uuid references eventos.festivales(id) on delete set null,
  titular             text,
  categoria           text,                    -- "COMFAMA TARIFA A", "GENERAL", ...
  valor_ticket        int,
  valor_servicio      int not null default 0,
  localidad           text,
  codigo              text,                    -- código escaneable en la puerta
  pulep               text,
  operador            text,                    -- WS Ticketing, taquilla, cortesía
  storage_key         text unique not null,
  hash_contenido      text not null,           -- sha256 del archivo; evita duplicados
  mime                text,
  origen              text not null default 'subida', -- subida | correo | taquilla
  extraccion_estado   text not null default 'pendiente', -- pendiente | extraida | confirmada
  extraccion_json     jsonb,
  campos_dudosos      text[] not null default '{}',
  creado              timestamptz not null default now()
);

-- Un mismo archivo no entra dos veces, pero dos boletas distintas de la misma
-- función sí: es lo correcto cuando va acompañado.
create unique index if not exists boletas_hash_unico on eventos.boletas (hash_contenido);
create index if not exists boletas_funcion on eventos.boletas (funcion_id);

-- ---------------------------------------------------------------------------
-- Estado de compra por función

do $$ begin
  create type eventos.estado_compra as enum ('agendada','comprada','vencida','no_alcanzada');
exception when duplicate_object then null; end $$;

create table if not exists eventos.estados_compra (
  funcion_id    uuid primary key references eventos.funciones(id) on delete cascade,
  estado        eventos.estado_compra not null default 'agendada',
  fecha_limite  date,
  nota          text,
  actualizado   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bitácora. El texto pesa más que la estrella y por eso es obligatorio.

create table if not exists eventos.bitacora (
  id          uuid primary key default gen_random_uuid(),
  funcion_id  uuid not null references eventos.funciones(id) on delete cascade,
  texto       text not null,
  estrellas   int check (estrellas between 1 and 5),
  fecha       date not null default current_date,
  sincronizado_obsidian timestamptz,
  creado      timestamptz not null default now()
);

create index if not exists bitacora_funcion on eventos.bitacora (funcion_id);

-- ---------------------------------------------------------------------------
-- Avisos: las incoherencias detectadas. Se recalculan, no se acumulan.

create table if not exists eventos.avisos (
  id          uuid primary key default gen_random_uuid(),
  funcion_id  uuid references eventos.funciones(id) on delete cascade,
  tipo        text not null,   -- hora_discordante | cruce_franja | boletas_insuficientes
                               -- | agendada_vencida | boleta_huerfana | duracion_estimada
  severidad   text not null default 'aviso', -- alto | aviso
  mensaje     text not null,
  resuelto    boolean not null default false,
  creado      timestamptz not null default now()
);

create index if not exists avisos_abiertos on eventos.avisos (resuelto, severidad);

-- ---------------------------------------------------------------------------
-- RLS. El único acceso es por route handlers con service_role, que salta RLS.
-- Se activa igual para que una llave publishable filtrada no lea nada.

alter table eventos.festivales     enable row level security;
alter table eventos.salas          enable row level security;
alter table eventos.traslados      enable row level security;
alter table eventos.funciones      enable row level security;
alter table eventos.boletas        enable row level security;
alter table eventos.estados_compra enable row level security;
alter table eventos.bitacora       enable row level security;
alter table eventos.avisos         enable row level security;

-- Sin políticas: nadie que no sea service_role lee ni escribe.

revoke all on schema eventos from anon, authenticated;
