import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { almacen, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';
import { hashContenido } from '../lib/hash.mjs';
import { METODOS } from '../lib/formato.mjs';

// Archiva el markdown de una fuente en el bucket y lo anota en el JSON.
//
//   fuentes/{festival}/{AAAA-MM-DD}_{hash8}.md
//
// Nunca sobrescribe: el hash va en la clave, así que la misma fuente bajada dos
// veces da la misma clave y la segunda subida se reconoce como repetida.

const [slug, archivo, metodo, url, bajada] = process.argv.slice(2);
if (!slug || !archivo || !METODOS.includes(metodo) || !/^\d{4}-\d{2}-\d{2}$/.test(bajada ?? '')) {
  console.error(`Uso: npm run fuente -- <slug> <archivo.md> <${METODOS.join('|')}> <url> <AAAA-MM-DD>`);
  process.exit(1);
}
const storage = almacen();
if (!storage) { console.error(FALTA_LLAVE_STORAGE); process.exit(1); }

const cuerpo = await readFile(archivo, 'utf8');
const texto = [
  '---', `festival: ${slug}`, `url: ${url}`, `bajada: ${bajada}`, `metodo: ${metodo}`, '---', '', cuerpo,
].join('\n');
const bytes = Buffer.from(texto, 'utf8');
const key = `fuentes/${slug}/${bajada}_${hashContenido(bytes).slice(0, 8)}.md`;

const { error } = await storage.storage.from(BUCKET)
  .upload(key, bytes, { contentType: 'text/markdown; charset=utf-8', upsert: false });
if (error && !/exists|Duplicate/i.test(error.message)) { console.error(error.message); process.exit(1); }
console.log(error ? `Ya estaba: ${key}` : `Subida: ${key} (${bytes.length} bytes)`);

const ruta = new URL(`../festivales/${slug}.json`, import.meta.url);
const json = JSON.parse(await readFile(ruta, 'utf8'));
if (!json.fuentes.some(f => f.key === key)) {
  json.fuentes.push({ key, url, bajada, metodo });
  await writeFile(ruta, JSON.stringify(json, null, 2) + '\n');
  console.log(`Anotada en festivales/${slug}.json`);
}
