import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { hashContenido, claveBoleta } from '../lib/nombres.mjs';

// Siembra la 22.ª Fiesta con datos verificados: el volante, la fe de erratas que
// Matacandelas mandó el 20 de agosto, y las cinco boletas que están en disco.
//
// Lo que NO hace: inventar. Petra y las segundas boletas de Molienda y Habitar
// constan en los correos de pedido pero sus archivos no están descargados, así
// que quedan como estado "comprada" sin fila de boleta. La app lo señala en vez
// de fabricar un archivo que no existe.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DESCARGAS = process.env.DIR_BOLETAS ?? 'D:\\Download';
const BUCKET = 'baul-eventos';

if (!URL || !KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corre npm run setup.');
  process.exit(1);
}

const c = createClient(URL, KEY, { db: { schema: 'eventos' }, auth: { persistSession: false } });
const almacen = createClient(URL, KEY, { auth: { persistSession: false } });

// --- Salas de Medellín ------------------------------------------------------
// Tomadas de references/salas-medellin.md de la skill festival-agenda.

const SALAS = [
  ['mata',    'Teatro Matacandelas',                  'Clle. 47 #43-47',      '604 2151010', 'centro'],
  ['ocs',     'Teatro Oficina Central de los Sueños',  'Cra. 43 #52-50',       '604 2394179', 'centro'],
  ['esc3',    'Teatro Escena 3',                       'Cra. 45 #52-72',       '321 7035575', 'centro'],
  ['popu',    'Teatro Popular de Medellín',            'Clle. 48 #41-13',      '604 5574964', 'centro'],
  ['ptu',     'Teatro Pablo Tobón Uribe',              'Cra. 40 #51-24',       '604 2397500', 'centro'],
  ['agite',   'Agité Teatro',                          'Clle. 52 #39A-30',     '604 4237030', 'centro'],
  ['clown',   'Teatro Casa Clown',                     'Cra. 42 #44-46',       '321 8386557', 'centro'],
  ['pasca',   'La Pascasia',                           'Clle. 47 #43-88',      '604 5808660', 'centro'],
  ['comfa',   'Teatro Comfama Alfonso Restrepo Moreno','Clle. 48 #43-87',      '604 4216290', 'centro'],
  ['viva',    'Vivapalabra',                           'Clle. 55 #43-63',      '313 6150109', 'centro'],
  ['sucur',   'Teatro La Sucursal',                    'Clle. 54 #42-44',      '317 4620095', 'centro'],
  ['casat',   'Casa del Teatro de Medellín',           'Clle. 59 #50A-25',     '319 7297209', 'centro'],
  ['arle',    'Teatro Arlequín y los Juglares',        'Cra. 44 #69-71',       '604 4335829', 'norte'],
  ['ziru',    'Corporación Ziruma',                    'Clle. 64 #39-18',      '311 3069236', 'norte'],
  ['gente',   'Corporación Cultural Nuestra Gente',    'Clle. 99 #50C-38',     '604 2580348', 'norte'],
  ['barra',   'Teatro Barra del Silencio',             'Clle. 45C #75-151',    '310 8456329', 'occidente'],
  ['caran',   'Teatro Carantoña',                      'Cra. 75 #24-47',       '316 2534548', 'occidente'],
  ['canchi',  'Corporación Canchimalos',               'Clle. 47dd #88-24',    '604 2046178', 'occidente'],
  ['fanfa',   'La Fanfarria Teatro',                   'Cra. 84 #42C-54',      '316 4568732', 'occidente'],
  ['poli',    'La Polilla',                            'Clle. 23 #76-85',      '320 6777067', 'occidente'],
  ['pobla',   'CasaTeatro El Poblado',                 'Cra. 47B #17B Sur-30', '317 6803421', 'sur'],
  ['caretas', 'Teatro de Títeres Caretas',             'Cra. 126B #61A-71',    '604 4270698', 'corregimiento'],
  ['elemen',  'Elemental Teatro Casa Contenta',        'Diag. 48 este #53-224, Santa Elena', '319 6582877', 'corregimiento'],
];

