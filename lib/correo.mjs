import { tituloNormalizado } from './nombres.mjs';

// Boletas desde los correos de compra.
//
// Ni La Tiquetera ni eTicketaBlanca mandan un PDF: cada entrada es un enlace
// personal en el cuerpo del correo, una línea por entrada. Claude lee los
// correos en sesión con el MCP de Gmail (solo lectura) y esta pieza los vuelve
// entradas y decide, sin red ni base, cuáles se aplican solas.
//
// Regla: se aplica sola la entrada cuya obra y fecha (y hora, si el correo la
// trae) casan con exactamente una función. Lo dudoso se pregunta. Lo que no es
// de ningún festival cargado se ignora. Una entrada ya cargada (mismo enlace)
// nunca se duplica.

const MESES = {
  jan: 1, ene: 1, feb: 2, mar: 3, apr: 4, abr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, oct: 10, nov: 11, dec: 12, dic: 12,
};
const dos = n => String(n).padStart(2, '0');

/** Año de una fecha sin año: la del correo, o el siguiente si el mes ya pasó de largo. */
function conAnio(mes, dia, fechaCorreo) {
  const c = new Date(fechaCorreo);
  let anio = c.getUTCFullYear();
  if (mes < c.getUTCMonth() + 1 - 6) anio += 1;   // compra en diciembre para enero
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

function deTiquetera(m) {
  const ref = /referencia\s+(\d+)/i.exec(m.asunto ?? '')?.[1];
  const operador = ref ? `La Tiquetera · ref ${ref}` : 'La Tiquetera';
  const re = /(?:^|\n)\s*-\s+([^\n]+?)\s+-\s+([A-Za-z]{3})\s+(\d{1,2})\s+-\s+([^\n]+?)\s+-\s*Acceder a la\s+entrada\s*<([^>\s]+)>/g;
  const out = [];
  for (const x of m.texto.matchAll(re)) {
    const mes = MESES[x[2].toLowerCase()];
    if (!mes) continue;
    out.push({
      correo: m.id, operador, obra: x[1].trim(), fecha: conAnio(mes, Number(x[3]), m.fecha),
      hora_min: null, categoria: x[4].trim(), url: x[5],
    });
  }
  return out;
}

function deEticketa(m) {
  const obra = (m.asunto ?? '').replace(/^\s*(tus tickets para|your tickets for)\s+/i, '').trim();
  const ev = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(m.texto);
  if (!obra || !ev) return [];
  const fecha = `${ev[3]}-${ev[2]}-${ev[1]}`;
  const hora_min = Number(ev[4]) * 60 + Number(ev[5]);
  const re = /\|\s*([^|\n]+?)\s*\|\s*\n\|\s*Ver tickets\s*\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  return [...m.texto.matchAll(re)].map(x => ({
    correo: m.id, operador: 'eTicketaBlanca', obra, fecha, hora_min, categoria: x[1].trim(), url: x[2],
  }));
}

/** Las entradas de un correo { id, remitente, fecha, asunto, texto }. */
export function leerCorreo(m) {
  const de = (m.remitente ?? '').toLowerCase();
  if (de.endsWith('@latiquetera.com')) return deTiquetera(m);
  if (de.endsWith('@eticketablanca.com')) return deEticketa(m);
  return [];
}

/**
 * Qué hacer con cada entrada.
 *
 * @param entradas    de leerCorreo
 * @param funciones   del festival: { id, obra, fecha, hora_min, festival_id }
 * @param existentes  boletas ya cargadas: { url_entrada }
 * @returns { nuevas, ya, dudosas, ignoradas }
 */
export function planBoletas(entradas, funciones, existentes) {
  const urls = new Set(existentes.map(b => b.url_entrada).filter(Boolean));
  const porObra = new Map();
  for (const f of funciones) {
    const k = tituloNormalizado(f.obra);
    if (!porObra.has(k)) porObra.set(k, []);
    porObra.get(k).push(f);
  }

  const nuevas = [], ya = [], dudosas = [], ignoradas = [];
  for (const e of entradas) {
    if (urls.has(e.url)) { ya.push(e); continue; }
    const deLaObra = porObra.get(tituloNormalizado(e.obra)) ?? [];
    if (!deLaObra.length) { ignoradas.push(e); continue; }
    const candidatas = deLaObra.filter(f => f.fecha === e.fecha && (e.hora_min == null || f.hora_min === e.hora_min));
    // Doble función y el correo sin hora (La Tiquetera): uno compra la que
    // agendó. Si exactamente una está agendada, es esa, y queda dicho por qué.
    const agendadas = candidatas.filter(f => f.agendada);
    const elegida = candidatas.length === 1 ? candidatas[0]
      : agendadas.length === 1 ? agendadas[0] : null;
    if (elegida) {
      nuevas.push({ ...e, funcion_id: elegida.id, festival_id: elegida.festival_id,
        por: candidatas.length === 1 ? 'obra y fecha' : 'agenda' });
      urls.add(e.url);
    } else {
      dudosas.push({ ...e, candidatas: (candidatas.length ? candidatas : deLaObra).map(f => f.id),
        motivo: candidatas.length ? 'varias funciones esa fecha' : 'la obra está, pero no en esa fecha u hora' });
    }
  }
  return { nuevas, ya, dudosas, ignoradas };
}
