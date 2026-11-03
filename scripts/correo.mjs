import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { leerCorreo, planBoletas } from '../lib/correo.mjs';
import { sql, unaFila, poolPg } from './_cliente.mjs';

// La mitad local de las boletas desde Gmail. La otra mitad la hace Claude en
// sesión con el MCP (solo lectura): busca los correos de compra, y guarda en un
// JSON [{ id, remitente, fecha, asunto, texto }] fuera de git (trabajo/), porque
// trae enlaces personales a cada entrada.
//
//   npm run correo -- plan <slug> <correos.json>      qué se aplica, qué ya está, qué se pregunta
//   npm run correo -- aplicar <slug> <correos.json>   escribe solo las seguras

const [modo, slug, archivo] = process.argv.slice(2);
if (!['plan', 'aplicar'].includes(modo) || !slug || !archivo) {
  console.error('Uso: npm run correo -- plan|aplicar <slug> <correos.json>');
  process.exit(1);
}

const correos = JSON.parse(await readFile(archivo, 'utf8'));
const festival = await unaFila('select id from eventos.festivales where slug = $1', [slug]);
if (!festival) { console.error(`No existe el festival ${slug}.`); process.exit(1); }

const funciones = await sql(
  `select id, obra, to_char(fecha, 'YYYY-MM-DD') as fecha, hora_min, festival_id, agendada
     from eventos.funciones where festival_id = $1`, [festival.id]);
const existentes = await sql(
  `select b.url_entrada from eventos.boletas b
     join eventos.funciones f on f.id = b.funcion_id where f.festival_id = $1`, [festival.id]);

const entradas = correos.flatMap(leerCorreo);
const plan = planBoletas(entradas, funciones, existentes);
const obra = id => funciones.find(f => f.id === id)?.obra ?? id;

console.log(`${correos.length} correos, ${entradas.length} entradas.`);
console.log(`  ${plan.nuevas.length} nuevas, ${plan.ya.length} ya cargadas, ${plan.dudosas.length} dudosas, ${plan.ignoradas.length} de fuera del festival`);
for (const n of plan.nuevas) console.log(`  + ${n.fecha} ${obra(n.funcion_id)} · ${n.categoria} · ${n.operador} (por ${n.por})`);
for (const d of plan.dudosas) console.log(`  ? ${d.fecha} «${d.obra}»: ${d.motivo} (${d.candidatas.map(obra).join(', ')})`);
for (const i of plan.ignoradas) console.log(`  · ${i.fecha} «${i.obra}» no está en ${slug}`);

if (modo === 'aplicar') {
  for (const n of plan.nuevas) {
    await sql(
      `insert into eventos.boletas (funcion_id, festival_id, categoria, operador, url_entrada)
       values ($1, $2, $3, $4, $5)`,
      [n.funcion_id, n.festival_id, n.categoria, n.operador, n.url]);
  }
  console.log(`Escritas ${plan.nuevas.length}. Las dudosas no se tocan: se deciden a mano.`);
}
await poolPg().end();
