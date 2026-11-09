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
export function armarCartelera({ sedes, peliculas, atributos, fechas, hoy }) {
  const originales = idiomasOriginales(atributos);
  const nombreSede = Object.fromEntries(sedes.map(s => [String(s.id), titulo(s.name)]));
  const ficha = Object.fromEntries(peliculas.map(p => [p.id, p]));
  const hasta = sumarDias(hoy, VENTANA_DIAS - 1);
  const m = new Map();

  for (const dia of fechas) {
    if (dia.business_date < hoy || dia.business_date > hasta) continue;
    for (const fs of dia.film_screenings) {
      const p = ficha[fs.film_id];
      if (!p) continue;
      for (const s of fs.sites) {
        const idiomas = s.showtime_attribute_ids.map(a => originales[a]).filter(Boolean);
        if (!idiomas.length || !nombreSede[s.site_id]) continue;
        const f = m.get(p.slug) ?? {
          titulo: p.title_es || p.title, original: p.title, slug: p.slug,
          idiomas: new Set(), salas: new Set(), fechas: new Set(),
          anio: Number((p.release_date ?? '').slice(0, 4)) || null,
        };
        idiomas.forEach(i => f.idiomas.add(i));
        f.salas.add(nombreSede[s.site_id]);
        f.fechas.add(dia.business_date);
        m.set(p.slug, f);
      }
    }
  }

  return [...m.values()]
    .map(f => ({
      titulo: f.titulo, original: f.original, slug: f.slug,
      salas: [...f.salas].sort(), idioma: [...f.idiomas].sort().join(' · '),
      fechas: [...f.fechas].sort(), anio: f.anio,
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
export function escogerImdb(sugerencias, original, anio) {
  const pelis = (sugerencias ?? []).filter(s => s.qid === 'movie' && /^tt\d+$/.test(s.id));
  if (!pelis.length) return null;
  const iguales = pelis.filter(s => plano(s.l) === plano(original));
  const dist = s => Math.abs((s.y ?? 0) - (anio ?? 0));
  if (iguales.length) return { id: [...iguales].sort((a, b) => dist(a) - dist(b))[0].id, dudoso: false };
  return anio && dist(pelis[0]) <= 1 ? { id: pelis[0].id, dudoso: true } : null;
}
