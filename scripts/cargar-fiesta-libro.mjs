import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { tituloNormalizado } from '../lib/nombres.mjs';

// Carga la 20.ª Fiesta del Libro y la Cultura desde el CSV extraído del sitio.
//
// A diferencia del volante de artes escénicas, aquí hay hora de inicio Y de
// fin, así que la duración es un dato real y no una estimación. Eso cambia el
// valor de los veredictos: los márgenes dejan de descansar sobre un número
// inventado.
//
// El CSV viene con cuatro defectos sistemáticos que se corrigen aquí, no a mano:
//   1. 712 de 778 filas traen la palabra "Franja" pegada al nombre de la franja.
//   2. 468 descripciones repiten el teaser antes del texto completo.
//   3. Diez talleres de dos horas cierran a las "12:00 a. m." en vez del mediodía.
//   4. Dos eventos aparecen dos veces por pertenecer a dos franjas a la vez.

const RUTA = process.env.CSV_FIESTA_LIBRO ?? String.raw`D:\Download\fiesta_libro_medellin_2026.csv`;

const FESTIVAL = {
  slug: 'fiesta-libro-cultura-20-2026',
  nombre: '20.ª Fiesta del Libro y la Cultura',
  ciudad: 'Medellín',
  fecha_inicio: '2026-09-11',
  fecha_fin: '2026-09-20',
};

// Zonas propias de este festival. Llevan prefijo para no chocar con las de la
// Fiesta de las Artes Escénicas, que comparten ciudad y usan "norte" y "centro"
// con otro significado.
const ZONAS = ['flc-recinto', 'flc-explora', 'flc-udea', 'flc-norte', 'flc-ciudad'];

// Casi todo ocurre dentro del Jardín Botánico: caminar entre auditorios cuesta
// minutos, no traslados. Por eso el recinto consigo mismo son 8 y no 0: son
// salas distintas separadas por senderos y filas de entrada.
const MINUTOS = {
  'flc-recinto': { 'flc-recinto': 8,  'flc-explora': 12, 'flc-udea': 15, 'flc-norte': 30, 'flc-ciudad': 40 },
  'flc-explora': { 'flc-recinto': 12, 'flc-explora': 6,  'flc-udea': 15, 'flc-norte': 30, 'flc-ciudad': 40 },
  'flc-udea':    { 'flc-recinto': 15, 'flc-explora': 15, 'flc-udea': 5,  'flc-norte': 30, 'flc-ciudad': 40 },
  'flc-norte':   { 'flc-recinto': 30, 'flc-explora': 30, 'flc-udea': 30, 'flc-norte': 5,  'flc-ciudad': 45 },
  'flc-ciudad':  { 'flc-recinto': 40, 'flc-explora': 40, 'flc-udea': 40, 'flc-norte': 45, 'flc-ciudad': 30 },
};

