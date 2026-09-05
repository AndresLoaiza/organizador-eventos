import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { sql, unaFila, poolPg, almacen, BUCKET } from './_cliente.mjs';
import { tituloNormalizado } from '../lib/nombres.mjs';
import { FESTIVAL, FUNCIONES } from './datos-san-ignacio.mjs';

// Carga el Festival de Teatro Comfama San Ignacio 2026.
//
// A diferencia de la Fiesta del Libro, aquí la programación sí trae duración
// publicada casi siempre: 49 de 52 funciones. Eso importa más de lo que parece,
// porque los veredictos de choque dejan de descansar sobre un número inventado.
// Las tres que faltan quedan marcadas como estimadas.
//
// Lo que NO trae el sitio es el precio. Comfama cobra por tarifas escalonadas
// TA/TB/TC/TD según afiliación, y la TA puede ser menos de la cuarta parte de
// la TD. Poner un precio plausible contaminaría el total del festival en
// silencio, así que van en cero y la nota lo dice.

const DIR_IMG = 'trabajo/sanignacio/imagenes';

// Zonas propias del festival, con prefijo. Medellín ya tiene zonas cargadas
// por los otros dos festivales que usan "centro" y "norte" con otro
// significado; sin prefijo, la matriz de uno pisaría la del otro.
const ZONAS = ['fsi-claustro', 'fsi-distrito', 'fsi-centro', 'fsi-udea'];

// Casi todo el festival cabe caminando dentro del Distrito San Ignacio, pero
// caminando no es teletransportarse: entre el Claustro y Matacandelas hay unas
// cuadras más la fila de entrada. El Claustro consigo mismo son 6 y no 0
// porque el Patio, La Capilla y la Plazuela son espacios distintos del mismo
// conjunto. La UdeA sí es un traslado de verdad.
//
// Ante la duda se sobreestima: un falso «no alcanzas» hace que se pierda algo;
// un falso «sí alcanzas» hace llegar tarde y perder la función y la plata.
const MINUTOS = {
  'fsi-claustro': { 'fsi-claustro': 6,  'fsi-distrito': 10, 'fsi-centro': 20, 'fsi-udea': 30 },
  'fsi-distrito': { 'fsi-claustro': 10, 'fsi-distrito': 12, 'fsi-centro': 18, 'fsi-udea': 28 },
  'fsi-centro':   { 'fsi-claustro': 20, 'fsi-distrito': 18, 'fsi-centro': 12, 'fsi-udea': 25 },
  'fsi-udea':     { 'fsi-claustro': 30, 'fsi-distrito': 28, 'fsi-centro': 25, 'fsi-udea': 5 },
};

const SEDES = {
  'Patio Teatro Claustro Comfama':        ['fsi-patio', 'fsi-claustro', 'Claustro Comfama San Ignacio'],
  'La Capilla – Claustro Comfama':        ['fsi-capilla', 'fsi-claustro', 'Claustro Comfama San Ignacio'],
  'Plazuela San Ignacio':                 ['fsi-plazuela', 'fsi-claustro', 'Plazuela San Ignacio, al aire libre'],
  'Teatro Comfama':                       ['fsi-comfama', 'fsi-distrito', 'Clle. 48 #43-87'],
  'Teatro Popular de Medellín (TPM)':     ['fsi-tpm', 'fsi-distrito', 'Clle. 48 #41-13 · 604 5574964'],
  'Teatro Matacandelas':                  ['fsi-matacandelas', 'fsi-distrito', 'Clle. 47 #43-47 · 604 2151010'],
  'Estación San Antonio Metro de Medellín': ['fsi-san-antonio', 'fsi-distrito', 'Estación San Antonio, Metro'],
  'Casa Clown':                           ['fsi-casa-clown', 'fsi-centro', 'Cra. 42 #44-46 · 321 8386557'],
  'Pequeño Teatro':                       ['fsi-pequeno', 'fsi-centro', 'Cra. 42 #50A-12'],
  'Teatro Pablo Tobón Uribe (TPTU)':      ['fsi-ptu', 'fsi-centro', 'Cra. 40 #51-24 · 604 2397500'],
  'Teatro Universitario Camilo Torres - UdeA': ['fsi-udea-camilo', 'fsi-udea', 'Ciudad Universitaria UdeA'],
};

const faltantes = [...new Set(FUNCIONES.map(f => f.sala))].filter(s => !SEDES[s]);
if (faltantes.length) {
  console.error('Salas sin zona asignada, se aborta antes de escribir:', faltantes);
  process.exit(1);
}

