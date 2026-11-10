// Refresca cartelera/cartelera.json: Cine Colombia Medellín + notas de IMDb.
//
//   npm run cartelera              escribe el JSON
//   npm run cartelera -- --seco    solo muestra lo que escribiría
//
// No necesita .env ni navegador: la API de Cine Colombia es pública y la nota
// sale del dataset oficial de IMDb. Las otras salas (Procinal, Cinemark,
// Colombo, MAMM) las lee scripts/salas.py con Scrapling y las deja en
// cartelera/salas.json; aquí se juntan con Cine Colombia en una sola lista.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { API, VENTANA_DIAS, VENTANA_ALTERNATIVO, armarCartelera, escogerImdb, escogerPosterAlternativo, busquedaObra, escogerImagenObra, posterImdb, unirSalas } from '../lib/cartelera.mjs';
import { hoyMedellin } from '../lib/panorama.mjs';

const RUTA = new URL('../cartelera/cartelera.json', import.meta.url);
const RUTA_SALAS = new URL('../cartelera/salas.json', import.meta.url);
const UA = { 'user-agent': 'Mozilla/5.0 (organizador-eventos; uso personal)' };
// Wikimedia exige nombre y contacto en el agente: el repo hace de contacto.
const UA_WIKI = { 'user-agent': 'OrganizadorEventos/1.0 (https://github.com/AndresLoaiza/organizador-eventos)' };
const seco = process.argv.includes('--seco');

async function json(url) {
  const r = await fetch(url, { headers: url.includes('wikipedia.org') ? UA_WIKI : UA });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const hoy = hoyMedellin();
const { sites: sedes } = await json(`${API}/sites?city=medellin`);
if (!sedes?.length) throw new Error('La API no devolvió sedes de Medellín: no se toca el JSON.');

// now_showing trae lo de cartelera; alternative, el teatro y la ópera filmados.
const segmentos = ['section=regular&segment=now_showing', 'section=regular&segment=advance_booking', 'section=alternative'];
const tableros = await Promise.all(segmentos.map(s => json(`${API}/billboard?city=medellin&${s}&per_page=100`)));
const peliculas = [...new Map(tableros.flatMap(t => t.films).map(f => [f.id, f])).values()];
const atributos = tableros.flatMap(t => t.related_data?.attributes ?? []);
const generos = tableros.flatMap(t => t.related_data?.genres ?? []);

const ids = sedes.map(s => s.id).join(',');
const { film_screening_dates: fechas } = await json(`${API}/films/screening-dates?site_ids=${ids}`);

const deCineColombia = armarCartelera({ sedes, peliculas, atributos, fechas, hoy, generos });
if (!deCineColombia.length) throw new Error('Cero películas en idioma original: algo cambió en la API. No se toca el JSON.');

const salas = existsSync(RUTA_SALAS) ? JSON.parse(readFileSync(RUTA_SALAS, 'utf8')) : { cadenas: [] };
const cartelera = unirSalas(deCineColombia, salas.cadenas);

const previo = JSON.parse(readFileSync(RUTA, 'utf8'));
const antes = Object.fromEntries(previo.peliculas.map(p => [p.slug, p]));

// IMDb: id del buscador público (o del JSON anterior, que ya pudo corregirse a
// mano); nota y votos del dataset oficial, que se publica a diario.
const tsv = gunzipSync(Buffer.from(await (await fetch('https://datasets.imdbws.com/title.ratings.tsv.gz')).arrayBuffer())).toString('utf8');
const ratings = new Map(tsv.split('\n').slice(1).map(l => l.split('\t')).map(([id, n, v]) => [id, { nota: Number(n), votos: Number(v) }]));

for (const p of cartelera) {
  const viejo = antes[p.slug];
  if (viejo?.motivo) p.motivo = viejo.motivo;
  let elegido = viejo?.imdb ? { id: viejo.imdb.id, dudoso: Boolean(viejo.imdb.dudoso) } : null;
  // Ópera, ballet y teatro filmados: el título no identifica la grabación
  // («Carmen» hay decenas), así que no se les busca nota.
  if (p.alternativo) elegido = null;
  else if (!elegido) {
    try {
      const s = await json(`https://v3.sg.media-imdb.com/suggestion/titles/x/${encodeURIComponent(p.original)}.json`);
      elegido = escogerImdb(s.d, p.original, p.anio, id => ratings.get(id)?.votos ?? 0);
    } catch { elegido = null; }
  }
  const r = elegido && ratings.get(elegido.id);
  if (r) p.imdb = { id: elegido.id, nota: r.nota, votos: r.votos, ...(elegido.dudoso ? { dudoso: true } : {}) };
  // Póster: el de IMDb (vertical y servible desde aquí) gana; se guarda para no
  // pedirlo cada semana. Si no hay, queda el de la sala (Cinemark, Colombo, MAMM).
  let img = viejo?.imdb?.id === p.imdb?.id ? viejo?.poster_imdb : null;
  if (p.alternativo && !img) {
    // Sin nota, pero la grabación sí suele estar en IMDb con su póster.
    try {
      const s = await json(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(p.original)}.json`);
      img = escogerPosterAlternativo(s.d, p.original, p.anio);
    } catch { img = null; }
    const b = !img && !p.poster && busquedaObra(p.original, p.generos);
    if (b) {
      try {
        // Wikimedia pide un agente con contacto y sin ráfagas.
        await new Promise(r => setTimeout(r, 1000));
        const w = await json(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=5&prop=pageimages|description&piprop=thumbnail&pithumbsize=300&gsrsearch=${encodeURIComponent(b.q)}`);
        img = escogerImagenObra(Object.values(w.query?.pages ?? {}), b.g);
      } catch { img = null; }
    }
  } else if (p.imdb && !img) {
    try {
      const s = await json(`https://v3.sg.media-imdb.com/suggestion/x/${p.imdb.id}.json`);
      img = posterImdb(s.d?.find(x => x.id === p.imdb.id)?.i?.imageUrl);
    } catch { img = null; }
  }
  if (img) { p.poster_imdb = img; p.poster = img; }
  // Lo de Cine Colombia ya quedó en p.donde.
  for (const k of ['anio', 'salas', 'idioma', 'fechas']) delete p[k];
}

const nuevo = {
  ...previo,
  verificado: hoy,
  imdb_leido: hoy,
  nota: `Películas con función subtitulada o en idioma original en Medellín entre hoy y la próxima semana (ópera, ballet, teatro y documentales de arte: los próximos ${VENTANA_ALTERNATIVO} días). Cine Colombia leída el ${hoy}; las otras salas, el ${salas.leido ?? 'sin leer'}. Cada botón abre la sala en vivo para ver horarios.`,
  peliculas: cartelera,
  cadenas: [
    { nombre: 'Cine Colombia', url: 'https://www.cinecolombia.com/cartelera/medellin',
      estado: `Leída el ${hoy} desde su API, en las ${sedes.length} sedes de Medellín.` },
    ...salas.cadenas.map(({ nombre, url, estado }) => ({ nombre, url, estado })),
  ],
};

console.log(cartelera.map(p => `${p.titulo} · ${p.donde.map(d => d.cadena).join(', ')} · IMDb ${p.imdb ? `${p.imdb.nota} (${p.imdb.votos})${p.imdb.dudoso ? ' dudoso' : ''}` : 'sin dato'}`).join('\n'));
if (!seco) {
  writeFileSync(RUTA, JSON.stringify(nuevo, null, 2) + '\n');
  console.log(`\n${cartelera.length} películas escritas en cartelera/cartelera.json`);
}