const ZONAS = ['centro', 'norte', 'occidente', 'sur', 'corregimiento'];
const MINUTOS = {
  centro:        { centro: 12, norte: 25, occidente: 25, sur: 30, corregimiento: 50 },
  norte:         { centro: 25, norte: 15, occidente: 35, sur: 40, corregimiento: 55 },
  occidente:     { centro: 25, norte: 35, occidente: 15, sur: 30, corregimiento: 55 },
  sur:           { centro: 30, norte: 40, occidente: 30, sur: 12, corregimiento: 45 },
  corregimiento: { centro: 50, norte: 55, occidente: 55, sur: 45, corregimiento: 60 },
};

// --- Funciones --------------------------------------------------------------
// Duraciones estimadas salvo donde se diga: teatro 80, molienda 180, cena 120,
// clown 70. Ninguna está confirmada con la sala todavía.

const FESTIVAL = {
  slug: 'fiesta-artes-escenicas-22-2026',
  nombre: '22.ª Fiesta de las Artes Escénicas',
  ciudad: 'Medellín',
  fecha_inicio: '2026-08-20',
  fecha_fin: '2026-08-30',
};

const FUNCIONES = [
  {
    ref: 'krapp', fecha: '2026-08-24', hora_min: 1200, duracion_min: 80, sala: 'ocs',
    obra: 'KRAPP, la última cinta', compania: 'Actores en Escena (Manizales)',
    precio_pleno: 35000, precio_dcto: 10300, agendada: true, acompanantes: 0,
    nota_boleteria: 'Descuentos afiliados a Comfama',
  },
  {
    ref: 'petra25', fecha: '2026-08-25', hora_min: 1200, duracion_min: 80, sala: 'mata',
    obra: 'Petra, versión libre para gesto y danza', compania: 'AmbidiestroLab (Bogotá)',
    precio_pleno: 35000, precio_dcto: 10900, agendada: true, acompanantes: 0,
    nota_boleteria: 'General $35.000 · Comfama TA $10.900 TB $18.900 TC $30.900',
  },
  {
    // Misma obra, otra fecha. Va aunque no esté agendada: sin ella el motor no
    // puede decir que Petra es recuperable.
    ref: 'petra26', fecha: '2026-08-26', hora_min: 1200, duracion_min: 80, sala: 'mata',
    obra: 'Petra, versión libre para gesto y danza', compania: 'AmbidiestroLab (Bogotá)',
    precio_pleno: 35000, precio_dcto: 10900, agendada: false, acompanantes: 0,
  },
  {
    ref: 'molienda', fecha: '2026-08-26', hora_min: 1200, duracion_min: 180, sala: 'ptu',
    obra: 'Molienda de Danza', compania: 'Evento especial · INCOLBALLET (Cali) y Era Parca (Medellín)',
    precio_pleno: 0, precio_dcto: null, agendada: true, acompanantes: 1,
    nota_boleteria: 'Entrada libre con Eticketa Blanca. Se agota antes que las pagas.',
  },
  {
    ref: 'primeramor', fecha: '2026-08-27', hora_min: 1200, duracion_min: 80, sala: 'mata',
    obra: 'Primer Amor', compania: 'Colectivo Teatral Matacandelas · de Samuel Beckett',
    precio_pleno: 45000, precio_dcto: 13700, agendada: true, acompanantes: 1,
    nota_boleteria:
      'General $45.000 · estudiantes, tercera edad y discapacidad $25.000 · ' +
      'en bicicleta $20.000 · asociados CONFIAR $20.000 · Comfama TA $13.700',
  },
  {
    ref: 'cocina', fecha: '2026-08-27', hora_min: 1320, duracion_min: 120, sala: 'mata',
    obra: 'Teatro y Cocina', compania: 'Jorge Blandón · Teatro Comunitario y Sancocho',
    precio_pleno: 40000, precio_dcto: null, agendada: true, acompanantes: 1,
    fuente_horario: 'fe-de-erratas',
    nota_boleteria:
      'Precio único $40.000, sin descuentos, e incluye cena. Fe de erratas de ' +
      'Matacandelas del 20 de agosto: la hora es 10:00 p.m., no 9:30 como dice el volante.',
  },
  {
    ref: 'habitar', fecha: '2026-08-28', hora_min: 1200, duracion_min: 80, sala: 'pobla',
    obra: 'Habitar', compania: 'Móvil Teatro Laboratorio (Bogotá)',
    precio_pleno: 35000, precio_dcto: 10900, agendada: true, acompanantes: 1,
    nota_boleteria: 'Descuentos afiliados a Comfama',
  },
  {
    ref: 'ixaque28', fecha: '2026-08-28', hora_min: 1200, duracion_min: 80, sala: 'mata',
    obra: 'IXAQUENE', compania: 'Acrobacia aérea en tela y video mapping',
    precio_pleno: 35000, precio_dcto: 10900, agendada: false, acompanantes: 0,
  },
  {
    ref: 'ixaque29', fecha: '2026-08-29', hora_min: 1200, duracion_min: 80, sala: 'mata',
    obra: 'IXAQUENE', compania: 'Acrobacia aérea en tela y video mapping',
    precio_pleno: 35000, precio_dcto: 10900, agendada: false, acompanantes: 0,
  },
  {
    ref: 'clown29', fecha: '2026-08-29', hora_min: 1200, duracion_min: 70, sala: 'clown',
    obra: 'Fiesta Clown', compania: 'Colectivo Teatral Infusión',
    precio_pleno: 30000, precio_dcto: 10700, agendada: true, acompanantes: 0,
    nota_boleteria: 'Comfama TA $10.700 TB $15.500 TC $26.300',
  },
  {
    ref: 'gatos29', fecha: '2026-08-29', hora_min: 990, duracion_min: 70, sala: 'mata',
    obra: 'GalactiGatos', compania: 'Marary Teatro · Piñata de la Fiesta',
    precio_pleno: 30000, precio_dcto: 25000, agendada: false, acompanantes: 0,
  },
];

