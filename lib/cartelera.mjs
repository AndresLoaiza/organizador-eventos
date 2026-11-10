// Cartelera de Cine Colombia en Medellín, desde la API JSON que usa su propia web.
//
// La página de una película pinta Medellín en el cliente, así que el HTML crudo
// no sirve. La web pide esto, sin cookies ni sesión:
//   /api/v1/sites?city=medellin                 sedes (id, nombre, slug)
//   /api/v1/billboard?city=medellin&...         películas (título, original, slug)
//   /api/v1/films/screening-dates?site_ids=...  por día, película y sede, los
//                                               atributos de sus funciones
// Los atributos de idioma salen de billboard.related_data.attributes.

export const API = 'https://www.cinecolombia.com/api/v1';
export const VENTANA_DIAS = 7;
// Ópera, ballet y teatro filmado son funciones únicas que se compran con
// semanas de anticipación: una semana de ventana las dejaría casi todas fuera.
// Cuatro meses alcanzan los documentales de arte, que se anuncian con más tiempo.
export const VENTANA_ALTERNATIVO = 120;
// Preventa: sin función esta semana pero con boletas a la venta (Dune 3 en dic).
export const VENTANA_PREVENTA = 60;

/** ¿Es preventa? Su primera función cae después de la semana que empieza hoy. */
export const esPreventa = (p, hoy) => !p.alternativo
  && (p.donde.flatMap(d => d.fechas ?? []).sort()[0] ?? '') > sumarDias(hoy, VENTANA_DIAS - 1);

const titulo = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

/** Ids de atributo que cuentan como idioma original, con su etiqueta. */
export function idiomasOriginales(atributos) {
  const out = {};
  for (const a of atributos ?? []) {
    if (a.kind !== 'language') continue;
    if (/^subtitulad/i.test(a.name)) out[a.id] = 'Subtitulada';
    else if (/^espa/i.test(a.name)) out[a.id] = 'Español (original)';
  }
  return out;
}

/** La fecha ISO `n` días después de `iso`. */
export function sumarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Películas con al menos una función en idioma original en Medellín entre hoy
 * y hoy + VENTANA_DIAS - 1. La preventa no entra sola: sus funciones caen
 * fuera de la ventana. Doblada nunca cuenta.
 */
export function armarCartelera({ sedes, peliculas, atributos, fechas, hoy, generos = [] }) {
  const originales = idiomasOriginales(atributos);
  const nombreSede = Object.fromEntries(sedes.map(s => [String(s.id), titulo(s.name)]));
  const ficha = Object.fromEntries(peliculas.map(p => [p.id, p]));
  const genero = Object.fromEntries(generos.map(g => [g.id, g.name]));
  // BTS en concierto llega como cartelera regular, pero su género lo delata.
  const esAlternativo = p => /alternativ/i.test(p.content_type ?? '')
    || (p.genre_ids ?? []).some(id => ALTERNATIVO.test(genero[id] ?? ''));
  const semana = sumarDias(hoy, VENTANA_DIAS - 1);
  const hasta = { false: sumarDias(hoy, VENTANA_PREVENTA - 1), true: sumarDias(hoy, VENTANA_ALTERNATIVO - 1) };
  const m = new Map();

  for (const dia of fechas) {
    if (dia.business_date < hoy) continue;
    for (const fs of dia.film_screenings) {
      const p = ficha[fs.film_id];
      if (!p || dia.business_date > hasta[esAlternativo(p)]) continue;
      for (const s of fs.sites) {
        const idiomas = s.showtime_attribute_ids.map(a => originales[a]).filter(Boolean);
        if (!idiomas.length || !nombreSede[s.site_id]) continue;
        const f = m.get(p.slug) ?? {
          titulo: (p.title_es || p.title).trim(), original: p.title.trim(), slug: p.slug,
          idiomas: new Set(), salas: new Set(), fechas: new Set(),
          anio: Number((p.release_date ?? '').slice(0, 4)) || null,
          generos: (p.genre_ids ?? []).map(id => genero[id]).filter(Boolean),
          duracion: p.runtime_minutes || p.duration_minutes || null,
          alternativo: esAlternativo(p),
          // Sin poster_url: su CDN (moviexchange) responde 400 fuera de cinecolombia.com.
        };
        f.dias ??= [];
        f.dias.push({ fecha: dia.business_date, sala: nombreSede[s.site_id], idiomas });
        m.set(p.slug, f);
      }
    }
  }

  // Si tiene función esta semana, solo cuenta la semana; si no, es preventa
  // y cuentan sus días a la venta.
  for (const f of m.values()) {
    const cerca = f.dias.filter(d => d.fecha <= semana);
    for (const d of (f.alternativo || !cerca.length ? f.dias : cerca)) {
      d.idiomas.forEach(i => f.idiomas.add(i));
      f.salas.add(d.sala);
      f.fechas.add(d.fecha);
    }
  }

  return [...m.values()]
    .map(f => ({
      titulo: f.titulo, original: f.original, slug: f.slug,
      salas: [...f.salas].sort(), idioma: [...f.idiomas].sort().join(' · '),
      fechas: [...f.fechas].sort(), anio: f.anio,
      generos: f.generos, duracion: f.duracion, alternativo: f.alternativo,
    }))
    .sort((a, b) => b.salas.length - a.salas.length || a.titulo.localeCompare(b.titulo));
}

