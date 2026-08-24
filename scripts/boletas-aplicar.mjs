import { readFile } from 'node:fs/promises';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { vincular } from '../lib/alarmas.mjs';

// Escribe a la base lo que la sesión de Claude Code extrajo. Nunca toca el
// archivo original: solo columnas.

let extraido;
try {
  extraido = JSON.parse(await readFile('trabajo/extraido.json', 'utf8'));
} catch (e) {
  console.error(`No pude leer trabajo/extraido.json: ${e.message}`);
  console.error('Corre primero npm run boletas:pendientes.');
  process.exit(1);
}

const funciones = (await sql(
  'select id, to_char(fecha, 'YYYY-MM-DD') as fecha, hora_min, obra, festival_id from eventos.funciones'));

let aplicadas = 0, sinVincular = 0, ambiguas = 0;

for (const b of extraido) {
  if (!b.id) { console.warn('  entrada sin id, se salta'); continue; }

  const cambios = {
    categoria: b.categoria ?? null,
    valor_ticket: b.valor_ticket ?? null,
    valor_servicio: b.valor_servicio ?? 0,
    codigo: b.codigo ?? null,
    pulep: b.pulep ?? null,
    titular: b.titular ?? null,
    operador: b.operador ?? null,
    localidad: b.localidad ?? null,
    campos_dudosos: b.campos_dudosos ?? [],
    extraccion_json: b,
    // Con campos dudosos no se declara confirmada: un valor pagado equivocado
    // contamina el total del festival en silencio.
    extraccion_estado: (b.campos_dudosos?.length ?? 0) > 0 ? 'extraida' : 'confirmada',
  };

  const actual = await unaFila('select funcion_id from eventos.boletas where id = $1', [b.id]);

  if (!actual?.funcion_id && b.obra_texto) {
    const r = vincular(b, funciones);
    if (r.funcion) {
      cambios.funcion_id = r.funcion.id;
      cambios.festival_id = r.funcion.festival_id;
      if (r.confianza !== 'alta') {
        cambios.campos_dudosos = [...cambios.campos_dudosos, 'funcion_id'];
        cambios.extraccion_estado = 'extraida';
      }
    } else if (r.confianza === 'ambigua') {
      ambiguas++;
      console.warn(`  ${b.obra_texto}: varias funciones posibles, queda sin vincular`);
    } else {
      sinVincular++;
      console.warn(`  ${b.obra_texto}: no coincide con ninguna función cargada`);
    }
  }

  const columnas = Object.keys(cambios);
  const asignaciones = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const valores = columnas.map(c =>
    c === 'extraccion_json' ? JSON.stringify(cambios[c]) : cambios[c]);
  try {
    await sql(`update eventos.boletas set ${asignaciones} where id = $1`, [b.id, ...valores]);
    aplicadas++;
  } catch (e) {
    console.error(`  ${b.id}: ${e.message}`);
  }
}

console.log(`\n${aplicadas} boletas actualizadas.`);
if (sinVincular) console.log(`${sinVincular} sin función: la app te va a preguntar a cuál pertenecen.`);
if (ambiguas) console.log(`${ambiguas} ambiguas: hay doble función y la hora no alcanzó para desempatar.`);
await poolPg().end();
