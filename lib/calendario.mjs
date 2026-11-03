// La agenda en Google Calendar.
//
// Calendar ya hace lo que la app no puede sin señal: avisa a la hora, funciona
// sin conexión y responde «a qué hora, en qué sala, tengo boleta» sin abrir
// nada. Dos caminos llegan a él:
//
//   - En la app, un enlace de plantilla de Google Calendar por función: abre el
//     evento lleno y el usuario toca Guardar. Cae en el calendario principal.
//   - En sesión con Claude (MCP), planCalendario() dice qué crear, actualizar
//     y borrar en el calendario «Festivales», y los eventos del enlace se
//     adoptan ahí por su marca.
//
// Cada evento lleva en la descripción la marca [oe:<id de la función>].
// Regla dura: un evento sin esa marca no se lee, no se mueve y no se borra.

const ZONA = 'America/Bogota';
export const RECORDATORIO_MIN = 45;

const ETIQUETA = { comprada: 'comprada', agendada: 'falta', vencida: 'vencida', no_alcanzada: 'no alcanzada' };

export const marca = id => `[oe:${id}]`;

/** El id de la función a partir de la descripción de un evento, o null. */
export function idDeMarca(texto) {
  const m = /\[oe:([0-9a-zA-Z-]+)\]/.exec(texto ?? '');
  return m ? m[1] : null;
}

const dos = n => String(n).padStart(2, '0');

function aLocal(fechaISO, minutos) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) + minutos * 60000);
  return `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}` +
    `T${dos(t.getUTCHours())}:${dos(t.getUTCMinutes())}:00`;
}

/** Inicio y fin en hora local de Medellín, sin zona: el calendario la pone. */
export function horasEvento(f) {
  return {
    inicio: aLocal(f.fecha, f.hora_min),
    fin: aLocal(f.fecha, f.hora_min + (f.duracion_min ?? 0)),
  };
}

/**
 * El lugar para el mapa. La dirección guardada a veces trae el teléfono
 * («Clle. 48 #41-13 · 604 5574964») o ya empieza con el nombre de la sala
 * («Plazuela San Ignacio, al aire libre»): ni lo uno ni lo otro se repite.
 */
function lugarDe(f) {
  const nombre = f.sala?.nombre ?? '';
  const dir = (f.sala?.direccion ?? '').split(' · ')[0].trim();
  if (dir && nombre && dir.startsWith(nombre)) return dir;
  return [nombre, dir].filter(Boolean).join(', ');
}

export function descripcionEvento(f) {
  const boletas = f.boletas?.length ?? 0;
  const necesarias = f.necesarias ?? 1;
  const libre = f.precio_pleno === 0 && boletas === 0;
  const lineas = [
    f.sala?.nombre ?? 'Sala por confirmar',
    libre ? 'Entrada libre' : `Boleta: ${ETIQUETA[f.estado] ?? f.estado ?? 'falta'} (${boletas} de ${necesarias})`,
  ];
  if (!f.duracion_confirmada) lineas.push(`Duración estimada: ${f.duracion_min} min. Confírmala con la sala.`);
  lineas.push(marca(f.id));
  return lineas.join('\n');
}

const compacta = iso => iso.replace(/[-:]/g, '');

/** Enlace que abre Google Calendar con el evento ya lleno. */
export function urlPlantilla(f) {
  const { inicio, fin } = horasEvento(f);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: f.obra,
    dates: `${compacta(inicio)}/${compacta(fin)}`,
    ctz: ZONA,
    location: lugarDe(f),
    details: descripcionEvento(f),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Los campos de create_event / update_event del MCP de Google Calendar. */
export function eventoDeseado(f) {
  const { inicio, fin } = horasEvento(f);
  return {
    summary: f.obra,
    startTime: inicio,
    endTime: fin,
    location: lugarDe(f),
    description: descripcionEvento(f),
    reminders: [{ method: 'popup', minutes: RECORDATORIO_MIN }],
  };
}

/**
 * Qué hacer en el calendario para que quede un evento por función agendada.
 *
 * @param funciones  funciones del festival (con agendada y calendar_event_id)
 * @param eventos    eventos ya existentes en los calendarios revisados: { id, description }
 * @param desde      AAAA-MM-DD: las funciones anteriores no se crean ni se tocan
 * @returns { crear: [{ funcion_id, evento }], actualizar: [{ funcion_id, eventId, adoptar, evento }],
 *            borrar: [{ eventId, funcion_id, motivo }] }
 *
 * `adoptar`: el evento existía con la marca (vino del enlace de la app) pero su
 * id no estaba guardado; se actualiza y su id se guarda en vez de crear otro.
 */
export function planCalendario(funciones, eventos, desde = null) {
  // Lo que ya pasó no se crea ni se toca: un evento de anteayer es ruido, y el
  // que ya existe es historia.
  const vigente = f => !desde || f.fecha >= desde;
  const conMarca = eventos
    .map(e => ({ ...e, funcion_id: idDeMarca(e.description) }))
    .filter(e => e.funcion_id);
  const porFuncion = new Map();
  for (const e of conMarca) {
    if (!porFuncion.has(e.funcion_id)) porFuncion.set(e.funcion_id, []);
    porFuncion.get(e.funcion_id).push(e);
  }

  const crear = [], actualizar = [], borrar = [];
  const porId = new Map(funciones.map(f => [f.id, f]));

  for (const f of funciones.filter(x => x.agendada && vigente(x))) {
    const suyos = porFuncion.get(f.id) ?? [];
    const guardado = suyos.find(e => e.id === f.calendar_event_id);
    const elegido = guardado ?? suyos[0];
    if (elegido) {
      actualizar.push({ funcion_id: f.id, eventId: elegido.id, adoptar: !guardado, evento: eventoDeseado(f) });
    } else {
      crear.push({ funcion_id: f.id, evento: eventoDeseado(f) });
    }
    for (const e of suyos) {
      if (e !== elegido) borrar.push({ eventId: e.id, funcion_id: f.id, motivo: 'repetido' });
    }
  }

  for (const e of conMarca) {
    const f = porId.get(e.funcion_id);
    // Sin la función en este festival, el evento es de otro: no se toca.
    if (f && !f.agendada && vigente(f)) borrar.push({ eventId: e.id, funcion_id: e.funcion_id, motivo: 'ya no está agendada' });
  }
  return { crear, actualizar, borrar };
}
