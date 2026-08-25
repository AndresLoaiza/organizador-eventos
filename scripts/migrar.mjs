import { readFile, readdir } from 'node:fs/promises';
import { conectar } from './_pg.mjs';

// Aplica todas las migraciones de supabase/ en orden. Cada archivo está escrito
// para poder correrse dos veces sin romper nada (create if not exists,
// add column if not exists, do $$ ... $$).

const dir = new URL('../supabase/', import.meta.url);
const archivos = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
const cliente = await conectar();

try {
  for (const nombre of archivos) {
    const texto = await readFile(new URL(nombre, dir), 'utf8');
    await cliente.query('begin');
    await cliente.query(texto);
    await cliente.query('commit');
    console.log(`  ${nombre}`);
  }
  console.log('Migraciones aplicadas.');

  const { rows } = await cliente.query(`
    select table_name, (select count(*) from information_schema.columns c
      where c.table_schema = 'eventos' and c.table_name = t.table_name) as columnas
    from information_schema.tables t
    where table_schema = 'eventos' order by table_name`);
  for (const r of rows) console.log(`  ${r.table_name} (${r.columnas} columnas)`);
} catch (e) {
  await cliente.query('rollback').catch(() => {});
  console.error(`Falló la migración: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
