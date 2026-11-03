import { writeFile, mkdir } from 'node:fs/promises';
import { sql, poolPg } from './_cliente.mjs';

// Base -> lib/fixtures/ojeo.json: solo las funciones que ya ojeaste, con los
// rasgos que usa el recomendador. Va fuera de git (ver .gitignore) porque es tu
// gusto y el repositorio es público. lib/recomendador.test.mjs lo mide.

const filas = await sql(`
  select fe.slug as festival, f.obra, f.compania, f.descripcion, f.franjas, f.tipos,
         s.nombre as sala, f.interes, f.interes_origen
    from eventos.funciones f
    join eventos.festivales fe on fe.id = f.festival_id
    left join eventos.salas s on s.id = f.sala_id
   where f.interes is not null
   order by fe.slug, f.obra, f.fecha, f.hora_min`);

const dir = new URL('../lib/fixtures/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('ojeo.json', dir),
  JSON.stringify({ generado: new Date().toISOString(), funciones: filas }));

const origen = { manual: 0, lote: 0, desconocido: 0 };
for (const f of filas) origen[f.interes_origen ?? 'desconocido']++;
console.log(`${filas.length} funciones ojeadas -> lib/fixtures/ojeo.json`);
console.log(`Origen de las marcas: ${origen.manual} manuales, ${origen.lote} en lote, ${origen.desconocido} desconocidas.`);
await poolPg().end();
