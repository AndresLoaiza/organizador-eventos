import { sql, unaFila, poolPg } from './_cliente.mjs';
import { PROGRAMACION } from './datos-22-fiesta.mjs';
import { tituloNormalizado } from '../lib/nombres.mjs';

// Carga la programación completa del festival como funciones NO agendadas.
// Las que ya están en la agenda se actualizan sin tocar su marca de agendada:
// el volante aporta compañía, precio y nota, no decide a qué va Andrés.

const festival = await unaFila(
  `select id from eventos.festivales where slug = 'fiesta-artes-escenicas-22-2026'`);
if (!festival) { console.error('Falta el festival. Corre npm run seed.'); process.exit(1); }

const salas = await sql('select id, slug from eventos.salas');
const salaId = Object.fromEntries(salas.map(s => [s.slug, s.id]));

let nuevas = 0, actualizadas = 0, sinSala = [];

// El motor agrupa repeticiones comparando el título exacto. Si el volante
// escribe "Ixaquene" y la agenda "IXAQUENE", quedan como dos obras y la app
// dice que se pierde algo que sí se podía ver otro día. Antes de insertar se
// busca un título que solo difiera en mayúsculas o tildes y se reutiliza el
// que ya está en la base.
const existentes = await sql(
  'select distinct obra from eventos.funciones where festival_id = $1', [festival.id]);
const porNormalizado = new Map(existentes.map(x => [tituloNormalizado(x.obra), x.obra]));
const unificados = [];

for (const f of PROGRAMACION) {
  if (!salaId[f.sala]) { sinSala.push(f.sala); continue; }

  const clave = tituloNormalizado(f.obra);
  const yaExiste = porNormalizado.get(clave);
  if (yaExiste && yaExiste !== f.obra) {
    unificados.push(`${f.obra} -> ${yaExiste}`);
    f.obra = yaExiste;
  } else {
    porNormalizado.set(clave, f.obra);
  }
  const previa = await unaFila(
    `select id, agendada from eventos.funciones
      where festival_id = $1 and fecha = $2 and hora_min = $3 and obra = $4`,
    [festival.id, f.fecha, f.hora, f.obra]);

  if (previa) {
    await sql(
      `update eventos.funciones
          set sala_id = $2, duracion_min = $3, compania = coalesce($4, compania),
              precio_pleno = $5, precio_dcto = $6,
              nota_boleteria = coalesce($7, nota_boleteria),
              fuente_horario = $8
        where id = $1`,
      [previa.id, salaId[f.sala], f.dur, f.cia, f.pleno, f.dcto, f.nota, f.fuente ?? 'volante']);
    actualizadas++;
  } else {
    await sql(
      `insert into eventos.funciones
         (festival_id, sala_id, fecha, hora_min, duracion_min, obra, compania,
          precio_pleno, precio_dcto, nota_boleteria, acompanantes, agendada, fuente_horario)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,false,$11)`,
      [festival.id, salaId[f.sala], f.fecha, f.hora, f.dur, f.obra, f.cia,
       f.pleno, f.dcto, f.nota, f.fuente ?? 'volante']);
    nuevas++;
  }
}

const r = await unaFila(
  `select count(*) as total, count(*) filter (where agendada) as agendadas,
          count(distinct obra) as obras
     from eventos.funciones where festival_id = $1`, [festival.id]);

console.log(`${nuevas} funciones nuevas, ${actualizadas} actualizadas.`);
if (sinSala.length) console.log(`Sin sala conocida: ${[...new Set(sinSala)].join(', ')}`);
if (unificados.length) {
  console.log(`Títulos unificados para no partir la obra en dos:`);
  for (const u of [...new Set(unificados)]) console.log(`  ${u}`);
}
console.log(`Total: ${r.total} funciones, ${r.obras} obras distintas, ${r.agendadas} en tu agenda.`);

const repes = await sql(
  `select obra, count(*) as veces, string_agg(to_char(fecha,'DD Mon'), ', ' order by fecha) as fechas
     from eventos.funciones where festival_id = $1
    group by obra having count(*) > 1 order by count(*) desc, obra`, [festival.id]);
console.log(`\nObras que se repiten (${repes.length}):`);
for (const x of repes) console.log(`  ${x.veces}×  ${x.obra}  —  ${x.fechas}`);

await poolPg().end();
