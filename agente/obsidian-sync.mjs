import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { sql, poolPg } from '../scripts/_cliente.mjs';

// Puente Supabase -> vault de Obsidian. Corre en el PC porque el vault vive en
// D:\ y no es repo git: ningún proceso remoto puede escribirlo.
//
// Regla del vault, no negociable: aquí solo entra lo que Andrés escribió. Nada
// se infiere, nada se completa con un valor plausible. Si no hay juicio, la
// celda queda vacía y no se inventa una impresión.

const PERFIL = process.env.PERFIL_GUSTOS
  ?? 'D:\\ANDRES\\Claude_Projects\\obsidian_vaults\\vida_personal\\gustos-artes-escenicas.md';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const festivales = await sql(
  `select *, to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio from eventos.festivales`);
const funciones = await sql(
  `select id, festival_id, to_char(fecha, 'YYYY-MM-DD') as fecha, obra, compania, agendada
     from eventos.funciones`);
const bitacora = await sql('select * from eventos.bitacora');

if (!bitacora.length) {
  console.log('No hay juicios registrados todavía. Nada que llevar al perfil.');
  await poolPg().end();
  process.exit(0);
}

let texto = await readFile(PERFIL, 'utf8');
const sincronizadas = [];

for (const fest of festivales) {
  const suyas = funciones.filter(f => f.festival_id === fest.id && f.agendada);
  const conJuicio = suyas.filter(f => bitacora.some(b => b.funcion_id === f.id));
  if (!conJuicio.length) continue;

  const [a, m] = fest.fecha_inicio.split('-').map(Number);
  const titulo = `### ${fest.nombre} — ${fest.ciudad}, ${MESES[m - 1]} ${a}`;

  const filas = suyas
    .sort((x, y) => x.fecha.localeCompare(y.fecha))
    .map(f => {
      const j = bitacora.find(b => b.funcion_id === f.id);
      const estrellas = j?.estrellas ? '★'.repeat(j.estrellas) : '';
      const juicio = j?.texto ? j.texto.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|') : '_(sin registrar)_';
      return `| ${f.obra} | ${f.compania ?? ''} | ${estrellas} | ${juicio} |`;
    });

  const bloque = [
    titulo,
    '',
    `Escrito desde la app Organizador de Eventos. ${conJuicio.length} de ${suyas.length} funciones juzgadas.`,
    '',
    '| Obra | Grupo | Estrellas | Qué me pareció |',
    '|---|---|---|---|',
    ...filas,
    '',
  ].join('\n');

  // Reemplaza la subsección de ese festival si ya existe; si no, la mete al
  // principio de la Bitácora para que lo más reciente quede arriba.
  const re = new RegExp(`### ${escapar(fest.nombre)}[^\\n]*\\n[\\s\\S]*?(?=\\n### |\\n## |$)`);
  if (re.test(texto)) {
    texto = texto.replace(re, bloque);
  } else if (texto.includes('## Bitácora')) {
    texto = texto.replace(/## Bitácora\n/, m => `${m}\n${bloque}\n`);
  } else {
    texto += `\n## Bitácora\n\n${bloque}\n`;
  }

  for (const f of conJuicio) {
    const j = bitacora.find(b => b.funcion_id === f.id);
    if (j && !j.sincronizado_obsidian) sincronizadas.push(j.id);
  }
}

await writeFile(PERFIL, texto, 'utf8');

if (sincronizadas.length) {
  await sql(
    `update eventos.bitacora set sincronizado_obsidian = now() where id = any($1::uuid[])`,
    [sincronizadas]);
}

await poolPg().end();

console.log(`Perfil actualizado: ${PERFIL}`);
console.log(`${sincronizadas.length} juicios nuevos marcados como sincronizados.`);

function escapar(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
