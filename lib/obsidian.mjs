// Armado del bloque de bitácora que va al vault, sin tocar disco ni base.
//
// Se separa del agente porque aquí vive lo que puede romper algo del usuario:
// una expresión regular que reemplaza una sección dentro de un archivo suyo. Si
// esa sustitución se pasa de larga, se come el resto de la nota. Probarlo con
// texto en memoria cuesta nada; descubrirlo sobre el vault cuesta el vault.

import { pintarEstrellas } from './juicio.mjs';
import { companiaReal } from './evidencia.mjs';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tituloSeccion(festival) {
  const [a, m] = String(festival.fecha_inicio).slice(0, 10).split('-').map(Number);
  return `### ${festival.nombre} — ${festival.ciudad}, ${MESES[m - 1]} ${a}`;
}

/**
 * Tabla de la bitácora de un festival.
 *
 * Regla del vault: aquí solo entra lo que Andrés escribió. Una función sin
 * juicio queda marcada como pendiente, nunca se completa con una impresión
 * plausible.
 */
export function construirBloque(festival, funciones, bitacora) {
  const juicioDe = id => bitacora.find(b => b.funcion_id === id) ?? null;
  const conJuicio = funciones.filter(f => juicioDe(f.id));

  const filas = [...funciones]
    .sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)))
    .map(f => {
      const j = juicioDe(f.id);
      const estrellas = j?.asistio === false ? '' : pintarEstrellas(j?.estrellas);
      // Tres casos que no son lo mismo y no se mezclan: no fuiste, fuiste y
      // solo pusiste estrellas, o falta registrarla.
      const texto = j?.asistio === false ? '_(no fui)_'
        : j?.texto ? j.texto.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()
        : j ? '_(solo estrellas)_'
        : '_(sin registrar)_';
      // companiaReal: San Ignacio guarda «compañía · descripción» junto, y la
      // descripción entera no cabe en la columna Grupo.
      return `| ${f.obra} | ${companiaReal(f) ?? ''} | ${estrellas} | ${texto} |`;
    });

  return [
    tituloSeccion(festival),
    '',
    `Escrito desde la app Organizador de Eventos. ${conJuicio.length} de ${funciones.length} funciones juzgadas.`,
    '',
    '| Obra | Grupo | Estrellas | Qué me pareció |',
    '|---|---|---|---|',
    ...filas,
    '',
  ].join('\n');
}

/**
 * Mete el bloque en la nota. Si la sección del festival ya existe la reemplaza;
 * si no, la pone al principio de la Bitácora para que lo reciente quede arriba.
 *
 * El corte se detiene en el siguiente encabezado de nivel 2 o 3. Sin ese freno,
 * la sustitución se llevaría por delante todo lo que venga después, incluida la
 * sección de vacíos que la skill usa para saber qué preguntar.
 */
export function insertarBloque(texto, festival, bloque) {
  const re = new RegExp(`${escapar(tituloSeccion(festival))}[^\\n]*\\n[\\s\\S]*?(?=\\n### |\\n## |$)`);
  let fuera;
  if (re.test(texto)) fuera = texto.replace(re, bloque);
  else if (texto.includes('## Bitácora')) fuera = texto.replace('## Bitácora\n', m => `${m}\n${bloque}`);
  else fuera = `${texto}\n## Bitácora\n\n${bloque}`;

  // El sync corre muchas veces sobre la misma nota. Sin normalizar, cada pasada
  // suma una línea en blanco y a la décima el archivo es un acordeón.
  return fuera.replace(/\n{3,}/g, '\n\n');
}