// «The Fast and the Furious (25th Anniversary)» es «The Fast and the Furious».
const plano = s => s.replace(/\([^)]*\)/g, ' ').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Escoge el título de IMDb entre las sugerencias de su buscador. Solo
 * películas. Título igual gana y el año más cercano desempata (un reestreno
 * trae el año del reestreno, así que con título igual el año no descarta).
 * Sin título igual, solo se acepta la primera si su año está a uno del
 * estreno, y va marcada dudosa. Si no, nada: una nota de otra película es
 * peor que «sin dato».
 */
export function escogerImdb(sugerencias, original, anio, votosDe = () => 0) {
  const pelis = (sugerencias ?? []).filter(s => s.qid === 'movie' && /^tt\d+$/.test(s.id));
  if (!pelis.length) return null;
  const iguales = pelis.filter(s => plano(s.l) === plano(original));
  const dist = s => Math.abs((s.y ?? 0) - (anio ?? 0));
  // Sin año (las otras salas no lo publican) desempata la más votada: Akira
  // es la de 1988 y Digger la de 2026, no sus homónimas.
  const orden = anio ? (a, b) => dist(a) - dist(b) : (a, b) => votosDe(b.id) - votosDe(a.id);
  if (iguales.length) return { id: [...iguales].sort(orden)[0].id, dudoso: false };
  return anio && dist(pelis[0]) <= 1 ? { id: pelis[0].id, dudoso: true } : null;
}

/**
 * Solo el póster de una función especial (ópera, teatro, arte filmados). IMDb
 * nombra la grabación «The Metropolitan Opera: Samson et Dalila»: vale el
 * título igual o terminado en «: título», y del mismo año (±1), porque «Carmen»
 * sin año es cualquiera de cien. Sin año, nada.
 */
export function escogerPosterAlternativo(sugerencias, original, anio) {
  if (!anio) return null;
  const t = plano(original);
  const s = (sugerencias ?? []).find(x => /^tt\d+$/.test(x.id) && /movie/i.test(x.qid ?? '')
    && Math.abs((x.y ?? 0) - anio) <= 1 && x.i?.imageUrl
    && (plano(x.l) === t || plano(x.l).endsWith(` ${t}`) && x.l.includes(':')));
  return s ? posterImdb(s.i.imageUrl) : null;
}

// Género de la sala → palabra con que Wikipedia en inglés describe la obra.
const GENERO_WIKI = { 'Ópera': 'opera', 'Ballet': 'ballet', 'Teatro': 'play' };

/** Búsqueda que se le hace a Wikipedia, o null si el género no es de escena. */
export function busquedaObra(original, generos) {
  const g = (generos ?? []).map(x => GENERO_WIKI[x]).find(Boolean);
  return g ? { q: `${original} ${g}`, g } : null;
}

/**
 * Si IMDb no tiene la grabación, la imagen de la obra en Wikipedia (el cartel
 * del estreno de Carmen, el Doré de Samson): la primera página, en el orden de
 * la búsqueda, que se describa con el género y tenga imagen. «ballet company»
 * o «list of…» no son la obra.
 */
export function escogerImagenObra(paginas, g) {
  const p = [...(paginas ?? [])].sort((a, b) => a.index - b.index)
    .find(x => new RegExp(`\\b${g}\\b`, 'i').test(x.description ?? '') && !/company|list/i.test(x.description)
      && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(x.thumbnail?.source ?? ''));
  return p ? p.thumbnail.source : null;
}

// --- Unir las otras salas ------------------------------------------------------

/** Distancia de edición, para «resurrection» contra «resurreccion». */
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Formas comparables de un título: entero y lo que va antes de «:». */
function llaves(...titulos) {
  const out = new Set();
  for (const t of titulos.filter(Boolean)) {
    out.add(plano(t));
    if (t.includes(':')) out.add(plano(t.split(':')[0]));
  }
  out.delete('');
  return out;
}

/**
 * ¿Es la misma película? Igual en alguna forma, o a una letra de distancia si
 * el título es largo (traducciones como Resurrection / Resurrección). Más
 * holgura que eso juntaría películas distintas.
 */
export function mismaPelicula(a, b) {
  for (const x of a) for (const y of b) {
    if (x === y) return true;
    if (Math.min(x.length, y.length) >= 8 && distancia(x, y) <= 1) return true;
  }
  return false;
}

/**
 * Cinemark acorta: «Juegos del hambre: Amanecer» es «Los Juegos del Hambre:
 * Amanecer en la Cosecha». Vale si el título entero (sin artículo inicial, de
 * tres palabras o más) es el comienzo del otro. Solo títulos enteros: el
 * «Juegos del hambre» de antes de los dos puntos juntaría toda la saga.
 */
