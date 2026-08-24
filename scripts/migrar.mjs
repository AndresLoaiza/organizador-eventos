import { readFile } from 'node:fs/promises';
import { conectar } from './_pg.mjs';

// Aplica supabase/001_schema_eventos.sql. Todo el archivo está escrito para
// poder correrse dos veces sin romper nada (create if not exists, do $$ ... $$).

const sql = await readFile(new URL('../supabase/001_schema_eventos.sql', import.meta.url), 'utf8');
const cliente = await conectar();

try {
  await cliente.query('begin');
  await cliente.query(sql);
  await cliente.query('commit');
  console.log('Schema eventos aplicado.');

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