const SEDES = {
  'Auditorio EPM': ['flc-epm', 'flc-recinto'],
  'Auditorio Salón Iberoamericano del Libro Universitario': ['flc-iberoamericano', 'flc-recinto'],
  'Auditorio Salón de Editoriales Independientes': ['flc-independientes', 'flc-recinto'],
  'Auditorio Aurita López': ['flc-aurita', 'flc-recinto'],
  'Auditorio Almadía': ['flc-almadia', 'flc-recinto'],
  'Sala Orquideorama': ['flc-orquideorama', 'flc-recinto'],
  'Tarima Sura': ['flc-tarima-sura', 'flc-recinto'],
  'Auditorio Salón del Libro Infantil y Juvenil': ['flc-infantil', 'flc-recinto'],
  'Salón Humboldt': ['flc-humboldt', 'flc-recinto'],
  'Auditorio Cómic': ['flc-comic', 'flc-recinto'],
  'Auditorio Corea del Sur': ['flc-corea', 'flc-recinto'],
  'Cuentódromo': ['flc-cuentodromo', 'flc-recinto'],
  'Salón La Piloto': ['flc-la-piloto', 'flc-recinto'],
  'Cinemateca móvil': ['flc-cinemateca', 'flc-recinto'],
  'Salón Conversaciones · La Casa de la Imaginación Comfama': ['flc-comfama', 'flc-recinto'],
  'Cabina Literaria': ['flc-cabina', 'flc-recinto'],
  'Auditorio Explora': ['flc-auditorio-explora', 'flc-explora'],
  'Teatro Explora': ['flc-teatro-explora', 'flc-explora'],
  'Exploratorio - Parque Explora': ['flc-exploratorio', 'flc-explora'],
  'Domo Planetario': ['flc-domo', 'flc-explora'],
  'Teatro Universitario Camilo Torres, Campus UdeA': ['flc-camilo-torres', 'flc-udea'],
  'Parque Biblioteca 20 años · SBPM': ['flc-biblioteca-20', 'flc-norte'],
  'Casa de la Literatura San Germán': ['flc-san-german', 'flc-ciudad'],
  'Ojo de Agua Librería': ['flc-ojo-de-agua', 'flc-ciudad'],
  'Librería Casa Libre': ['flc-casa-libre', 'flc-ciudad'],
  'Librería de La Pascasia': ['flc-pascasia', 'flc-ciudad'],
  'Librería Las Letras del Jaguar': ['flc-jaguar', 'flc-ciudad'],
  'Librería Antimateria': ['flc-antimateria', 'flc-ciudad'],
};

// --- Limpieza ---------------------------------------------------------------

function aMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m/i.exec((hora ?? '').trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return h * 60 + Number(m[2]);
}

function limpiarFranja(f) {
  // "FranjaSalón de Nuevas Lecturas" -> "Salón de Nuevas Lecturas".
  // Solo cuando lo que sigue arranca en mayúscula: hay franjas legítimas que
  // no llevan el prefijo y no se deben tocar.
  const s = (f ?? '').trim();
  return /^Franja[A-ZÁÉÍÓÚÑ¡¿]/.test(s) ? s.slice(6) : s;
}

function limpiarDescripcion(d) {
  let s = (d ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < 80) return s;
  // El extractor guarda el teaser y luego el texto completo, que lo repite.
  // Se busca el punto donde el texto vuelve a empezar y se deja solo el largo.
  const arranque = s.slice(0, 45);
  const segundo = s.indexOf(arranque, 1);
  if (segundo > 0) s = s.slice(segundo);
  return s.trim();
}

function partirCsv(texto) {
  const filas = [];
  let campo = '', fila = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift();
  return filas.filter(f => f.length >= cab.length)
    .map(f => Object.fromEntries(cab.map((k, i) => [k, f[i] ?? ''])));
}

// --- Ejecución --------------------------------------------------------------

const texto = await readFile(RUTA, 'utf8');
const crudas = partirCsv(texto);
console.log(`${crudas.length} filas leídas.`);

const porClave = new Map();
let horasArregladas = 0, sinSede = new Set(), sinHora = 0;

for (const r of crudas) {
  const [d, m, a] = r.fecha.split('/');
  const fecha = `${a}-${m}-${d}`;
  const inicio = aMinutos(r.hora_inicio);
  let fin = aMinutos(r.hora_fin);
  if (inicio == null) { sinHora++; continue; }

  // Talleres de 10 a 12 que el sitio cierra como "12:00 a. m.".
  if (fin != null && fin < inicio && fin === 0) { fin = 12 * 60; horasArregladas++; }

  let dur = fin != null && fin > inicio ? fin - inicio : null;
  const confirmada = dur != null && dur <= 360;
  if (!confirmada) dur = 60;

  if (!SEDES[r.lugar]) sinSede.add(r.lugar);

  const clave = `${fecha}|${inicio}|${tituloNormalizado(r.titulo)}|${r.lugar}`;
  const franja = limpiarFranja(r.franja);

  if (porClave.has(clave)) {
    // Mismo evento en dos franjas: se acumulan en vez de duplicar la función.
    const y = porClave.get(clave);
    if (franja && !y.franjas.includes(franja)) y.franjas.push(franja);
    continue;
  }

  porClave.set(clave, {
    fecha, inicio, dur, confirmada,
    titulo: r.titulo.replace(/\s+/g, ' ').trim(),
    franjas: franja ? [franja] : [],
    lugar: r.lugar,
    descripcion: limpiarDescripcion(r.descripcion),
    lsc: (r.lsc ?? '').trim().toLowerCase().startsWith('s'),
  });
}