console.log('Sedes…');
for (const [nombre, [slug, zona, direccion]] of Object.entries(SEDES)) {
  await sql(
    `insert into eventos.salas (slug, nombre, zona, ciudad, direccion)
     values ($1, $2, $3, 'Medellín', $4)
     on conflict (slug) do update set nombre = excluded.nombre,
       zona = excluded.zona, direccion = excluded.direccion`,
    [slug, nombre, zona, direccion]);
}

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
   values ($1,$2,$3,$4,$5)
   on conflict (slug) do update set nombre = excluded.nombre,
     fecha_inicio = excluded.fecha_inicio, fecha_fin = excluded.fecha_fin
   returning id`,
  [FESTIVAL.slug, FESTIVAL.nombre, FESTIVAL.ciudad, FESTIVAL.fecha_inicio, FESTIVAL.fecha_fin]);

const salas = await sql('select id, slug from eventos.salas');
const salaId = Object.fromEntries(salas.map(s => [s.slug, s.id]));

// El motor agrupa repeticiones comparando el título exacto. Si la misma obra
// entrara una vez como "Hamlet" y otra como "HAMLET", diría que se pierde algo
// que en realidad se puede ver otro día. Hay test de regresión por esto.
const canon = new Map();
for (const f of FUNCIONES) {
  const k = tituloNormalizado(f.obra);
  if (!canon.has(k)) canon.set(k, f.obra);
}

console.log('Funciones…');
let nuevas = 0, actualizadas = 0;
for (const f of FUNCIONES) {
  const obra = canon.get(tituloNormalizado(f.obra));
  const nota = [f.publico, 'Boletería por confirmar (tarifas Comfama)']
    .filter(Boolean).join(' · ');
  const ficha = [f.compania, f.descripcion].filter(Boolean).join(' · ').slice(0, 900);

  const previa = await unaFila(
    `select id from eventos.funciones
      where festival_id = $1 and fecha = $2 and hora_min = $3 and obra = $4`,
    [festival.id, f.fecha, f.hora_min, obra]);

  if (previa) {
    await sql(
      `update eventos.funciones set sala_id = $2, duracion_min = $3,
              duracion_confirmada = $4, compania = $5, nota_boleteria = $6 where id = $1`,
      [previa.id, salaId[SEDES[f.sala][0]], f.duracion_min, f.duracion_confirmada, ficha, nota]);
    actualizadas++;
  } else {
    await sql(
      `insert into eventos.funciones
         (festival_id, sala_id, fecha, hora_min, duracion_min, duracion_confirmada, obra,
          compania, precio_pleno, precio_dcto, nota_boleteria, acompanantes, agendada, fuente_horario)
       values ($1,$2,$3,$4,$5,$6,$7,$8,0,null,$9,0,false,'sitio-web')`,
      [festival.id, salaId[SEDES[f.sala][0]], f.fecha, f.hora_min, f.duracion_min,
       f.duracion_confirmada, obra, ficha, nota]);
    nuevas++;
  }
}

// --- Imágenes ---------------------------------------------------------------
// La atribución no hay que adivinarla como con el volante de artes escénicas:
// aquí la foto venía dentro del mismo bloque HTML que la obra, así que el
// vínculo es exacto. Si falta la llave de Storage, el resto ya quedó cargado.
const storage = almacen();
let fotos = 0, sinFoto = [];
if (!storage) {
  console.log('\nSin SUPABASE_SERVICE_ROLE_KEY: las fotos no se suben. El resto quedó cargado.');
} else {
  const enDisco = new Set(await readdir(DIR_IMG).catch(() => []));
  const porObra = new Map();
  for (const f of FUNCIONES) porObra.set(canon.get(tituloNormalizado(f.obra)), f.imagen);

  for (const [obra, archivo] of porObra) {
    if (!enDisco.has(archivo)) { sinFoto.push(obra); continue; }
    const clave = `fotos/${FESTIVAL.slug}/${archivo}`;
    const bytes = await readFile(join(DIR_IMG, archivo));
    const { error } = await storage.storage.from(BUCKET)
      .upload(clave, bytes, { contentType: 'image/webp', upsert: true });
    if (error) { sinFoto.push(`${obra} (${error.message})`); continue; }
    await sql(
      `update eventos.funciones set imagen_key = $2, imagen_credito = 'comfama.com'
        where festival_id = $1 and obra = $3`,
      [festival.id, clave, obra]);
    fotos++;
  }
}

const r = await unaFila(
  `select count(*) as total,
          count(*) filter (where duracion_confirmada) as con_duracion,
          count(*) filter (where imagen_key is not null) as con_foto,
          count(distinct obra) as obras, count(distinct fecha) as dias
     from eventos.funciones where festival_id = $1`, [festival.id]);

console.log(`\n${nuevas} nuevas, ${actualizadas} actualizadas.`);
console.log(`Total: ${r.total} funciones en ${r.dias} días, ${r.obras} obras distintas.`);
console.log(`${r.con_duracion} con duración publicada, ${r.total - r.con_duracion} estimadas.`);
console.log(`${fotos} fotos subidas, ${r.con_foto} funciones con foto.`);
if (sinFoto.length) console.log('Sin foto:', sinFoto);

await poolPg().end();
