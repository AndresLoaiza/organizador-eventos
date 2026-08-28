import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { sql, poolPg } from '../scripts/_cliente.mjs';
import { construirBloque, insertarBloque, tituloSeccion } from '../lib/obsidian.mjs';

// Puente Supabase -> vault de Obsidian. Corre en el PC porque el vault vive en
// D:\ y no es repo git: ningún proceso remoto puede escribirlo.
//
// Regla del vault, no negociable: aquí solo entra lo que Andrés escribió. Nada
// se infiere, nada se completa con un valor plausible. Si no hay juicio, la
// celda queda marcada como pendiente.
//
// El armado del bloque y la sustitución dentro de la nota viven en
// lib/obsidian.mjs y están probados: es el único punto del sistema que escribe
// dentro de un archivo personal, y una regular expresión de más se lleva la
// nota por delante.

const PERFIL = process.env.PERFIL_GUSTOS
  ?? 'D:\\ANDRES\\Claude_Projects\\obsidian_vaults\\vida_personal\\gustos-artes-escenicas.md';

const SECO = process.argv.includes('--seco');

const festivales = await sql(
  `select *, to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio from eventos.festivales`);
const funciones = await sql(
  `select id, festival_id, to_char(fecha, 'YYYY-MM-DD') as fecha, obra, compania, agendada
     from eventos.funciones where agendada`);
const bitacora = await sql('select * from eventos.bitacora');

if (!bitacora.length) {
  console.log('No hay juicios registrados todavía. Nada que llevar al perfil.');
  if (SECO) console.log('(marcha en seco: tampoco habría escrito nada)');
  await poolPg().end();
  process.exit(0);
}

let texto = await readFile(PERFIL, 'utf8');
const original = texto;
const sincronizadas = [];

for (const fest of festivales) {
  const suyas = funciones.filter(f => f.festival_id === fest.id);
  const conJuicio = suyas.filter(f => bitacora.some(b => b.funcion_id === f.id));
  if (!conJuicio.length) continue;

  texto = insertarBloque(texto, fest, construirBloque(fest, suyas, bitacora));
  console.log(`  ${tituloSeccion(fest)}  (${conJuicio.length} de ${suyas.length} con juicio)`);

  for (const f of conJuicio) {
    const j = bitacora.find(b => b.funcion_id === f.id);
    if (j && !j.sincronizado_obsidian) sincronizadas.push(j.id);
  }
}

if (SECO) {
  console.log(`\nMarcha en seco. El archivo NO se tocó: ${PERFIL}`);
  console.log(`Cambiarían ${Math.abs(texto.length - original.length)} caracteres.`);
  const desde = texto.indexOf('## Bitácora');
  if (desde >= 0) {
    console.log('\n--- así quedaría la sección ---');
    console.log(texto.slice(desde, desde + 1200));
  }
  await poolPg().end();
  process.exit(0);
}

await writeFile(PERFIL, texto, 'utf8');

if (sincronizadas.length) {
  await sql(
    `update eventos.bitacora set sincronizado_obsidian = now() where id = any($1::uuid[])`,
    [sincronizadas]);
}

await poolPg().end();

console.log(`\nPerfil actualizado: ${PERFIL}`);
console.log(`${sincronizadas.length} juicios nuevos marcados como sincronizados.`);
