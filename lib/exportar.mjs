import { fmtHora } from './decisor.mjs';
import { nombreDia } from './panorama.mjs';

// Exportar a Excel. Portado de assets/tabla-filtro.html de la skill
// festival-agenda: el mecanismo de allá —escribir al portapapeles TSV y HTML a
// la vez, con tres niveles de respaldo— ya está resuelto y probado en Excel,
// Sheets y Numbers. Lo que cambia aquí es de dónde salen las filas.
//
// Se copia al portapapeles en vez de descargar un archivo por dos razones: en
// hosting estático no hay servidor que arme un .xlsx, y un CSV descargado abre
// en Excel con las tildes rotas y los miles convertidos en decimales. Pegar un
// text/html deja la tabla ya formada, con las tildes y los números intactos.

const MONEDA = new Intl.NumberFormat('es-CO');

export const COLS_AGENDA = ['Fecha', 'Día', 'Hora', 'Obra', 'Grupo', 'Sala',
  'Duración', 'Estado', 'Boletas', 'Pagado', 'Estrellas', 'Qué me pareció'];

export const COLS_PROGRAMACION = ['Fecha', 'Día', 'Hora', 'Obra', 'Grupo',
  'Sala', 'Duración', 'En mi agenda', 'Veredicto'];

const dur = f => `${f.duracion_min}${f.duracion_confirmada ? '' : ' est.'}`;
const orden = (a, b) => `${a.fecha}${String(a.hora_min).padStart(4, '0')}`
  .localeCompare(`${b.fecha}${String(b.hora_min).padStart(4, '0')}`);

/** Lo que ya está decidido: la agenda con su estado de compra y sus juicios. */
export function filasAgenda(funciones) {
  return [...funciones].filter(f => f.agendada).sort(orden).map(f => [
    f.fecha,
    nombreDia(f.fecha),
    fmtHora(f.hora_min),
    f.obra,
    f.compania ?? '',
    f.sala?.nombre ?? 'Por confirmar',
    dur(f),
    f.estado ?? '',
    // Cuántas de las que hacen falta: "1 de 2" dice más que un número suelto.
    `${f.boletas?.length ?? 0} de ${f.necesarias ?? 1}`,
    f.pagado ? MONEDA.format(f.pagado) : '',
    f.juicio?.estrellas ? '★'.repeat(f.juicio.estrellas) : '',
    f.juicio?.texto ?? '',
  ]);
}

/** Lo que todavía se está mirando: la programación con el veredicto de cada opción. */
export function filasProgramacion(funciones, decisor, elegidas) {
  return [...funciones].sort(orden).map(f => {
    const v = decisor.verdictFor({
      id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
      durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
    }, elegidas);
    return [
      f.fecha, nombreDia(f.fecha), fmtHora(f.hora_min), f.obra,
      f.compania ?? '', f.sala?.nombre ?? 'Por confirmar', dur(f),
      f.agendada ? 'sí' : '', v.txt,
    ];
  });
}

/**
 * Una celda con un tabulador o un salto de línea parte la fila al pegar y
 * desplaza todas las columnas siguientes. Los juicios son texto libre escrito
 * en el celular: los saltos llegan seguro.
 */
const celda = c => String(c ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

export function aTSV(cols, filas) {
  return [cols.join('\t'), ...filas.map(f => f.map(celda).join('\t'))].join('\n');
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function aHTML(cols, filas) {
  const cab = `<tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const cuerpo = filas
    .map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${cab}</thead><tbody>${cuerpo}</tbody></table>`;
}
