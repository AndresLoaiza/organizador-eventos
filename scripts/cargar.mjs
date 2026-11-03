import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { conectar } from './_pg.mjs';
import { validar } from '../lib/formato.mjs';
import { planificar, cambiosCatalogo, COLUMNAS } from '../lib/carga.mjs';

// festivales/{slug}.json -> base, en una sola transacción.
//
//   npm run cargar -- <slug> --seco   imprime el diff y no escribe
//   npm run cargar -- <slug>          escribe
//
// Lo del usuario (agendada, interés, acompañantes, boletas, bitácora) no se
// toca. Una función que la fuente ya no trae se borra solo si no tiene nada del
// usuario; si tiene, queda un aviso y la función sigue.

const slug = process.argv.slice(2).find(a => !a.startsWith('--'));
const SECO = process.argv.includes('--seco');
if (!slug) { console.error('Uso: npm run cargar -- <slug> [--seco]'); process.exit(1); }

const json = JSON.parse(await readFile(new URL(`../festivales/${slug}.json`, import.meta.url), 'utf8'));
const errores = validar(json);
if (errores.length) {
  console.error(`festivales/${slug}.json no es válido:`);
  for (const e of errores) console.error('  ' + e);
  process.exit(1);
}

const c = await conectar();
const q = async (t, p) => (await c.query(t, p)).rows;

try {
  await c.query('begin');

  const fe = json.festival;
  const cambiosFestival = await q(
    `select 1 from eventos.festivales where slug = $1 and nombre = $2 and ciudad = $3
       and fecha_inicio = $4 and fecha_fin = $5`,
    [fe.slug, fe.nombre, fe.ciudad, fe.fecha_inicio, fe.fecha_fin]);
  const [{ id: festivalId }] = await q(
    `insert into eventos.festivales (slug, nombre, ciudad, fecha_inicio, fecha_fin)
     values ($1,$2,$3,$4,$5)
     on conflict (slug) do update set nombre = excluded.nombre, ciudad = excluded.ciudad,
       fecha_inicio = excluded.fecha_inicio, fecha_fin = excluded.fecha_fin
     returning id`,
    [fe.slug, fe.nombre, fe.ciudad, fe.fecha_inicio, fe.fecha_fin]);

  const catalogo = cambiosCatalogo(
    json,
    await q(`select slug, nombre, direccion, telefono, zona from eventos.salas where slug = any($1)`,
      [json.salas.map(s => s.slug)]),
    await q(`select zona_a, zona_b, minutos from eventos.traslados where ciudad = $1`, [fe.ciudad]));

  for (const s of json.salas) {
    await q(
      `insert into eventos.salas (slug, nombre, direccion, telefono, zona, ciudad)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (slug) do update set nombre = excluded.nombre, direccion = excluded.direccion,
         telefono = excluded.telefono, zona = excluded.zona`,
      [s.slug, s.nombre, s.direccion, s.telefono, s.zona, fe.ciudad]);
  }
  for (const t of json.traslados) {
    await q(
      `insert into eventos.traslados (ciudad, zona_a, zona_b, minutos) values ($1,$2,$3,$4)
       on conflict (ciudad, zona_a, zona_b) do update set minutos = excluded.minutos`,
      [fe.ciudad, t.zona_a, t.zona_b, t.minutos]);
  }

  const salaId = Object.fromEntries(
    (await q(`select id, slug from eventos.salas where slug = any($1)`, [json.salas.map(s => s.slug)]))
      .map(s => [s.slug, s.id]));

  const actuales = await q(
    `select f.id, ${COLUMNAS.filter(k => k !== 'fecha').map(k => 'f.' + k).join(', ')},
            to_char(f.fecha, 'YYYY-MM-DD') as fecha, s.slug as sala_slug
       from eventos.funciones f left join eventos.salas s on s.id = f.sala_id
      where f.festival_id = $1`, [festivalId]);

  const conUsuario = new Set((await q(
    `select f.id from eventos.funciones f
      where f.festival_id = $1 and (f.agendada or f.interes is not null
        or exists (select 1 from eventos.boletas b where b.funcion_id = f.id)
        or exists (select 1 from eventos.bitacora x where x.funcion_id = f.id)
        or exists (select 1 from eventos.estados_compra e where e.funcion_id = f.id))`,
    [festivalId])).map(r => r.id));

  const plan = planificar(json, actuales, salaId, conUsuario);

  console.log(`\n${slug}${SECO ? ' (en seco)' : ''}`);
  if (!cambiosFestival.length) console.log('  festival: cambia nombre, ciudad o fechas');
  for (const x of catalogo) console.log('  ' + x);
  console.log(`  funciones: ${plan.insertar.length} nuevas, ${plan.actualizar.length} cambian, ` +
    `${plan.retirar.length} se borran, ${plan.avisar.length} retiradas con datos tuyos (aviso), ` +
    `${plan.dudosas.length} dudosas`);
  const porColumna = {};
  for (const a of plan.actualizar) for (const k of Object.keys(a.cambios)) porColumna[k] = (porColumna[k] ?? 0) + 1;
  for (const [k, n] of Object.entries(porColumna)) console.log(`    ${k}: ${n}`);
  for (const a of plan.actualizar.slice(0, 5)) console.log(`    ej. ${a.llave}: ${JSON.stringify(a.cambios)}`);
  for (const r of [...plan.retirar, ...plan.avisar]) console.log(`    retirada: ${r.llave}`);
  for (const d of plan.dudosas) {
    console.log(`    DUDOSA: ${d.previa.llave} (tiene datos tuyos) parece ser la nueva ` +
      `${d.nueva.fecha} ${d.nueva.hora_min} min, sala ${d.nueva.sala_id}`);
  }

  if (SECO) { await c.query('rollback'); console.log('  Nada escrito.'); }
  else if (plan.dudosas.length) {
    // Insertar duplicaría la obra y dejaría tu agenda en la copia vieja.
    throw new Error(`${plan.dudosas.length} funciones dudosas: hay que decidir a mano antes de cargar`);
  }
  else {
    for (const n of plan.insertar) {
      const cols = ['festival_id', ...COLUMNAS, 'acompanantes', 'agendada'];
      const vals = [festivalId, ...COLUMNAS.map(k => n[k]), 0, false];
      await q(`insert into eventos.funciones (${cols.join(', ')})
               values (${cols.map((_, i) => '$' + (i + 1)).join(', ')})`, vals);
    }
    for (const a of plan.actualizar) {
      const ks = Object.keys(a.cambios);
      await q(`update eventos.funciones set ${ks.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`,
        [a.id, ...ks.map(k => a.cambios[k].despues)]);
    }
    for (const r of plan.retirar) await q('delete from eventos.funciones where id = $1', [r.id]);
    for (const r of plan.avisar) {
      await q(`insert into eventos.avisos (funcion_id, tipo, severidad, mensaje)
               values ($1, 'retirada_de_fuente', 'alto', $2)`,
        [r.id, `La fuente ya no trae esta función (${r.llave}) y tiene datos tuyos: no se borró.`]);
    }
    await c.query('commit');
    await c.query(`notify pgrst, 'reload schema'`);
    console.log('  Escrito.');
  }
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error(`Falló la carga: ${e.message}`);
  process.exitCode = 1;
} finally {
  await c.end();
}
