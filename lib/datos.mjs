import { db } from './db.mjs';
import { crearTraslado, crearDecisor, fmtHora } from './decisor.mjs';
import { detectarAvisos, estadoDerivado } from './alarmas.mjs';

// Una sola lectura por pantalla. El festival entero cabe en memoria sin
// esfuerzo: son decenas de funciones, no miles, y tenerlo completo es lo que
// permite cruzar repeticiones y choques sin ir y volver a la base.

export function hoyMedellin() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function nombreDia(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return NOMBRE_DIA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export function fechaLarga(fechaISO) {
  const [, m, d] = fechaISO.split('-').map(Number);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d} de ${meses[m - 1]}`;
}

export async function festivalActivo(slug) {
  const c = db();
  let q = c.from('festivales').select('*');
  if (slug) q = q.eq('slug', slug);
  else q = q.order('fecha_inicio', { ascending: false }).limit(1);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function listarFestivales() {
  const { data, error } = await db()
    .from('festivales').select('*').order('fecha_inicio', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Todo lo que una pantalla necesita del festival, ya cruzado. */
export async function panorama(slugFestival) {
  const c = db();
  const festival = await festivalActivo(slugFestival);
  if (!festival) return null;

  const [salasR, funcionesR, boletasR, estadosR, bitacoraR, trasladosR] = await Promise.all([
    c.from('salas').select('*'),
    c.from('funciones').select('*').eq('festival_id', festival.id).order('fecha').order('hora_min'),
    c.from('boletas').select('*').eq('festival_id', festival.id),
    c.from('estados_compra').select('*'),
    c.from('bitacora').select('*'),
    c.from('traslados').select('*').eq('ciudad', festival.ciudad),
  ]);
  for (const r of [salasR, funcionesR, boletasR, estadosR, bitacoraR, trasladosR]) {
    if (r.error) throw r.error;
  }

  const salas = salasR.data ?? [];
  const salaPorId = Object.fromEntries(salas.map(s => [s.id, s]));
  const venues = Object.fromEntries(salas.map(s => [s.slug, { n: s.nombre, z: s.zona }]));

  const matriz = {};
  for (const t of trasladosR.data ?? []) {
    (matriz[t.zona_a] ??= {})[t.zona_b] = t.minutos;
  }
  const travel = crearTraslado(venues, matriz);

  const funciones = (funcionesR.data ?? []).map(f => ({
    ...f,
    sala: salaPorId[f.sala_id] ?? null,
    sala_slug: salaPorId[f.sala_id]?.slug ?? 'sin-sala',
  }));

  const boletas = boletasR.data ?? [];
  const estados = Object.fromEntries((estadosR.data ?? []).map(e => [e.funcion_id, e.estado]));
  const bitacora = bitacoraR.data ?? [];
  const hoy = hoyMedellin();

  const avisos = detectarAvisos({ funciones, boletas, estados, hoy, travel });

  const porFuncion = funciones.map(f => {
    const suyas = boletas.filter(b => b.funcion_id === f.id);
    return {
      ...f,
      boletas: suyas,
      necesarias: 1 + (f.acompanantes ?? 0),
      estado: estados[f.id] ?? estadoDerivado(f, boletas, hoy),
      juicio: bitacora.find(b => b.funcion_id === f.id) ?? null,
      pagado: suyas.reduce((s, b) => s + (b.valor_ticket ?? 0) + (b.valor_servicio ?? 0), 0),
    };
  });

  const decisor = crearDecisor(
    funciones.map(f => ({
      id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
      durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
    })),
    travel,
    Object.fromEntries(funciones.map(f => [f.fecha, nombreDia(f.fecha)])),
  );

  return {
    festival, salas, funciones: porFuncion, boletas, avisos, hoy, travel, decisor,
    total: porFuncion.reduce((s, f) => s + f.pagado, 0),
  };
}

/**
 * Las funciones de una fecha, con el margen calculado contra la anterior.
 * Por defecto solo las agendadas: el margen entre dos obras que no vas a ver no
 * significa nada.
 */
export function nocheDe(panorama, fecha, { todas = false } = {}) {
  const dia = panorama.funciones
    .filter(f => f.fecha === fecha && (todas || f.agendada))
    .sort((a, b) => a.hora_min - b.hora_min);

  return dia.map((f, i) => {
    const previa = dia[i - 1];
    let margen = null;
    if (previa) {
      const gap = f.hora_min - (previa.hora_min + previa.duracion_min);
      const need = panorama.travel(previa.sala_slug, f.sala_slug);
      margen = {
        gap, need,
        estimado: !previa.duracion_confirmada,
        texto: gap < need
          ? `No alcanzas: ${gap} min de margen y el traslado pide ${need}.`
          : need === 0
            ? `${gap} min desde ${previa.obra}, en la misma sala.`
            : `${gap} min desde ${previa.obra}, y el traslado pide ${need}.`,
      };
    }
    return { ...f, margen, horaTexto: fmtHora(f.hora_min) };
  });
}

/**
 * Lo que también ofrece esa noche y no está en la agenda, con el veredicto del
 * motor: qué se pierde de verdad y qué vuelve otro día.
 */
export function alternativasDe(panorama, fecha) {
  const elegidas = new Set(
    panorama.funciones.filter(f => f.agendada && f.fecha === fecha).map(f => f.id));

  return panorama.funciones
    .filter(f => f.fecha === fecha && !f.agendada)
    .sort((a, b) => a.hora_min - b.hora_min)
    .map(f => ({ ...f, veredicto: panorama.decisor.verdictFor({
      id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
      durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
    }, elegidas) }));
}

export { fmtHora };
