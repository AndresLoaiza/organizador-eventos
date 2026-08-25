import { sql, unaFila } from './db.mjs';
import { armarPanorama, hoyMedellin, nombreDia, fechaLarga, nocheDe, alternativasDe, aISO } from './panorama.mjs';
import { fmtHora } from './decisor.mjs';

// Lectura por Postgres directo, para los scripts locales. La app publicada lee
// lo mismo por PostgREST desde el navegador (lib/cliente.mjs) y las dos pasan
// por armarPanorama, que es donde vive el cruce.

export { hoyMedellin, nombreDia, fechaLarga, nocheDe, alternativasDe, fmtHora, aISO };

export async function festivalActivo(slug) {
  if (slug) return unaFila('select * from eventos.festivales where slug = $1', [slug]);
  return unaFila('select * from eventos.festivales order by fecha_inicio desc limit 1');
}

export async function listarFestivales() {
  return sql('select * from eventos.festivales order by fecha_inicio desc');
}

export async function panorama(slugFestival) {
  const festival = await festivalActivo(slugFestival);
  if (!festival) return null;

  const [salas, funciones, boletas, estados, bitacora, traslados] = await Promise.all([
    sql('select * from eventos.salas'),
    sql('select * from eventos.funciones where festival_id = $1 order by fecha, hora_min', [festival.id]),
    sql(`select b.*, a.storage_key, a.extraccion_estado, a.origen
           from eventos.boletas b
           left join eventos.archivos a on a.id = b.archivo_id
          where b.festival_id = $1 or b.festival_id is null`, [festival.id]),
    sql('select * from eventos.estados_compra'),
    sql('select * from eventos.bitacora'),
    sql('select * from eventos.traslados where ciudad = $1', [festival.ciudad]),
  ]);

  return armarPanorama({ festival, salas, funciones, boletas, estados, bitacora, traslados });
}
