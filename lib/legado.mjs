// Columnas heredadas de los cargadores viejos.
//
// Antes del formato 1 cada cargador pegaba campos distintos en las mismas dos
// columnas: San Ignacio guardaba «compañía · descripción» en `compania`, la
// Fiesta del Libro guardaba solo la descripción ahí, y las franjas y el público
// iban dentro de `nota_boleteria`. Separar depende del festival; recomponer
// es una sola regla para todos.
//
// shortcut: las pantallas todavía leen `compania` y `nota_boleteria`, por eso
// el cargador las recompone. En el subproyecto 2 pasan a leer las columnas
// nuevas y este módulo se borra.

const SEP = ' · ';
const PUBLICO = /^(\+ ?\d+ años|Familiar)$/;
const SUFIJO_LIBRO = /^(Entrada libre|Con intérprete de Lengua de Señas Colombiana)$/;

export const TIPO_LEGADO = {
  'fiesta-artes-escenicas-22-2026': 'artes',
  'fiesta-libro-cultura-20-2026': 'libro',
  'festival-teatro-san-ignacio-2026': 'san-ignacio',
};

const partes = s => (s ? s.split(SEP) : []);
const unir = xs => xs.filter(Boolean).join(SEP) || null;

/** Columnas heredadas a partir de los campos del formato 1. */
export function recomponer(f) {
  return {
    compania: unir([f.compania, f.descripcion])?.slice(0, 900) ?? null,
    nota_boleteria: unir([...(f.franjas ?? []), f.publico, f.nota]),
  };
}

/** Campos del formato 1 a partir de las columnas heredadas de una fila. */
export function separar(tipo, fila) {
  const base = { compania: fila.compania ?? null, descripcion: null, franjas: [], publico: null, nota: fila.nota_boleteria ?? null };

  if (tipo === 'artes') return base;

  if (tipo === 'san-ignacio') {
    const c = fila.compania ?? '';
    const i = c.indexOf(SEP);
    const p = partes(fila.nota_boleteria);
    const publico = PUBLICO.test(p[0] ?? '') ? p.shift() : null;
    return {
      ...base,
      compania: i < 0 ? (fila.compania ?? null) : c.slice(0, i),
      descripcion: i < 0 ? null : c.slice(i + SEP.length),
      publico,
      nota: unir(p),
    };
  }

  if (tipo === 'libro') {
    const p = partes(fila.nota_boleteria);
    return {
      ...base,
      compania: null,
      descripcion: fila.compania ?? null,
      franjas: p.filter(x => !SUFIJO_LIBRO.test(x)),
      nota: unir(p.filter(x => SUFIJO_LIBRO.test(x))),
    };
  }

  throw new Error(`tipo de legado desconocido: ${tipo}`);
}
