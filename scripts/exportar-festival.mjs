import { readFile, writeFile, mkdir } from 'node:fs/promises';
import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { separar, recomponer, TIPO_LEGADO } from '../lib/legado.mjs';
import { aHora, validar } from '../lib/formato.mjs';

// Base -> festivales/{slug}.json.
//
// La prueba que importa está aquí: cada fila se separa en los campos nuevos y
// se vuelve a recomponer. Si una sola no da exactamente lo que había, se aborta
// sin escribir: la separación estaría perdiendo información.
//
// "" y null cuentan como iguales: 15 lanzamientos de la Fiesta del Libro
// traen compania "" y el JSON los deja en null, que significa lo mismo.
//
// Las fuentes ya archivadas en el JSON anterior se conservan.

const slug = process.argv[2];
const tipo = TIPO_LEGADO[slug];
if (!tipo) {
  console.error(`Uso: npm run exportar -- <slug>. Slugs: ${Object.keys(TIPO_LEGADO).join(', ')}`);
  process.exit(1);
}

const festival = await unaFila(
  `select slug, nombre, ciudad, to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
          to_char(fecha_fin, 'YYYY-MM-DD') as fecha_fin
     from eventos.festivales where slug = $1`, [slug]);
if (!festival) { console.error(`No existe el festival ${slug}.`); process.exit(1); }

const filas = await sql(
  `select f.*, to_char(f.fecha, 'YYYY-MM-DD') as fecha, s.slug as sala_slug
     from eventos.funciones f
     join eventos.festivales fe on fe.id = f.festival_id
     left join eventos.salas s on s.id = f.sala_id
    where fe.slug = $1
    order by f.fecha, f.hora_min, f.obra`, [slug]);

const malas = [];
const funciones = filas.map(r => {
  const s = separar(tipo, r);
  const vuelta = recomponer(s);
  if (vuelta.compania !== (r.compania || null) || vuelta.nota_boleteria !== (r.nota_boleteria || null)) {
    malas.push({ obra: r.obra, fecha: r.fecha, antes: [r.compania, r.nota_boleteria], vuelta: [vuelta.compania, vuelta.nota_boleteria] });
  }
  return {
    obra: r.obra,
    compania: s.compania,
    descripcion: s.descripcion,
    franjas: s.franjas,
    tipos: r.tipos ?? null,
    publico: s.publico,
    nota: s.nota,
    fuente_horario: r.fuente_horario,
    fecha: r.fecha,
    hora: aHora(r.hora_min),
    sala: r.sala_slug,
    duracion: { min: r.duracion_min, confirmada: r.duracion_confirmada },
    precio: { pleno: r.precio_pleno, dcto: r.precio_dcto, libre: r.precio_pleno === 0 },
    url_compra: r.url_compra ?? null,
    imagen: r.imagen_key ? { key: r.imagen_key, credito: r.imagen_credito ?? null } : null,
  };
});

if (malas.length) {
  console.error(`${malas.length} filas no sobreviven a separar y recomponer. No se escribe nada:`);
  for (const m of malas.slice(0, 20)) console.error(JSON.stringify(m));
  await poolPg().end();
  process.exit(1);
}

const slugsSala = [...new Set(funciones.map(f => f.sala))];
const salas = await sql(
  `select slug, nombre, direccion, telefono, zona from eventos.salas
    where slug = any($1) order by slug`, [slugsSala]);
const zonas = [...new Set(salas.map(s => s.zona))];
const traslados = await sql(
  `select zona_a, zona_b, minutos from eventos.traslados
    where ciudad = $1 and zona_a = any($2) and zona_b = any($2) order by zona_a, zona_b`,
  [festival.ciudad, zonas]);

const ruta = new URL(`../festivales/${slug}.json`, import.meta.url);
const previo = await readFile(ruta, 'utf8').then(JSON.parse).catch(() => null);

const json = { formato: 1, festival, fuentes: previo?.fuentes ?? [], salas, traslados, funciones };

await mkdir(new URL('../festivales/', import.meta.url), { recursive: true });
await writeFile(ruta, JSON.stringify(json, null, 2) + '\n');

console.log(`${funciones.length} funciones, ${salas.length} salas, ${traslados.length} traslados -> festivales/${slug}.json`);
console.log(`Separar y recomponer: ${filas.length} de ${filas.length} filas idénticas.`);
const errores = validar(json);
if (errores.length) {
  console.log(`\nEl validador encuentra ${errores.length} problemas:`);
  for (const e of errores) console.log('  ' + e);
}
await poolPg().end();
