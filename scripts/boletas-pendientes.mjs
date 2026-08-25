import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { sql, almacen, poolPg, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';

// Baja a trabajo/ los archivos que todavía no se han extraído, para que una
// sesión de Claude Code los lea y escriba trabajo/extraido.json.
//
// La unidad es el ARCHIVO, no la boleta: un PDF puede traer dos entradas y solo
// se sabe cuántas después de leerlo.

const DIR = 'trabajo';
await mkdir(DIR, { recursive: true });

const storage = almacen();
if (!storage) { console.error(FALTA_LLAVE_STORAGE); process.exit(1); }

const pendientes = await sql(
  `select a.id, a.storage_key, a.mime,
          (select count(*) from eventos.boletas b where b.archivo_id = a.id) as boletas
     from eventos.archivos a
    where a.extraccion_estado = 'pendiente'`);

if (!pendientes.length) {
  console.log('No hay archivos pendientes de extracción.');
  await poolPg().end();
  process.exit(0);
}

const manifiesto = [];
for (const a of pendientes) {
  const { data, error } = await storage.storage.from(BUCKET).download(a.storage_key);
  if (error) { console.warn(`  no se pudo bajar ${a.storage_key}: ${error.message}`); continue; }
  const nombre = `${a.id}__${basename(a.storage_key)}`;
  await writeFile(join(DIR, nombre), Buffer.from(await data.arrayBuffer()));
  manifiesto.push({ archivo_id: a.id, archivo: nombre, boletas_registradas: Number(a.boletas) });
  console.log(`  ${nombre}`);
}

await writeFile(join(DIR, 'pendientes.json'), JSON.stringify(manifiesto, null, 2));
await poolPg().end();

console.log(`\n${manifiesto.length} archivos en trabajo/.

Ahora, en la sesión de Claude Code:
  1. Lee cada archivo (los PDF con: python -m markitdown archivo.pdf).
  2. CUENTA cuántas boletas trae. Un mismo PDF puede tener varias, una por
     página: busca cuántas veces aparece el valor o el código del ticket.
  3. Escribe trabajo/extraido.json, un objeto por ARCHIVO con su lista de boletas:

  [{ "archivo_id": "<el de pendientes.json>",
     "obra_texto": "HABITAR", "fecha_texto": "2026-08-28", "hora_boleta": 1200,
     "boletas": [
       { "pagina": 1, "categoria": "COMFAMA TARIFA A", "valor_ticket": 10900,
         "valor_servicio": 2000, "codigo": "r2l5vtik3j3crp", "pulep": "OEU921",
         "titular": "David Andrés Loaiza Marín" },
       { "pagina": 2, "categoria": "COMFAMA TARIFA A", "valor_ticket": 10900,
         "valor_servicio": 2000, "codigo": "fkn65z53yby1xz", "pulep": "OEU921",
         "titular": "David Andrés Loaiza Marín" }
     ],
     "campos_dudosos": [] }]

  4. npm run boletas:aplicar`);
