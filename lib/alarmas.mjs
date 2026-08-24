import { rel, fmtHora } from './decisor.mjs';
import { mismoTitulo } from './nombres.mjs';

// Las incoherencias que la app tiene que gritar. Todas salieron de casos reales
// de la 22.ª Fiesta, no de imaginar qué podría fallar.

const ALTO = 'alto';
const AVISO = 'aviso';

/**
 * @param funciones  [{ id, fecha, hora_min, duracion_min, duracion_confirmada,
 *                      obra, sala_slug, acompanantes, fuente_horario }]
 * @param boletas    [{ id, funcion_id, hora_boleta, valor_ticket, titular, codigo }]
 * @param estados    { funcion_id: 'agendada' | 'comprada' | ... }
 * @param hoy        'AAAA-MM-DD'
 * @param travel     (salaA, salaB) => minutos
 */
export function detectarAvisos({ funciones, boletas, estados = {}, hoy, travel }) {
  const avisos = [];
  const porFuncion = new Map(funciones.map(f => [f.id, f]));
  const boletasDe = id => boletas.filter(b => b.funcion_id === id);

  // 1. La boleta dice una hora y la programación otra.
  //    Caso real: Teatro y Cocina, 9:30 p.m. en el volante contra 10:00 p.m.
  //    en la fe de erratas que el teatro mandó por correo.
  for (const b of boletas) {
    const f = porFuncion.get(b.funcion_id);
    if (!f || b.hora_boleta == null) continue;
    if (b.hora_boleta !== f.hora_min) {
      avisos.push({
        funcion_id: f.id,
        tipo: 'hora_discordante',
        severidad: ALTO,
        mensaje:
          `${f.obra}: la boleta dice ${fmtHora(b.hora_boleta)} y la programación ` +
          `${fmtHora(f.hora_min)} (fuente: ${f.fuente_horario}). Confirma con la sala cuál manda.`,
      });
    }
  }

  // 2. Dos boletas de funciones que se cruzan. Distinto de tener dos boletas de
  //    la MISMA función, que es lo normal cuando va acompañado.
  const conBoleta = funciones.filter(f => boletasDe(f.id).length > 0);
  for (let i = 0; i < conBoleta.length; i++) {
    for (let j = i + 1; j < conBoleta.length; j++) {
      const a = conBoleta[i], b = conBoleta[j];
      if (a.fecha !== b.fecha) continue;
      const r = rel(aFormaMotor(a), aFormaMotor(b), travel);
      if (r.kind !== 'conflict') continue;
      avisos.push({
        funcion_id: a.id,
        tipo: 'cruce_franja',
        severidad: ALTO,
        mensaje:
          `Compraste ${a.obra} y ${b.obra} para el mismo día y se cruzan: ` +
          `${r.gap} min entre función y función y necesitas ${r.need} de traslado. ` +
          `Una de las dos se pierde.`,
      });
    }
  }

  // 3. Va acompañado y solo hay una boleta.
  //    Caso real: Habitar tenía dos compradas y solo una descargada.
  for (const f of funciones) {
    if (!f.agendada) continue;
    const necesarias = 1 + (f.acompanantes ?? 0);
    const tiene = boletasDe(f.id).length;
    if (tiene > 0 && tiene < necesarias) {
      avisos.push({
        funcion_id: f.id,
        tipo: 'boletas_insuficientes',
        severidad: ALTO,
        mensaje:
          `${f.obra}: necesitas ${necesarias} boletas y solo hay ${tiene} registrada${tiene === 1 ? '' : 's'}. ` +
          `Puede estar comprada y sin descargar, o puede faltar de verdad.`,
      });
    }
  }

  // 4. Agendada, sin boleta, y la fecha ya pasó o es hoy.
  for (const f of funciones) {
    if (!f.agendada) continue;
    if (boletasDe(f.id).length > 0) continue;
    const estado = estados[f.id] ?? 'agendada';
    if (estado !== 'agendada') continue;
    if (f.fecha < hoy) {
      avisos.push({
        funcion_id: f.id,
        tipo: 'agendada_vencida',
        severidad: AVISO,
        mensaje: `${f.obra} era el ${f.fecha} y nunca hubo boleta. No la alcanzaste.`,
      });
    } else if (f.fecha === hoy) {
      avisos.push({
        funcion_id: f.id,
        tipo: 'agendada_vencida',
        severidad: ALTO,
        mensaje: `${f.obra} es HOY a las ${fmtHora(f.hora_min)} y no tienes boleta.`,
      });
    }
  }

  // 5. Boleta que no corresponde a ninguna función cargada.
  for (const b of boletas) {
    if (b.funcion_id) continue;
    avisos.push({
      funcion_id: null,
      tipo: 'boleta_huerfana',
      severidad: AVISO,
      mensaje:
        `Boleta sin función: ${b.obra_texto ?? 'sin título legible'}` +
        `${b.fecha_texto ? ' · ' + b.fecha_texto : ''}. ¿A qué festival pertenece?`,
      boleta_id: b.id,
    });
  }

  // 5b. Marcada como comprada y sin ningún archivo en el baúl.
  //     Caso real: Petra se compró el 24 de agosto y el PDF quedó en el correo.
  for (const f of funciones) {
    if (!f.agendada) continue;
    if (estados[f.id] !== 'comprada') continue;
    if (boletasDe(f.id).length > 0) continue;
    avisos.push({
      funcion_id: f.id,
      tipo: 'sin_archivo',
      severidad: AVISO,
      mensaje:
        `${f.obra} figura como comprada pero no hay ningún archivo en el baúl. ` +
        `Búscala en el correo y súbela antes de que la necesites en la puerta.`,
    });
  }

  // 6. Veredictos sostenidos por una duración inventada. No es un error, es una
  //    advertencia de que el dato no salió del volante sino de una estimación.
  for (const f of funciones) {
    if (!f.agendada) continue;
    if (f.duracion_confirmada) continue;
    const mismoDia = funciones.filter(o => o.fecha === f.fecha && o.id !== f.id);
    const apretado = mismoDia.some(o => {
      const r = rel(aFormaMotor(f), aFormaMotor(o), travel);
      return r.kind === 'tight' || (r.kind === 'ok' && r.gap - r.need < 20);
    });
    if (apretado) {
      avisos.push({
        funcion_id: f.id,
        tipo: 'duracion_estimada',
        severidad: AVISO,
        mensaje:
          `${f.obra}: el margen de esa noche depende de una duración estimada en ` +
          `${f.duracion_min} min, no confirmada. Una llamada a la sala lo resuelve.`,
      });
    }
  }

  return avisos;
}

