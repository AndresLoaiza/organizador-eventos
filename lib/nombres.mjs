import { createHash } from 'node:crypto';

// Convención de nombres del baúl. Documentada en el spec, resumida aquí porque
// es el tipo de decisión que se olvida y luego nadie se atreve a cambiar.
//
//   baul/{festival}/{AAAA-MM-DD}_{HHMM}_{obra}_{sala}_{hash8}.{ext}
//
// Fecha primero  -> el orden alfabético es el cronológico, sin índice.
// Hora incluida  -> hay dobles funciones el mismo día; sin ella dos boletas
//                   legítimas colisionan en la misma clave.
// Obra y sala    -> el baúl se lee desde el explorador de archivos sin la app.
// Hash al final  -> la clave es única por archivo, no por función: subir la
//                   misma foto dos veces no duplica, y dos boletas distintas de
//                   la misma función sí conviven (va acompañado).

const RESERVADOS = /[^a-z0-9]+/g;

export function slug(texto, max = 40) {
  if (!texto) return 'sin-dato';
  const plano = String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // tildes: "Matacandelas" y "Matacándelas" son la misma sala
    .replace(/ñ/gi, 'n')
    .toLowerCase();
  const limpio = plano.replace(RESERVADOS, '-').replace(/^-+|-+$/g, '');
  return (limpio.slice(0, max).replace(/-+$/, '')) || 'sin-dato';
}

export function hashContenido(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function horaCorta(horaMin) {
  const h = Math.floor(horaMin / 60), m = horaMin % 60;
  return String(h).padStart(2, '0') + String(m).padStart(2, '0');
}

const EXT_POR_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export function extension(mime, nombreOriginal = '') {
  if (EXT_POR_MIME[mime]) return EXT_POR_MIME[mime];
  const m = /\.([a-z0-9]{2,5})$/i.exec(nombreOriginal);
  return m ? m[1].toLowerCase() : 'bin';
}

/**
 * Clave de Storage para una boleta.
 *
 * @param festivalSlug  'fiesta-artes-escenicas-2026'
 * @param funcion       { fecha: '2026-08-27', hora_min: 1200, obra, salaSlug }
 * @param hash          sha256 completo del archivo
 */
export function claveBoleta(festivalSlug, funcion, hash, mime, nombreOriginal) {
  const partes = [
    funcion.fecha,
    horaCorta(funcion.hora_min),
    slug(funcion.obra, 32),
    slug(funcion.salaSlug ?? funcion.sala, 24),
    hash.slice(0, 8),
  ];
  return `baul/${slug(festivalSlug, 48)}/${partes.join('_')}.${extension(mime, nombreOriginal)}`;
}

/** Boleta que todavía no se pudo vincular a una función. */
export function claveHuerfana(hash, mime, nombreOriginal, fechaSubida) {
  return `baul/_sin-vincular/${fechaSubida}_${hash.slice(0, 8)}.${extension(mime, nombreOriginal)}`;
}

/**
 * Títulos normalizados para comparar. El motor detecta repeticiones comparando
 * el título exacto: si un día quedó "Perversa (Teatro Escena 3)" y otro
 * "Perversa", el agrupamiento falla en silencio y se le dice al usuario que
 * pierde algo que sí podía ver.
 */
export function tituloNormalizado(titulo) {
  return String(titulo ?? '')
    .replace(/\s*\([^)]*\)\s*$/, '')   // quita la compañía pegada al final
    .replace(/[,.;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function mismoTitulo(a, b) {
  return tituloNormalizado(a) === tituloNormalizado(b);
}
