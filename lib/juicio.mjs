import { yaTermino } from './panorama.mjs';

// Juicios de la bitácora, para registrarlos en un toque.
//
// Tres juicios en tres festivales: registrar costaba demasiado (entrar a la
// bitácora, elegir la obra, escribir). Ahora la app pregunta al abrirse por lo
// que ya terminó, un toque en una estrella guarda, y el texto viene después y
// es opcional. Un juicio de un toque vale más que ninguno.

/** Cuántos días atrás se sigue preguntando. Pasado eso ya no está fresco. */
export const VENTANA_DIAS = 3;

/** ★★½ a partir de 2.5. PostgREST manda numeric como número; pg, como texto. */
export function pintarEstrellas(n) {
  const x = Number(n);
  if (!x) return '';
  return '★'.repeat(Math.floor(x)) + (x % 1 ? '½' : '');
}

/** La mitad izquierda de la estrella n es n - 0,5; la derecha, n. */
export const estrellasDeToque = (n, izquierda) => (izquierda ? n - 0.5 : n);

export const numeroEstrellas = n =>
  Number(n).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** La fila que se guarda. Texto vacío es null; «no fui» no lleva estrellas. */
export function filaJuicio({ funcion_id, texto, estrellas, asistio = true }) {
  return {
    funcion_id,
    texto: texto?.trim() || null,
    estrellas: asistio ? (estrellas || null) : null,
    asistio,
    sincronizado_obsidian: null,
  };
}

const diaNumero = iso => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 864e5;
};

/**
 * Por qué funciones preguntar al abrir la app: agendadas, que ya terminaron
 * (con hora, no solo fecha: ver yaTermino), de los últimos VENTANA_DIAS días y
 * sin juicio. La más reciente primero.
 */
export function porJuzgar(funciones, hoy, ahora) {
  return funciones
    .filter(f => f.agendada && !f.juicio && yaTermino(f, hoy, ahora)
      && diaNumero(hoy) - diaNumero(f.fecha) <= VENTANA_DIAS)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora_min - a.hora_min);
}

/** «Hoy», «Anoche» o «El viernes». */
export function cuandoFue(fecha, hoy, nombreDia) {
  const dias = diaNumero(hoy) - diaNumero(fecha);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Anoche';
  return `El ${nombreDia(fecha)}`;
}
