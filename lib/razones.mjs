import { tituloNormalizado } from './nombres.mjs';

// Las razones que Claude escribe al cargar un festival, por obra: dónde ninguna
// regla ni el ojeo alcanzan, una frase que dice por qué podría interesarte y de
// qué parte del perfil sale. Se guardan en festivales/<slug>.razones.json, que
// no va a git (es tu gusto y el repositorio es público).

export const MAX_TEXTO = 280;

/** Errores de una lista [{ obra, texto }] frente a las obras del festival. */
export function validarRazones(lista, obras) {
  if (!Array.isArray(lista)) return ['el archivo debe ser una lista de { obra, texto }'];
  const e = [];
  const existentes = new Set(obras.map(tituloNormalizado));
  const vistas = new Set();
  for (const [i, r] of lista.entries()) {
    const donde = `razones[${i}]`;
    if (!r || typeof r.obra !== 'string' || typeof r.texto !== 'string') {
      e.push(`${donde}: faltan obra o texto`);
      continue;
    }
    const n = tituloNormalizado(r.obra);
    if (!existentes.has(n)) e.push(`${donde}: la obra «${r.obra}» no está en el festival`);
    if (vistas.has(n)) e.push(`${donde}: «${r.obra}» repetida`);
    vistas.add(n);
    if (!r.texto.trim()) e.push(`${donde}: texto vacío`);
    if (r.texto.length > MAX_TEXTO) e.push(`${donde}: texto de ${r.texto.length} caracteres, máximo ${MAX_TEXTO}`);
  }
  return e;
}

/** La misma lista con cada obra escrita como está en la base. */
export function canonicas(lista, obras) {
  const porNorm = new Map(obras.map(o => [tituloNormalizado(o), o]));
  return lista.map(r => ({ obra: porNorm.get(tituloNormalizado(r.obra)), texto: r.texto.trim() }));
}
