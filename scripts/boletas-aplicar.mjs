import { readFile } from 'node:fs/promises';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { vincular } from '../lib/alarmas.mjs';

// Escribe a la base lo que la sesión de Claude Code extrajo. Nunca toca el
// archivo original: solo filas.
//
// Cada archivo se reemplaza por las boletas que de verdad trae. Si el PDF tenía
// dos entradas y solo había una fila provisional, aquí aparecen las dos.

let extraido;
try {
  extraido = JSON.parse(await readFile('trabajo/extraido.json', 'utf8'));
} catch (e) {
  console.error(`No pude leer trabajo/extraido.json: ${e.message}`);
  console.error('Corre primero npm run boletas:pendientes.');
  process.exit(1);
}

const funciones = await sql(
  `select id, to_char(fecha, 'YYYY-MM-DD') as fecha, hora_min, obra, festival_id
     from eventos.funciones`);

let archivos = 0, filas = 0, sinVincular = 0, ambiguas = 0;

for (const a of extraido) {
  if (!a.archivo_id || !Array.isArray(a.boletas) || !a.boletas.length) {
    console.warn('  entrada sin archivo_id o sin boletas, se salta');
    continue;
  }

  // ¿A qué función pertenecen? Se decide una vez por archivo: todas las páginas
  // de un mismo PDF son de la misma función.
  const previa = await unaFila(
    'select funcion_id, festival_id from eventos.boletas where archivo_id = $1 limit 1',
    [a.archivo_id]);
  let funcionId = previa?.funcion_id ?? null;
  let festivalId = previa?.festival_id ?? null;
  const dudosos = [...(a.campos_dudosos ?? [])];

  if (!funcionId && a.obra_texto) {
    const r = vincular(a, funciones);
    if (r.funcion) {
      funcionId = r.funcion.id;
      festivalId = r.funcion.festival_id;
      if (r.confianza !== 'alta') dudosos.push('funcion_id');
    } else if (r.confianza === 'ambigua') {
      ambiguas++;
      console.warn(`  ${a.obra_texto}: varias funciones posibles, queda sin vincular`);
    } else {
      sinVincular++;
      console.warn(`  ${a.obra_texto}: no coincide con ninguna función cargada`);
    }
  }

  // Un valor pagado equivocado contamina el total del festival en silencio, así
  // que con campos dudosos el archivo no se declara confirmado.
  const estado = dudosos.length ? 'extraida' : 'confirmada';

  try {
    await sql('delete from eventos.boletas where archivo_id = $1', [a.archivo_id]);
    for (const [i, b] of a.boletas.entries()) {
      await sql(
        `insert into eventos.boletas
           (funcion_id, festival_id, archivo_id, pagina, titular, categoria,
            valor_ticket, valor_servicio, localidad, codigo, pulep, operador, campos_dudosos)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [funcionId, festivalId, a.archivo_id, b.pagina ?? i + 1,
         b.titular ?? null, b.categoria ?? null, b.valor_ticket ?? null,
         b.valor_servicio ?? 0, b.localidad ?? null, b.codigo ?? null,
         b.pulep ?? null, b.operador ?? null, dudosos]);
      filas++;
    }
    await sql(
      `update eventos.archivos
          set extraccion_estado = $2, extraccion_json = $3, festival_id = coalesce(festival_id, $4)
        where id = $1`,
      [a.archivo_id, estado, JSON.stringify(a), festivalId]);
    archivos++;
  } catch (e) {
    console.error(`  ${a.archivo_id}: ${e.message}`);
  }
}

console.log(`\n${archivos} archivos procesados, ${filas} boletas escritas.`);
if (sinVincular) console.log(`${sinVincular} sin función: la app te va a preguntar a cuál pertenecen.`);
if (ambiguas) console.log(`${ambiguas} ambiguos: hay doble función y la hora no alcanzó para desempatar.`);
await poolPg().end();