// Estado verificado contra los correos de pedido de eTicketaBlanca.
const ESTADOS = {
  krapp:      { estado: 'comprada', nota: '1× Comfama Tarifa A. Pedido del 24 de agosto.' },
  petra25:    { estado: 'comprada', nota: '1× Comfama Tarifa A $10.900 + $2.000. Pedido del 24 de agosto 1:20 p.m. El PDF quedó en el correo, sin descargar.' },
  molienda:   { estado: 'comprada', nota: '2× General, cortesía. Pedido del 11 de agosto 10:58 p.m. Solo un PDF descargado.' },
  primeramor: { estado: 'comprada', nota: '2× boletas: una Comfama TA $11.900 y una General $45.000.' },
  cocina:     { estado: 'agendada', nota: 'Faltan 2. Lleva cena, así que el cupo cierra antes.' },
  habitar:    { estado: 'comprada', nota: '2× Comfama Tarifa A $10.900 + $4.000. Pedido del 24 de agosto 1:22 p.m. Solo un PDF descargado.' },
  clown29:    { estado: 'agendada', nota: 'Sin comprar. Choca con IXAQUENE del sábado, que es su única fecha viable.' },
};

// Las cinco boletas que sí están en disco, ya extraídas.
const BOLETAS = [
  {
    archivo: '6a8c8a902fbaa6b90b861cbc.pdf', ref: 'krapp',
    categoria: 'COMFAMA TARIFA A', valor_ticket: 10300, valor_servicio: 2000,
    codigo: 'lurzbjt8m8jbb8', pulep: 'URX194',
  },
  {
    archivo: '6a8c862ad122e51cfd49de05.pdf', ref: 'primeramor',
    categoria: 'Comfama Tarifa A', valor_ticket: 11900, valor_servicio: 0,
    codigo: 'rmgunllgli5hld', pulep: 'MOQ600',
  },
  {
    archivo: '6a8c885e84692c26bbf6f308.pdf', ref: 'primeramor',
    categoria: 'General', valor_ticket: 45000, valor_servicio: 0,
    codigo: 'qzasyrk51wnv9s', pulep: 'MOQ600',
  },
  {
    archivo: '6a8c8c1e5df5fb958f949b22.pdf', ref: 'habitar',
    categoria: 'COMFAMA TARIFA A', valor_ticket: 10900, valor_servicio: 2000,
    codigo: 'r2l5vtik3j3crp', pulep: 'OEU921',
  },
  {
    archivo: '6a7bef8f9ec9ebdc88da5185.pdf', ref: 'molienda',
    categoria: 'GENERAL', valor_ticket: 0, valor_servicio: 0,
    codigo: 'bb38vr6762ge2d', pulep: 'DOV278',
  },
];

const TITULAR = 'David Andrés Loaiza Marín';
const OPERADOR = 'WS Ticketing SAS · eTicketaBlanca';

// --- Ejecución --------------------------------------------------------------

async function upsert(tabla, filas, conflicto) {
  const { data, error } = await c.from(tabla).upsert(filas, { onConflict: conflicto }).select();
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return data;
}