export function tituloRecortado(a, b) {
  const sin = t => plano(t).replace(/^(el|la|los|las|the) /, '');
  const [x, y] = [sin(a), sin(b)].sort((m, n) => m.length - n.length);
  return x.split(' ').length >= 3 && y.startsWith(`${x} `);
}

const slugDe = t => plano(t).replace(/ /g, '-');
// Géneros que en otras salas marcan un evento y no una película de cartelera.
const ALTERNATIVO = /ópera|opera|ballet|teatro|danza|concierto|musical/i;

/**
 * Junta la cartelera de Cine Colombia con las otras salas en una sola lista.
 * Cada película queda con `donde`: una entrada por cadena y sede, con su
 * idioma, sus días y su enlace. Doblada nunca llega aquí.
 */
export function unirSalas(cineColombia, cadenas) {
  const lista = cineColombia.map(p => ({
    ...p,
    donde: [{
      cadena: 'Cine Colombia', sede: p.salas.join(' · '), idioma: p.idioma, idioma_confirmado: true,
      fechas: p.fechas ?? [], url: `https://www.cinecolombia.com/peliculas/${p.slug}`,
    }],
  }));
  for (const c of cadenas) {
    for (const s of c.peliculas ?? []) {
      const k = llaves(s.titulo, s.original);
      let p = lista.find(x => mismaPelicula(llaves(x.titulo, x.original), k))
        ?? lista.find(x => tituloRecortado(x.titulo, s.titulo));
      if (!p) {
        p = { titulo: s.titulo, original: s.original, slug: slugDe(s.titulo), donde: [] };
        lista.push(p);
      }
      p.anio ??= s.anio ?? null;
      if (!p.generos?.length && s.generos?.length) p.generos = s.generos;
      p.duracion ??= s.duracion ?? null;
      p.alternativo = Boolean(p.alternativo || s.alternativo || p.generos?.some(g => ALTERNATIVO.test(g)));
      // El póster de la primera sala que lo traiga; Cine Colombia va primero.
      p.poster ??= s.poster ?? null;
      p.donde.push({
        cadena: c.nombre, sede: s.sede, idioma: s.idioma, idioma_confirmado: s.idioma_confirmado,
        fechas: [...new Set(s.funciones.map(f => f.slice(0, 10)))].sort(),
        funciones: s.funciones, url: s.url,
      });
    }
  }
  // Primero lo que se puede ver en más sitios; a igualdad, por título.
  return lista.sort((a, b) => b.donde.length - a.donde.length || a.titulo.localeCompare(b.titulo));
}

// --- Filtros de la pestaña ------------------------------------------------------

/**
 * Lo que se ve con los filtros puestos. Una película queda si alguna de sus
 * salas pasa los filtros, y solo con esas salas: si se pide el jueves, no
 * tiene sentido ofrecer la sala que solo la da el lunes.
 *   dia            'YYYY-MM-DD' o null
 *   cadena         nombre de cadena o null
 *   tipo           'cartelera', 'preventa', 'alternativo' o null (todo)
 *   hoy            'YYYY-MM-DD'; sin él no se distingue la preventa
 *   soloConfirmado oculta las salas que no publican el idioma
 * Orden: nota de IMDb, sin dato al final; alternativo y preventa, por fecha.
 */
export function filtrarCartelera(peliculas, { dia = null, cadena = null, tipo = null, soloConfirmado = true, hoy = null } = {}) {
  const pasa = d => (!dia || (d.fechas ?? []).includes(dia))
    && (!cadena || d.cadena === cadena)
    && (!soloConfirmado || d.idioma_confirmado !== false);
  const clase = p => (p.alternativo ? 'alternativo' : hoy && esPreventa(p, hoy) ? 'preventa' : 'cartelera');
  const out = peliculas
    .filter(p => !tipo || clase(p) === tipo)
    .map(p => ({ ...p, donde: p.donde.filter(pasa) }))
    .filter(p => p.donde.length);
  const nota = p => (p.imdb ? p.imdb.nota : -1);
  const primera = p => p.donde.flatMap(d => d.fechas ?? []).sort()[0] ?? '9999';
  return out.sort(tipo === 'alternativo' || tipo === 'preventa'
    ? (a, b) => primera(a).localeCompare(primera(b))
    : (a, b) => nota(b) - nota(a) || b.donde.length - a.donde.length);
}

/** Todos los días con alguna función, en orden. */
export const diasDe = peliculas => [...new Set(peliculas.flatMap(p => p.donde.flatMap(d => d.fechas ?? [])))].sort();

/** URL del póster de IMDb en 192 px de ancho (≈11 KB en vez del original). */
export function posterImdb(url) {
  if (!url || !/^https:\/\/m\.media-amazon\.com\//.test(url)) return null;
  return url.replace(/\._V1_.*\.jpg$/, '._V1_UX192_.jpg');
}
