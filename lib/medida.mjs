import { aprender, senalesDe, agruparPorObra, interesDeGrupo } from './evidencia.mjs';

/**
 * Qué tan bien predice el recomendador tu ojeo, medido sobre obras que no vio.
 *
 * Validación cruzada de k pliegues, por obra y dentro de UN festival: se aprende
 * de k-1 partes y se evalúa en la que quedó afuera. Medir sobre lo mismo que se
 * usó para aprender daría números inflados.
 *
 * `test` decide qué obras cuentan al evaluar (se entrena siempre con todas,
 * menos las marcadas en lote, que aprender() ignora igual que en la app).
 *
 * Mide solo lo aprendido del ojeo. Lo que una regla dictada o una nota de
 * Claude resaltan no entra en esta cifra: esas fuentes se juzgan aparte.
 *
 *   precision: de lo resaltado, cuánto marcaste sí
 *   recall:    de lo que marcaste sí, cuánto se resaltó
 *   tasaEnBajadas: de lo que se mandó al final de la lista, cuánto marcaste sí
 *                  (tiene que ser menor que la base, o esa señal miente)
 */
export function medir(funciones, { k = 5, test = () => true } = {}) {
  const grupos = agruparPorObra(funciones)
    .filter(g => interesDeGrupo(g))
    .sort((a, b) => a[0].obra.localeCompare(b[0].obra));
  const m = { obras: 0, si: 0, resaltadas: 0, aciertos: 0, bajadas: 0, siEnBajadas: 0 };
  for (let i = 0; i < k; i++) {
    const ev = aprender(grupos.filter((_, j) => j % k !== i).flat());
    for (const g of grupos.filter((_, j) => j % k === i)) {
      if (!test(g)) continue;
      const y = interesDeGrupo(g) === 'si' ? 1 : 0;
      m.obras++; m.si += y;
      const s = senalesDe(g[0], ev);
      if (s.some(x => x.signo === '+')) { m.resaltadas++; m.aciertos += y; }
      else if (s.some(x => x.signo === '-')) { m.bajadas++; m.siEnBajadas += y; }
    }
  }
  return {
    ...m,
    base: m.obras ? m.si / m.obras : 0,
    precision: m.resaltadas ? m.aciertos / m.resaltadas : null,
    recall: m.si ? m.aciertos / m.si : null,
    tasaEnBajadas: m.bajadas ? m.siEnBajadas / m.bajadas : null,
  };
}
