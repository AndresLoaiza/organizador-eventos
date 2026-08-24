import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { sql, almacen, poolPg, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';

// Baja a trabajo/ los originales que todavía no se han extraído, para que una
// sesión de Claude Code los lea y escriba trabajo/extraido.json.

const DIR = 'trabajo';
await mkdir(DIR, { recursive: true });

const storage = almacen();
if (!storage) { console.error(FALTA_LLAVE_STORAGE); process.exit(1); }

const pendientes = await sql(
  `select id, storage_key, mime, funcion_id from eventos.boletas
    where extraccion_estado = 'pendiente'`);

if (!pendientes.length) {
  console.log('No hay boletas pendientes de extracción.');
  await poolPg().end();
  process.exit(0);
}

const manifiesto = [];
for (const b of pendientes) {
  const { data, error: e } = await storage.storage.from(BUCKET).download(b.storage_key);
  if (e) { console.warn(`  no se pudo bajar ${b.storage_key}: ${e.message}`); continue; }
  const nombre = `${b.id}__${basename(b.storage_key)}`;
  await writeFile(join(DIR, nombre), Buffer.from(await data.arrayBuffer()));
  manifiesto.push({ id: b.id, archivo: nombre, ya_vinculada: Boolean(b.funcion_id) });
  console.log(`  ${nombre}`);
}

await writeFile(join(DIR, 'pendientes.json'), JSON.stringify(manifiesto, null, 2));
await poolPg().end();

console.log(`\n${manifiesto.length} archivos en trabajo/.

Ahora, en la sesión de Claude Code:
  1. Lee cada archivo de trabajo/ (los PDF con: python -m markitdown archivo.pdf).
  2. Escribe trabajo/extraido.json con un objeto por boleta:

  [{ "id": "<id de pendientes.json>",
     "categoria": "COMFAMA TARIFA A",
     "valor_ticket": 10900, "valor_servicio": 2000,
     "codigo": "abc123", "pulep": "XYZ999",
     "titular": "...", "operador": "WS Ticketing SAS",
     "obra_texto": "HABITAR", "fecha_texto": "2026-08-28", "hora_boleta": 1200,
     "campos_dudosos": ["valor_servicio"] }]

  3. npm run boletas:aplicar`);
