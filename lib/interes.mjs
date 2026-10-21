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

/**
 * Razones por las que una función merece una segunda mirada. Vacío = ninguna,
 * que no significa mala: significa que no coincide con nada que él haya dicho.
 *
 * La franja NO entra en la búsqueda a propósito. "Lanzamientos de libros" son
 * 317 de las 776 funciones: buscar "lanzamiento" resaltaría casi la mitad del
 * festival, y un destacado que cubre la mitad no destaca nada.
 */
export function razonesDe(f) {
  const texto = norm(`${f.obra} ${f.compania}`);
  return REGLAS
    .filter(r => r.claves.some(k => texto.includes(k)))
    .map(({ id, etiqueta, fuente }) => ({ id, etiqueta, fuente }));
}

/**
 * Dato, no veto: tiene PFPS en rodillas y una función larga sin intermedio le
 * cuesta. El perfil es explícito en que se menciona, no se descarta por eso.
 */
export function avisoCuerpo(f) {
  return f.duracion_min > 120
    ? `${f.duracion_min} min sin intermedio confirmado — largo para las rodillas`
    : null;
}

/** Orden de ojeo: primero lo que coincide con algo suyo, después por hora. */
export function ordenarParaOjear(funciones) {
  const peso = f => (razonesDe(f).length ? 0 : 1);
  return [...funciones].sort((a, b) =>
    peso(a) - peso(b) || a.hora_min - b.hora_min || a.obra.localeCompare(b.obra));
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
 * Agrupa funciones por obra.
 *
 * El volante repite la misma obra función por función, una fila por fecha. Pero
 * "me interesa" es una decisión sobre la obra, no sobre la fecha: si ya la
 * marcaste el domingo, no hay por qué volver a preguntar por la del lunes. Esa
 * segunda pregunta —cuál función específica, según lo que ya choque— es de
 * Decidir, no de aquí.
 */
export function agruparPorObra(funciones) {
  const m = new Map();
  for (const f of funciones) {
    if (!m.has(f.obra)) m.set(f.obra, []);
    m.get(f.obra).push(f);
  }
  return [...m.values()];
}

/**
 * El interés del grupo: 'si' o 'no' solo si todas sus funciones coinciden.
 * Si falta ojear alguna, o quedaron mezcladas (herencia de cuando se marcaba
 * función por función), null: hay que volver a decidir por la obra entera.
 */
export function interesDeGrupo(ocurrencias) {
  if (ocurrencias.every(o => o.interes === 'si')) return 'si';
  if (ocurrencias.every(o => o.interes === 'no')) return 'no';
  return null;
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
