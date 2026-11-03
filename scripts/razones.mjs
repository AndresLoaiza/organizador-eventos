import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { validarRazones, canonicas } from '../lib/razones.mjs';

// festivales/<slug>.razones.json -> eventos.razones. Se corre después de cargar
// el festival: las razones se escriben contra las obras ya cargadas.

const slug = process.argv[2];
if (!slug) { console.error('Uso: npm run razones -- <slug>'); process.exit(1); }

const lista = JSON.parse(await readFile(new URL(`../festivales/${slug}.razones.json`, import.meta.url), 'utf8'));
const festival = await unaFila('select id from eventos.festivales where slug = $1', [slug]);
if (!festival) { console.error(`No existe el festival ${slug}. Cárgalo primero con npm run cargar.`); process.exit(1); }

const obras = (await sql('select distinct obra from eventos.funciones where festival_id = $1', [festival.id])).map(r => r.obra);
const errores = validarRazones(lista, obras);
if (errores.length) {
  console.error(`festivales/${slug}.razones.json no es válido:`);
  for (const e of errores) console.error('  ' + e);
  process.exit(1);
}

for (const r of canonicas(lista, obras)) {
  await sql(
    `insert into eventos.razones (festival_id, obra, texto) values ($1, $2, $3)
     on conflict (festival_id, obra) do update set texto = excluded.texto, creado = now()`,
    [festival.id, r.obra, r.texto]);
}
console.log(`${lista.length} razones escritas para ${slug}.`);
await poolPg().end();