const eventos = [...porClave.values()];
console.log(`${eventos.length} eventos tras unir duplicados (${crudas.length - eventos.length} unidos).`);
console.log(`${horasArregladas} horas de cierre corregidas · ${eventos.filter(e => e.confirmada).length} con duración real.`);
if (sinHora) console.log(`${sinHora} filas sin hora legible, descartadas.`);
if (sinSede.size) { console.log('Sedes sin mapear:'); for (const s of sinSede) console.log('  ' + s); }

console.log('\nSedes…');
for (const [nombre, [slug, zona]] of Object.entries(SEDES)) {
  await sql(
    `insert into eventos.salas (slug, nombre, zona, ciudad) values ($1, $2, $3, 'Medellín')
     on conflict (slug) do update set nombre = excluded.nombre, zona = excluded.zona`,
    [slug, nombre, zona]);
}

console.log('Traslados…');
for (const a of ZONAS) for (const b of ZONAS) {
  await sql(
    `insert into eventos.traslados (ciudad, zona_a, zona_b, minutos) values ('Medellín', $1, $2, $3)
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

console.log('Funciones…');
let nuevas = 0, actualizadas = 0;
for (const e of eventos) {
  const slugSede = SEDES[e.lugar]?.[0];
  const nota = [
    e.franjas.join(' · '),
    e.lsc ? 'Con intérprete de Lengua de Señas Colombiana' : null,
    'Entrada libre',
  ].filter(Boolean).join(' · ');

  const previa = await unaFila(
    `select id from eventos.funciones
      where festival_id = $1 and fecha = $2 and hora_min = $3 and obra = $4`,
    [festival.id, e.fecha, e.inicio, e.titulo]);

  if (previa) {
    await sql(
      `update eventos.funciones set sala_id = $2, duracion_min = $3, duracion_confirmada = $4,
              compania = $5, nota_boleteria = $6 where id = $1`,
      [previa.id, salaId[slugSede] ?? null, e.dur, e.confirmada, e.descripcion.slice(0, 900), nota]);
    actualizadas++;
  } else {
    await sql(
      `insert into eventos.funciones
         (festival_id, sala_id, fecha, hora_min, duracion_min, duracion_confirmada, obra,
          compania, precio_pleno, precio_dcto, nota_boleteria, acompanantes, agendada, fuente_horario)
       values ($1,$2,$3,$4,$5,$6,$7,$8,0,null,$9,0,false,'sitio-web')`,
      [festival.id, salaId[slugSede] ?? null, e.fecha, e.inicio, e.dur, e.confirmada,
       e.titulo, e.descripcion.slice(0, 900), nota]);
    nuevas++;
  }
}

const r = await unaFila(
  `select count(*) as total, count(*) filter (where duracion_confirmada) as con_duracion,
          count(distinct obra) as obras, count(distinct fecha) as dias
     from eventos.funciones where festival_id = $1`, [festival.id]);

console.log(`\n${nuevas} nuevas, ${actualizadas} actualizadas.`);
console.log(`Total: ${r.total} funciones en ${r.dias} días, ${r.obras} títulos distintos, ${r.con_duracion} con duración real.`);

await poolPg().end();
