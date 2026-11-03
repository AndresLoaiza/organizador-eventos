// Qué resaltar al ojear, y por qué.
//
// Ninguna regla sale de mi criterio sobre qué es buen teatro. Cada una cita su
// origen: o una frase del perfil de gustos del vault, o algo que Andrés pidió
// para este festival. Si mañana cambia de gusto, se edita el perfil y esto se
// mueve detrás; una recomendación sin fuente no se puede corregir.
//
// Resaltar no es elegir. Marca lo que valdría la pena mirar de cerca entre 776
// funciones, con la razón a la vista para poder darle la contraria.

const norm = s => (s ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

import { aprender, senalesDe, MIN_CASOS } from './evidencia.mjs';

// agruparPorObra e interesDeGrupo viven en evidencia.mjs; se re-exportan para
// que quien las importaba de aquí no cambie.
export { agruparPorObra, interesDeGrupo } from './evidencia.mjs';

export const REGLAS = [
  {
    id: 'pedido',
    etiqueta: 'Lo pediste',
    fuente: 'dicho el 28 ago 2026',
    // Nombres propios: van completos para no pescar a cualquier Jaramillo.
    claves: ['roberto luis jaramillo', 'pantoloco', 'saramago',
      'ensayo sobre la ceguera', 'realismo magico'],
  },
  {
    id: 'realismo',
    etiqueta: 'Realismo mágico',
    fuente: 'dicho el 28 ago 2026',
    claves: ['garcia marquez', 'cien anos de soledad', 'macondo', 'el gaviero',
      'alvaro mutis', 'juan rulfo', 'pedro paramo', 'isabel allende'],
  },
  {
    id: 'oficio',
    etiqueta: 'Oficio transferible',
    fuente: 'perfil: clown, teatro físico, objetos, improvisación y cabaret valen doble',
    claves: ['clown', 'payas', 'bufon', 'mimo', 'teatro fisico', 'gestual',
      'teatro de objetos', 'titere', 'improvisacion', 'impro ', 'cabaret',
      'stand-up', 'stand up', 'comedia', 'humor', 'circo'],
  },
  {
    id: 'escena',
    etiqueta: 'Gente del medio',
    fuente: 'perfil: valen moliendas, aniversarios, clausuras y cabarets',
    claves: ['molienda', 'aniversario', 'clausura', 'inauguracion', 'homenaje'],
  },
];

/** Reglas declaradas que casan con la ficha. Sin evidencia: eso lo agrega razonesDe. */
export function reglasDe(f) {
  const texto = norm(`${f.obra} ${f.compania}`);
  return REGLAS
    .filter(r => r.claves.some(k => texto.includes(k)))
    .map(({ id, etiqueta, fuente }) => ({ id, etiqueta, fuente }));
}

/** Lo que el ojeo del festival en curso ya enseñó. Puro: se recalcula al ojear. */
export const aprenderOjeo = funciones => aprender(funciones, f => reglasDe(f).map(r => r.id));

/**
 * Razones por las que una función merece una segunda mirada. Vacío = ninguna,
 * que no significa mala: significa que nada de lo dicho ni de lo ojeado apunta ahí.
 *
 * Cada razón dice su origen:
 *   dicho  una regla que Andrés dictó; se queda aunque acierte poco, pero
 *          muestra cuánto acierta en este festival
 *   ojeo   un rasgo (franja, técnica, sala, compañía) que en este festival
 *          marcaste sí mucho más que el resto
 *
 * La franja no entra en la búsqueda de las reglas dichas a propósito:
 * «Lanzamientos de libros» son 317 de 776 funciones, y buscar esa palabra
 * resaltaría media Fiesta. Como rasgo aprendido sí cuenta, porque ahí lo que
 * pesa es cuántas veces dijiste sí dentro de ella, no que exista.
 */
export function razonesDe(f, ev = null) {
  const dicho = reglasDe(f).map(r => {
    const e = ev?.reglas.get(r.id);
    return { ...r, origen: 'dicho', evidencia: e ? { si: e.si, n: e.n } : null };
  });
  const ojeo = senalesDe(f, ev).filter(s => s.signo === '+').map(s => ({
    id: `ojeo:${s.tipo}:${s.valor}`,
    etiqueta: `${s.valor}: ${s.si} de ${s.n}`,
    fuente: `tu ojeo de este festival: marcaste sí ${s.si} de ${s.n} obras de ${s.tipo} «${s.valor}»`,
    origen: 'ojeo',
    evidencia: { si: s.si, n: s.n },
  }));
  return [...dicho, ...ojeo];
}

/** El texto largo de una razón, para el title del chip. */
export function textoRazon(r) {
  if (r.origen !== 'dicho' || !r.evidencia) return r.fuente;
  const { si, n } = r.evidencia;
  return `${r.fuente} · en tu ojeo de este festival: ${si} de ${n}${n < MIN_CASOS ? ' (pocos casos)' : ''}`;
}

/** ¿Algún rasgo de esta ficha suele ser «no» para ti? Ordena al final; no esconde. */
export const bajaPrioridad = (f, ev) => senalesDe(f, ev).some(s => s.signo === '-');

/**
 * Dato, no veto: tiene PFPS en rodillas y una función larga sin intermedio le
 * cuesta. El perfil es explícito en que se menciona, no se descarta por eso.
 */
export function avisoCuerpo(f) {
  return f.duracion_min > 120
    ? `${f.duracion_min} min sin intermedio confirmado — largo para las rodillas`
    : null;
}

/**
 * Orden de ojeo: primero lo que coincide con algo tuyo (dicho u ojeado), al
 * final lo que suele ser «no» en este festival, en medio el resto. Dentro de
 * cada peso, por hora. Lo que baja sigue en la lista: solo tú descartas.
 */
export function ordenarParaOjear(funciones, ev = null) {
  const pesos = new Map(funciones.map(f =>
    [f, razonesDe(f, ev).length ? 0 : bajaPrioridad(f, ev) ? 2 : 1]));
  return [...funciones].sort((a, b) =>
    pesos.get(a) - pesos.get(b) || a.hora_min - b.hora_min || a.obra.localeCompare(b.obra));
}

/**
 * Qué llega al decisor.
 *
 * Todo menos lo que dijiste que no. Lo que no has ojeado también entra: si no
 * entrara, una función a la misma hora que otra que sí quieres no aparecería,
 * y no habría forma de agendarla ni de ver qué cuesta elegirla. Ojear ordena
 * el gusto; no es un permiso para que Decidir muestre algo.
 *
 * Lo agendado nunca sale, aunque después lo hayas descartado: el motor de
 * choques creería libre una noche tomada y prometería rescates que no existen.
 */
export function paraDecidir(funciones) {
  return {
    funciones: funciones.filter(f => f.interes !== 'no' || f.agendada),
    filtrado: funciones.some(f => f.interes),
  };
}

/**
 * Columnas que se escriben al marcar interés. El origen importa para medir:
 * un «no» de «Descartar las N sin resaltar» no es un juicio sobre cada obra,
 * y mezclado con los juicios de verdad hace pasar por error lo que el
 * recomendador acierta o falla.
 */
export function filaInteres(interes, lote = false) {
  return {
    interes: interes ?? null,
    interes_origen: interes ? (lote ? 'lote' : 'manual') : null,
  };
}

export function contarOjeo(funciones) {
  const c = { si: 0, no: 0, sinVer: 0 };
  for (const f of funciones) {
    if (f.interes === 'si') c.si++;
    else if (f.interes === 'no') c.no++;
    else c.sinVer++;
  }
  return c;
}