console.log('Salas…');
await upsert('salas', SALAS.map(([slug, nombre, direccion, telefono, zona]) =>
  ({ slug, nombre, direccion, telefono, zona, ciudad: 'Medellín' })), 'slug');
const { data: salas } = await c.from('salas').select('id, slug');
const salaId = Object.fromEntries(salas.map(s => [s.slug, s.id]));

console.log('Traslados…');
const traslados = [];
for (const a of ZONAS) for (const b of ZONAS) {
  traslados.push({ ciudad: 'Medellín', zona_a: a, zona_b: b, minutos: MINUTOS[a][b] });
}
await upsert('traslados', traslados, 'ciudad,zona_a,zona_b');

console.log('Festival…');
const [festival] = await upsert('festivales', [FESTIVAL], 'slug');

console.log('Funciones…');
const refAId = {};
for (const f of FUNCIONES) {
  const fila = {
    festival_id: festival.id,
    sala_id: salaId[f.sala],
    fecha: f.fecha,
    hora_min: f.hora_min,
    duracion_min: f.duracion_min,
    duracion_confirmada: false,
    obra: f.obra,
    compania: f.compania,
    precio_pleno: f.precio_pleno,
    precio_dcto: f.precio_dcto ?? null,
    nota_boleteria: f.nota_boleteria ?? null,
    acompanantes: f.acompanantes,
    agendada: f.agendada,
    fuente_horario: f.fuente_horario ?? 'volante',
  };
  const { data: previa } = await c.from('funciones').select('id')
    .eq('festival_id', festival.id).eq('fecha', f.fecha)
    .eq('hora_min', f.hora_min).eq('obra', f.obra).maybeSingle();
  if (previa) {
    await c.from('funciones').update(fila).eq('id', previa.id);
    refAId[f.ref] = previa.id;
  } else {
    const { data, error } = await c.from('funciones').insert(fila).select('id').single();
    if (error) throw new Error(`funciones ${f.ref}: ${error.message}`);
    refAId[f.ref] = data.id;
  }
}

console.log('Estados de compra…');
await upsert('estados_compra', Object.entries(ESTADOS).map(([ref, e]) =>
  ({ funcion_id: refAId[ref], estado: e.estado, nota: e.nota })), 'funcion_id');

console.log('Boletas…');
let subidas = 0, saltadas = 0;
for (const b of BOLETAS) {
  const ruta = join(DESCARGAS, b.archivo);
  let buffer;
  try {
    buffer = await readFile(ruta);
  } catch {
    console.warn(`  no está: ${ruta} (se salta, la función queda sin archivo)`);
    saltadas++;
    continue;
  }
  const hash = hashContenido(buffer);
  const { data: ya } = await c.from('boletas')
    .select('id').eq('hash_contenido', hash).maybeSingle();
  if (ya) { saltadas++; continue; }

  const f = FUNCIONES.find(x => x.ref === b.ref);
  const clave = claveBoleta(
    FESTIVAL.slug,
    { fecha: f.fecha, hora_min: f.hora_min, obra: f.obra, salaSlug: f.sala },
    hash, 'application/pdf', b.archivo,
  );
  const { error: e } = await almacen.storage.from(BUCKET)
    .upload(clave, buffer, { contentType: 'application/pdf', upsert: false });
  if (e && !/exists/i.test(e.message)) throw new Error(`storage ${b.archivo}: ${e.message}`);

  const { error: eIns } = await c.from('boletas').insert({
    funcion_id: refAId[b.ref],
    festival_id: festival.id,
    titular: TITULAR,
    categoria: b.categoria,
    valor_ticket: b.valor_ticket,
    valor_servicio: b.valor_servicio,
    codigo: b.codigo,
    pulep: b.pulep,
    operador: OPERADOR,
    storage_key: clave,
    hash_contenido: hash,
    mime: 'application/pdf',
    origen: 'correo',
    extraccion_estado: 'confirmada',
    extraccion_json: { archivo_original: b.archivo, extraido_en: 'sesión de Claude Code, 24 ago 2026' },
  });
  if (eIns) throw new Error(`boletas ${b.archivo}: ${eIns.message}`);
  subidas++;
}

console.log(`\nListo. ${subidas} boletas subidas, ${saltadas} saltadas.`);
console.log('Abre la app: npm run dev');
