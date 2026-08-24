import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { almacen, BUCKET } from './_cliente.mjs';

// Red de seguridad manual. El baúl vive solo en Supabase por decisión explícita;
// esto lo baja entero a disco cuando se quiera.

const DESTINO = process.env.DIR_BACKUP ?? 'baul-backup';

async function recorrer(prefijo = 'baul') {
  const { data, error } = await almacen.storage.from(BUCKET)
    .list(prefijo, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`${prefijo}: ${error.message}`);

  let n = 0;
  for (const item of data ?? []) {
    const ruta = `${prefijo}/${item.name}`;
    if (item.id === null) { n += await recorrer(ruta); continue; }
    const { data: blob, error: e } = await almacen.storage.from(BUCKET).download(ruta);
    if (e) { console.warn(`  ${ruta}: ${e.message}`); continue; }
    const local = join(DESTINO, ruta);
    await mkdir(dirname(local), { recursive: true });
    await writeFile(local, Buffer.from(await blob.arrayBuffer()));
    console.log(`  ${ruta}`);
    n++;
  }
  return n;
}

const total = await recorrer();
console.log(`\n${total} archivos en ${DESTINO}/.`);
