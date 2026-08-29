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
 * Lo marcado que sí, más lo que ya está agendado: una función agendada antes de
 * que existiera el ojeo no puede desaparecer del decisor solo porque nadie la
 * ha marcado, o el motor de choques creería libre una noche que está tomada y
 * prometería rescates que no existen.
 *
 * Si el festival entero está sin ojear —el caso de la 22.ª Fiesta, cargada
 * antes de que esto existiera, y el de cualquier programación recién
 * importada— pasa todo. Un decisor en blanco no enseña que falta ojear:
 * parece que la programación no se cargó.
 */
export function paraDecidir(funciones) {
  const ojeado = funciones.some(f => f.interes);
  if (!ojeado) return { funciones, filtrado: false };
  return {
    funciones: funciones.filter(f => f.interes === 'si' || f.agendada),
    filtrado: true,
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
