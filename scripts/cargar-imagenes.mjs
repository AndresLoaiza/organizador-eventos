import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sql, unaFila, poolPg, almacen, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';
import { tituloNormalizado } from '../lib/nombres.mjs';

// Sube las fotos recortadas del volante y las ata a las funciones.
//
// La atribución no se inventa: cada foto lleva impreso el nombre de la
// compañía, y solo se asigna cuando ese rótulo contiene el nombre del grupo tal
// como está en la base, o cuando coincide con el título de la obra. Lo que no
// case se queda sin foto y se reporta.

const DIR = 'trabajo/fotos';
const FICHAS = 'trabajo/fotos.json';

const storage = almacen();
if (!storage) { console.error(FALTA_LLAVE_STORAGE); process.exit(1); }

const fichas = JSON.parse(await readFile(FICHAS, 'utf8'));
const funciones = await sql(
  `select id, obra, compania, imagen_key from eventos.funciones
    where festival_id = (select id from eventos.festivales
                          where slug = 'fiesta-artes-escenicas-22-2026')`);

const norm = s => tituloNormalizado(s ?? '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

let subidas = 0, atadas = 0, sinDuenno = [];

for (const f of fichas) {
  const rotulo = norm(f.rotulo);
  if (!rotulo) { sinDuenno.push(f.archivo); continue; }

  // Dueñas: funciones cuya compañía aparece dentro del rótulo, o cuya obra es
  // exactamente el rótulo (pasa con los eventos especiales, que rotulan el
  // título en vez del grupo).
  const duennas = funciones.filter(x => {
    const cia = norm(x.compania);
    const obra = norm(x.obra);
    if (obra && obra === rotulo) return true;
    if (!cia || cia.length < 7) return false;
    // En los dos sentidos: el volante a veces rotula solo el grupo invitado
    // ("INCOLBALLET (Cali)") mientras la ficha lo nombra dentro de una frase
    // más larga ("Evento especial · INCOLBALLET (Cali) y Era Parca").
    return rotulo.includes(cia) || (rotulo.length >= 9 && cia.includes(rotulo));
  });
  if (!duennas.length) { sinDuenno.push(`${f.archivo} (${f.rotulo.slice(0, 40)})`); continue; }

  const clave = `fotos/fiesta-artes-escenicas-22-2026/${f.archivo.replace('.png', '.jpg')}`;
  const bytes = await readFile(join(DIR, f.archivo.replace('.png', '.jpg')));
  const { error } = await storage.storage.from(BUCKET)
    .upload(clave, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error && !/exists/i.test(error.message)) throw new Error(`${f.archivo}: ${error.message}`);
  subidas++;

  for (const d of duennas) {
    await sql('update eventos.funciones set imagen_key = $2, imagen_credito = $3 where id = $1',
      [d.id, clave, f.rotulo]);
    atadas++;
  }
}

const r = await unaFila(
  `select count(*) filter (where imagen_key is not null) as con,
          count(*) filter (where imagen_key is null and agendada) as agendadas_sin,
          count(*) as total
     from eventos.funciones`);

console.log(`${subidas} fotos subidas, ${atadas} funciones atadas.`);
console.log(`${r.con} de ${r.total} funciones con foto. Sin foto y agendadas: ${r.agendadas_sin}.`);
if (sinDuenno.length) {
  console.log('\nSin dueña clara, no se asignan:');
  for (const s of sinDuenno) console.log('  ' + s);
}

await poolPg().end();
