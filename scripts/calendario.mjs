import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { panorama } from '../lib/datos.mjs';
import { planCalendario } from '../lib/calendario.mjs';
import { sql, poolPg } from './_cliente.mjs';

// La mitad local de la sincronización con Google Calendar. La otra mitad la
// hace Claude en sesión con el MCP, que no existe fuera de ella:
//
//   1. Claude lista los eventos del calendario «Festivales» y del principal en
//      las fechas del festival y los guarda en un JSON: [{ id, description }].
//   2. npm run calendario -- plan <slug> <eventos.json>
//        imprime qué crear, actualizar y borrar (solo eventos con [oe:…]).
//   3. Claude lo aplica con el MCP.
//   4. npm run calendario -- guardar <funcion_id> <event_id>
//        por cada evento creado o adoptado, para no duplicarlo la próxima vez.

const [modo, a, b] = process.argv.slice(2);

if (modo === 'plan') {
  if (!a || !b) { console.error('Uso: npm run calendario -- plan <slug> <eventos.json>'); process.exit(1); }
  const p = await panorama(a);
  if (!p) { console.error(`No existe el festival ${a}.`); process.exit(1); }
  const eventos = JSON.parse(await readFile(b, 'utf8'));
  const plan = planCalendario(p.funciones, eventos, p.hoy);
  console.log(JSON.stringify({
    festival: p.festival.slug, hoy: p.hoy,
    ...plan,
  }, null, 2));
} else if (modo === 'guardar') {
  if (!a || !b) { console.error('Uso: npm run calendario -- guardar <funcion_id> <event_id>'); process.exit(1); }
  const filas = await sql(
    'update eventos.funciones set calendar_event_id = $2 where id = $1 returning obra', [a, b]);
  if (!filas.length) { console.error(`No existe la función ${a}.`); process.exitCode = 1; }
  else console.log(`${filas[0].obra}: evento ${b}`);
} else {
  console.error('Uso: npm run calendario -- plan <slug> <eventos.json> | guardar <funcion_id> <event_id>');
  process.exitCode = 1;
}
await poolPg().end();
