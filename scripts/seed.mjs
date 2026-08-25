import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { hashContenido, claveBoleta } from '../lib/nombres.mjs';
import { sql, unaFila, poolPg, almacen, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';

// Siembra la 22.ª Fiesta con datos verificados: el volante, la fe de erratas que
// Matacandelas mandó el 20 de agosto, y los archivos de boleta que están en disco.
//
// Lo que NO hace: inventar. La boleta de Petra consta en el correo de pedido
// pero su PDF no está descargado, así que la función queda como "comprada" sin
// fila de boleta. La app lo señala en vez de fabricar un archivo que no existe.

const DESCARGAS = process.env.DIR_BOLETAS ?? String.raw`D:\Download`;

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

// Los cinco archivos que están en disco, ya extraídos.
//
// Un archivo puede traer varias boletas: cuando se compran dos entradas de la
// misma función, eTicketa Blanca manda un solo PDF con las dos, una por página.
// Es el caso de Molienda de Danza y de Habitar.
const ARCHIVOS = [
  {
    archivo: '6a8c8a902fbaa6b90b861cbc.pdf', ref: 'krapp',
    boletas: [
      { pagina: 1, categoria: 'COMFAMA TARIFA A', valor_ticket: 10300, valor_servicio: 2000, codigo: 'lurzbjt8m8jbb8', pulep: 'URX194' },
    ],
  },
  {
    archivo: '6a8c862ad122e51cfd49de05.pdf', ref: 'primeramor',
    boletas: [
      { pagina: 1, categoria: 'Comfama Tarifa A', valor_ticket: 11900, valor_servicio: 0, codigo: 'rmgunllgli5hld', pulep: 'MOQ600' },
    ],
  },
  {
    archivo: '6a8c885e84692c26bbf6f308.pdf', ref: 'primeramor',
    boletas: [
      { pagina: 1, categoria: 'General', valor_ticket: 45000, valor_servicio: 0, codigo: 'qzasyrk51wnv9s', pulep: 'MOQ600' },
    ],
  },
  {
    archivo: '6a8c8c1e5df5fb958f949b22.pdf', ref: 'habitar',
    boletas: [
      { pagina: 1, categoria: 'COMFAMA TARIFA A', valor_ticket: 10900, valor_servicio: 2000, codigo: 'r2l5vtik3j3crp', pulep: 'OEU921' },
      { pagina: 2, categoria: 'COMFAMA TARIFA A', valor_ticket: 10900, valor_servicio: 2000, codigo: 'fkn65z53yby1xz', pulep: 'OEU921' },
    ],
  },
  {
    archivo: '6a7bef8f9ec9ebdc88da5185.pdf', ref: 'molienda',
    boletas: [
      { pagina: 1, categoria: 'GENERAL', valor_ticket: 0, valor_servicio: 0, codigo: 'bb38vr6762ge2d', pulep: 'DOV278' },
      { pagina: 2, categoria: 'GENERAL', valor_ticket: 0, valor_servicio: 0, codigo: '2in1yo1xs3mwcs', pulep: 'DOV278' },
    ],
  },
];

const TITULAR = 'David Andrés Loaiza Marín';
const OPERADOR = 'WS Ticketing SAS · eTicketaBlanca';

// --- Ejecución --------------------------------------------------------------

console.log('Salas…');
for (const [slug, nombre, direccion, telefono, zona] of SALAS) {
  await sql(
    `insert into eventos.salas (slug, nombre, direccion, telefono, zona, ciudad)
     values ($1, $2, $3, $4, $5, 'Medellín')
     on conflict (slug) do update
       set nombre = excluded.nombre, direccion = excluded.direccion,
           telefono = excluded.telefono, zona = excluded.zona`,
    [slug, nombre, direccion, telefono, zona]);
}
const salas = await sql('select id, slug from eventos.salas');
const salaId = Object.fromEntries(salas.map(s => [s.slug, s.id]));

console.log('Traslados…');
for (const a of ZONAS) for (const b of ZONAS) {
  await sql(
    `insert into eventos.traslados (ciudad, zona_a, zona_b, minutos)
     values ('Medellín', $1, $2, $3)
     on conflict (ciudad, zona_a, zona_b) do update set minutos = excluded.minutos`,
    [a, b, MINUTOS[a][b]]);
}

console.log('Festival…');
const festival = await unaFila(
  `insert into eventos.festivales (slug, nombre, ciudad, fecha_inicio, fecha_fin)
   values ($1, $2, $3, $4, $5)
   on conflict (slug) do update
     set nombre = excluded.nombre, fecha_inicio = excluded.fecha_inicio,
         fecha_fin = excluded.fecha_fin
   returning id`,
  [FESTIVAL.slug, FESTIVAL.nombre, FESTIVAL.ciudad, FESTIVAL.fecha_inicio, FESTIVAL.fecha_fin]);

console.log('Funciones…');
const refAId = {};
for (const f of FUNCIONES) {
  const valores = [
    festival.id, salaId[f.sala], f.fecha, f.hora_min, f.duracion_min,
    f.obra, f.compania ?? null, f.precio_pleno, f.precio_dcto ?? null,
    f.nota_boleteria ?? null, f.acompanantes, f.agendada, f.fuente_horario ?? 'volante',
  ];
  const previa = await unaFila(
    `select id from eventos.funciones
      where festival_id = $1 and fecha = $2 and hora_min = $3 and obra = $4`,
    [festival.id, f.fecha, f.hora_min, f.obra]);

  if (previa) {
    await sql(
      `update eventos.funciones
          set sala_id = $2, duracion_min = $3, compania = $4, precio_pleno = $5,
              precio_dcto = $6, nota_boleteria = $7, acompanantes = $8,
              agendada = $9, fuente_horario = $10
        where id = $1`,
      [previa.id, salaId[f.sala], f.duracion_min, f.compania ?? null, f.precio_pleno,
       f.precio_dcto ?? null, f.nota_boleteria ?? null, f.acompanantes,
       f.agendada, f.fuente_horario ?? 'volante']);
    refAId[f.ref] = previa.id;
  } else {
    const fila = await unaFila(
      `insert into eventos.funciones
         (festival_id, sala_id, fecha, hora_min, duracion_min, obra, compania,
          precio_pleno, precio_dcto, nota_boleteria, acompanantes, agendada, fuente_horario)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id`, valores);
    refAId[f.ref] = fila.id;
  }
}

console.log('Estados de compra…');
for (const [ref, e] of Object.entries(ESTADOS)) {
  await sql(
    `insert into eventos.estados_compra (funcion_id, estado, nota)
     values ($1, $2, $3)
     on conflict (funcion_id) do update
       set estado = excluded.estado, nota = excluded.nota, actualizado = now()`,
    [refAId[ref], e.estado, e.nota]);
}

console.log('Archivos y boletas…');
const storage = almacen();
let subidos = 0, saltados = 0, sinLlave = 0, filas = 0;

for (const a of ARCHIVOS) {
  const ruta = join(DESCARGAS, a.archivo);
  let buffer;
  try {
    buffer = await readFile(ruta);
  } catch {
    console.warn(`  no está en disco: ${a.archivo} (la función queda sin archivo)`);
    saltados++;
    continue;
  }
  const hash = hashContenido(buffer);
  const f = FUNCIONES.find(x => x.ref === a.ref);

  let archivo = await unaFila('select id from eventos.archivos where hash_contenido = $1', [hash]);

  if (!archivo) {
    if (!storage) { sinLlave++; continue; }
    const clave = claveBoleta(
      FESTIVAL.slug,
      { fecha: f.fecha, hora_min: f.hora_min, obra: f.obra, salaSlug: f.sala },
      hash, 'application/pdf', a.archivo,
    );
    const { error: e } = await storage.storage.from(BUCKET)
      .upload(clave, buffer, { contentType: 'application/pdf', upsert: false });
    if (e && !/exists/i.test(e.message)) throw new Error(`storage ${a.archivo}: ${e.message}`);

    archivo = await unaFila(
      `insert into eventos.archivos
         (festival_id, storage_key, hash_contenido, mime, origen, extraccion_estado, extraccion_json)
       values ($1, $2, $3, 'application/pdf', 'correo', 'confirmada', $4)
       returning id`,
      [festival.id, clave, hash,
       JSON.stringify({ archivo_original: a.archivo, boletas: a.boletas.length,
                        extraido_en: 'sesión de Claude Code, 24 ago 2026' })]);
    subidos++;
  }

  for (const b of a.boletas) {
    const ya = await unaFila(
      'select id from eventos.boletas where archivo_id = $1 and pagina = $2', [archivo.id, b.pagina]);
    if (ya) continue;
    await sql(
      `insert into eventos.boletas
         (funcion_id, festival_id, archivo_id, pagina, titular, categoria,
          valor_ticket, valor_servicio, codigo, pulep, operador)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [refAId[a.ref], festival.id, archivo.id, b.pagina, TITULAR, b.categoria,
       b.valor_ticket, b.valor_servicio, b.codigo, b.pulep, OPERADOR]);
    filas++;
  }
}

const cuenta = await unaFila(
  `select (select count(*) from eventos.funciones) as funciones,
          (select count(*) from eventos.funciones where agendada) as agendadas,
          (select count(*) from eventos.salas) as salas,
          (select count(*) from eventos.boletas) as boletas,
          (select count(*) from eventos.archivos) as archivos`);

console.log(`
Sembrado: ${cuenta.salas} salas, ${cuenta.funciones} funciones ` +
  `(${cuenta.agendadas} en tu agenda), ${cuenta.archivos} archivos, ${cuenta.boletas} boletas.`);
if (subidos) console.log(`${subidos} archivos subidos al baúl, ${filas} boletas nuevas.`);
if (saltados) console.log(`${saltados} saltados (no están en disco).`);
if (sinLlave) {
  console.log(`
${sinLlave} archivos quedaron sin subir. ${FALTA_LLAVE_STORAGE}`);
  console.log('Cuando la pongas en .env.local, vuelve a correr: npm run seed');
}

await poolPg().end();
