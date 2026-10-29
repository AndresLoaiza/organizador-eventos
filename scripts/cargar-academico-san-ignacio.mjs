import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { FESTIVAL } from './datos-san-ignacio.mjs';

// Programación académica del Festival San Ignacio 2026.
// Fuente: comfama.com/festivales/festival-teatro-san-ignacio/programacion-academica/
// Todo es de entrada libre con inscripción previa: precio 0 y url_compra apunta a la inscripción.
// Solo inserta o actualiza; nunca borra.

const SALAS = {
  'fsi-bodega':      ['Bodega Comfama', 'fsi-distrito', 'Distrito San Ignacio'],
  'fsi-pascasia':    ['La Pascasia', 'fsi-claustro', 'La Pascasia, San Ignacio'],
  'fsi-claustro-sala': ['Claustro Comfama', 'fsi-claustro', 'Claustro Comfama San Ignacio'],
};
for (const [slug, [nombre, zona, direccion]] of Object.entries(SALAS)) {
  await sql(
    `insert into eventos.salas (slug, nombre, zona, ciudad, direccion) values ($1,$2,$3,'Medellín',$4)
     on conflict (slug) do update set nombre = excluded.nombre, zona = excluded.zona, direccion = excluded.direccion`,
    [slug, nombre, zona, direccion]);
}
const salaId = Object.fromEntries((await sql('select id, slug from eventos.salas')).map(s => [s.slug, s.id]));
const festival = await unaFila('select id from eventos.festivales where slug = $1', [FESTIVAL.slug]);

const CORTO = 'https://bit.ly/tallercortocinesis', DUBATTI = 'https://bit.ly/encuentrosdubatti', MOLINA = 'https://bit.ly/tallerjaviermolina';
const T1 = 'Taller: Suelo, cuerpo y aire (piso móvil, Cortocinesis)';
const T2 = 'Escuela de espectadores con Jorge Dubatti';
const T3 = 'Taller «De la palabra al cuerpo» con Javier Molina';
const T4 = 'Conversatorio: ¿Para quiénes creamos nuestras obras de teatro?';
// [obra, fecha, hora_min, duración, duración confirmada, sala, inscripción, nota]
const ACT = [
  [T1, '2026-11-04', 540, 180, true, 'fsi-bodega', CORTO, 'Cortocinesis (Colombia)'],
  [T1, '2026-11-05', 540, 180, true, 'fsi-bodega', CORTO, 'Cortocinesis (Colombia)'],
  [T2, '2026-11-05', 1020, 90, true, 'fsi-pascasia', DUBATTI, 'Sesión 1. Invitado: Fabio Rubiano (Teatro Petra, El Pabellón del oído)'],
  [T2, '2026-11-07', 900, 60, true, 'fsi-capilla', DUBATTI, 'Sesión 2. Invitados: Eduardo Moreira (Grupo Galpão) y Sori (Delirium Teatro)'],
  [T3, '2026-11-05', 540, 240, true, 'fsi-claustro-sala', MOLINA, 'Dirigido a actores y directores'],
  [T3, '2026-11-06', 540, 240, true, 'fsi-claustro-sala', MOLINA, 'Dirigido a actores y directores'],
  [T3, '2026-11-07', 540, 240, true, 'fsi-claustro-sala', MOLINA, 'Dirigido a actores y directores'],
  [T4, '2026-11-06', 1020, 90, false, 'fsi-pascasia', DUBATTI, 'Con Jorge Dubatti, Marleny Carvajal y Maibell Ciodaro; modera Víctor López'],
];

let n = 0;
for (const [obra, fecha, hora, dur, conf, sala, url, nota] of ACT) {
  const ya = await unaFila(
    'select id from eventos.funciones where festival_id=$1 and fecha=$2 and hora_min=$3 and obra=$4',
    [festival.id, fecha, hora, obra]);
  if (ya) {
    await sql(`update eventos.funciones set sala_id=$2, duracion_min=$3, duracion_confirmada=$4, compania=$5,
               nota_boleteria='Entrada libre con inscripción previa', url_compra=$6, precio_pleno=0, tipos=array['Académico'] where id=$1`,
      [ya.id, salaId[sala], dur, conf, nota, url]);
  } else {
    await sql(`insert into eventos.funciones (festival_id, sala_id, fecha, hora_min, duracion_min, duracion_confirmada, obra,
                 compania, precio_pleno, precio_dcto, nota_boleteria, acompanantes, agendada, fuente_horario, url_compra, tipos)
               values ($1,$2,$3,$4,$5,$6,$7,$8,0,null,'Entrada libre con inscripción previa',0,false,'sitio-web',$9,array['Académico'])`,
      [festival.id, salaId[sala], fecha, hora, dur, conf, obra, nota, url]);
    n++;
  }
}
console.log(`${n} nuevas de ${ACT.length}.`);
await poolPg().end();