function aFormaMotor(f) {
  return {
    id: f.id,
    day: f.fecha,
    t: f.hora_min,
    dur: f.duracion_min,
    title: f.obra,
    v: f.sala_slug,
  };
}

/** Estado de compra derivado de los datos, sin escribirlo todavía. */
export function estadoDerivado(funcion, boletas, hoy) {
  const necesarias = 1 + (funcion.acompanantes ?? 0);
  const tiene = boletas.filter(b => b.funcion_id === funcion.id).length;
  if (tiene >= necesarias) return 'comprada';
  if (funcion.fecha < hoy) return tiene > 0 ? 'comprada' : 'no_alcanzada';
  return tiene > 0 ? 'agendada' : 'agendada';
}

/** Encuentra la función que corresponde a una boleta recién extraída. */
export function vincular(boleta, funciones) {
  const candidatas = funciones.filter(f =>
    mismoTitulo(f.obra, boleta.obra_texto) && f.fecha === boleta.fecha_texto);
  if (candidatas.length === 1) return { funcion: candidatas[0], confianza: 'alta' };
  if (candidatas.length > 1) {
    // Doble función el mismo día: desempata la hora de la boleta.
    const porHora = candidatas.find(f => f.hora_min === boleta.hora_boleta);
    if (porHora) return { funcion: porHora, confianza: 'alta' };
    return { funcion: null, confianza: 'ambigua', candidatas };
  }
  const soloTitulo = funciones.filter(f => mismoTitulo(f.obra, boleta.obra_texto));
  if (soloTitulo.length === 1) return { funcion: soloTitulo[0], confianza: 'media' };
  return { funcion: null, confianza: 'ninguna' };
}
