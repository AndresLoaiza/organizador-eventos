import { crearTraslado, crearDecisor, fmtHora } from './decisor.mjs';
import { detectarAvisos, estadoDerivado } from './alarmas.mjs';

// Armado del panorama sin nada de base de datos. Vive aparte porque lo usan dos
// mundos: los scripts locales, que leen por Postgres directo, y la app
// publicada en GitHub Pages, que lee por PostgREST desde el navegador. La
// lógica de cruce tiene que ser la misma en los dos o los veredictos difieren.

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


// node-postgres devuelve las columnas date como Date; PostgREST las devuelve
// como texto. Todo el resto del código compara fechas como AAAA-MM-DD, así que
// se normaliza aquí y no en veinte sitios.
export function aISO(valor) {
  if (valor == null) return valor;
  if (typeof valor === 'string') return valor.slice(0, 10);
  const d = valor;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cruza las tablas crudas y devuelve todo lo que una pantalla necesita. */
export function armarPanorama({ festival, salas, funciones: filas, boletas, estados: estadosFilas, bitacora, traslados }) {
  const salaPorId = Object.fromEntries(salas.map(s => [s.id, s]));
  const venues = Object.fromEntries(salas.map(s => [s.slug, { n: s.nombre, z: s.zona }]));

  const matriz = {};
  for (const t of traslados) (matriz[t.zona_a] ??= {})[t.zona_b] = t.minutos;
  const travel = crearTraslado(venues, matriz);

  const funciones = filas.map(f => ({
    ...f,
    fecha: aISO(f.fecha),
    sala: salaPorId[f.sala_id] ?? null,
    sala_slug: salaPorId[f.sala_id]?.slug ?? 'sin-sala',
  }));

  const estados = Object.fromEntries(estadosFilas.map(e => [e.funcion_id, e.estado]));
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
  // Todas las agendadas del festival, no solo las de esta noche. Si se filtra
  // por fecha, el motor cree que las otras noches están libres y devuelve
  // rescates que no existen: IXAQUENE del sábado diría "vuelve el viernes" y la
  // del viernes "vuelve el sábado", cuando el viernes ya está tomado por Habitar
  // y la obra se pierde de verdad.
  const elegidas = new Set(panorama.funciones.filter(f => f.agendada).map(f => f.id));

  return panorama.funciones
    .filter(f => f.fecha === fecha && !f.agendada)
    .sort((a, b) => a.hora_min - b.hora_min)
    .map(f => ({ ...f, veredicto: panorama.decisor.verdictFor({
      id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
      durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
    }, elegidas) }));
}

export { fmtHora };
