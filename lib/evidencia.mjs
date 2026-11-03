// Qué enseña el ojeo de un festival sobre qué te interesa.
//
// Cada marca de «sí» o «no» es una observación sobre una obra. Esta pieza
// cuenta, para cada rasgo de la ficha (franja, técnica, sala, compañía), en
// cuántas obras ojeadas hubo un sí. Cuando un rasgo tiene suficientes casos y
// su tasa de sí se aparta de la base, emite una señal con sus cifras a la
// vista: «El Quijote: 8 de 9». Nada de pesos escondidos; cada señal se puede
// contradecir porque dice de qué números sale.
//
// Los umbrales no se afinaron sobre tu ojeo: se fijaron antes de medir y con
// otras cuatro combinaciones la precisión cae entre 47% y 56%, no se mueve.

export const MIN_CASOS = 5;     // menos obras que esto y no se dice nada
export const MIN_TASA = 0.5;    // un rasgo positivo acierta al menos la mitad
export const MIN_LIFT = 1.5;    // y al menos una vez y media la base
const MAX_LARGO_COMPANIA = 80;  // más largo que esto es una descripción, no un nombre

/** Todas las funciones de una misma obra juntas. */
export function agruparPorObra(funciones) {
  const m = new Map();
  for (const f of funciones) {
    if (!m.has(f.obra)) m.set(f.obra, []);
    m.get(f.obra).push(f);
  }
  return [...m.values()];
}

/**
 * El interés de una obra: 'si' o 'no' solo si todas sus funciones coinciden.
 * Si falta ojear alguna, o quedaron mezcladas (herencia de cuando se marcaba
 * función por función), null: no es un juicio sobre la obra.
 */
export function interesDeGrupo(ocurrencias) {
  if (ocurrencias.every(o => o.interes === 'si')) return 'si';
  if (ocurrencias.every(o => o.interes === 'no')) return 'no';
  return null;
}

/**
 * La compañía de verdad. Las columnas heredadas la pegan con la descripción:
 * San Ignacio guarda «compañía · descripción» y la Fiesta del Libro guarda
 * solo la descripción en `compania`. Con las columnas nuevas se deshace.
 */
export function companiaReal(f) {
  const c = f.compania || null;
  if (!c) return null;
  if (!f.descripcion) return c;
  if (c === f.descripcion) return null;
  const sufijo = ` · ${f.descripcion}`;
  return c.endsWith(sufijo) ? c.slice(0, -sufijo.length) : c;
}

/** Los rasgos de una ficha que pueden predecir el interés. */
export function rasgosDe(f) {
  const out = [];
  for (const v of f.franjas ?? []) out.push({ tipo: 'franja', valor: v });
  for (const v of f.tipos ?? []) out.push({ tipo: 'tipo', valor: v });
  if (f.sala?.nombre) out.push({ tipo: 'sala', valor: f.sala.nombre });
  const c = companiaReal(f);
  if (c && c.length <= MAX_LARGO_COMPANIA) out.push({ tipo: 'compañía', valor: c });
  return out;
}

export const claveDe = r => `${r.tipo}\u0000${r.valor}`;

/**
 * Cuenta sobre las obras ojeadas de un festival.
 *
 * @param funciones     funciones del festival con `interes`
 * @param idsDeReglas   f => ids de las reglas declaradas que casan con la ficha;
 *                      sirve para anotar cuánto acierta cada regla que Andrés dictó
 * @returns { n, si, base, rasgos: Map, reglas: Map }
 */
export function aprender(funciones, idsDeReglas = () => []) {
  const rasgos = new Map(), reglas = new Map();
  let n = 0, si = 0;
  for (const grupo of agruparPorObra(funciones)) {
    const estado = interesDeGrupo(grupo);
    if (!estado) continue;
    const y = estado === 'si' ? 1 : 0;
    n++; si += y;
    const ref = grupo[0];
    const vistos = new Set();
    for (const r of rasgosDe(ref)) {
      const k = claveDe(r);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const s = rasgos.get(k) ?? { tipo: r.tipo, valor: r.valor, n: 0, si: 0 };
      s.n++; s.si += y;
      rasgos.set(k, s);
    }
    for (const id of new Set(idsDeReglas(ref))) {
      const s = reglas.get(id) ?? { n: 0, si: 0 };
      s.n++; s.si += y;
      reglas.set(id, s);
    }
  }
  return { n, si, base: n ? si / n : 0, rasgos, reglas };
}

/**
 * Señales de una ficha según lo aprendido.
 *   '+' el rasgo acierta mucho más que la base: resaltar.
 *   '-' el rasgo acierta la mitad de la base o menos: mandar al final.
 * Una señal negativa ordena, no esconde: descartar es decisión de Andrés.
 */
export function senalesDe(f, ev) {
  if (!ev || ev.n < MIN_CASOS) return [];
  const out = [];
  for (const r of rasgosDe(f)) {
    const s = ev.rasgos.get(claveDe(r));
    if (!s || s.n < MIN_CASOS) continue;
    const tasa = s.si / s.n;
    if (tasa >= MIN_TASA && tasa >= ev.base * MIN_LIFT) out.push({ ...s, tasa, signo: '+' });
    else if (ev.base > 0 && tasa <= ev.base / 2) out.push({ ...s, tasa, signo: '-' });
  }
  return out;
}
