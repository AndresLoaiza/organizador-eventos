// Motor de choques portado de la skill festival-agenda (assets/decisor.html).
//
// La lógica es la misma línea por línea: son ~150 líneas con casos borde ya
// resueltos (traslado entre salas, márgenes justos, rescate en otra fecha, obra
// bloqueada por una elección previa). Lo único que cambió es que el original
// leía SHOWS y `picked` de variables globales del archivo, y aquí entran por
// parámetro para poder probarlo y para servir a varios festivales.
//
// Forma de una función:
//   { id, day, t, dur, title, cia, v, p }
//   t   = minutos desde medianoche (19:30 -> 1170)
//   dur = duración en minutos
//   v   = clave de sala

/** Minutos de traslado entre dos salas, según la matriz de zonas. */
export function crearTraslado(venues, matriz, pordefecto = 30) {
  return function travel(v1, v2) {
    if (v1 === v2) return 0;
    const z1 = venues[v1]?.z;
    const z2 = venues[v2]?.z;
    const row = matriz[z1];
    if (!row) return pordefecto;
    return row[z2] != null ? row[z2] : pordefecto;
  };
}

export function fmtHora(t) {
  const h = Math.floor(t / 60), m = t % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export function money(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

/**
 * Relación entre dos funciones del mismo día.
 *
 * El margen se compara contra el traslado necesario: alcanzar no es solo que
 * una termine antes de que empiece la otra, sino llegar a tiempo.
 */
export function rel(a, b, travel) {
  const first = a.t <= b.t ? a : b;
  const second = a.t <= b.t ? b : a;
  const gap = second.t - (first.t + first.dur);
  const need = travel(first.v, second.v);
  if (gap < need) return { kind: 'conflict', gap, need };
  if (gap < need + 15) return { kind: 'tight', gap, need };
  return { kind: 'ok', gap, need };
}

/**
 * Crea un decisor sobre un conjunto de funciones.
 *
 * @param shows      arreglo de funciones
 * @param travel     (salaA, salaB) => minutos
 * @param dayNames   { clave_dia: 'Viernes' }
 */
export function crearDecisor(shows, travel, dayNames = {}) {
  const BY_ID = Object.fromEntries(shows.map(s => [s.id, s]));

  function pickedShows(picked) {
    return [...picked].map(id => BY_ID[id]).filter(Boolean);
  }

  function statusOf(show, picked) {
    if (picked.has(show.id)) return { kind: 'picked' };
    const sameDay = pickedShows(picked).filter(s => s.day === show.day && s.id !== show.id);
    const blockers = [], tights = [];
    for (const s of sameDay) {
      const r = rel(s, show, travel);
      if (r.kind === 'conflict') blockers.push(s);
      else if (r.kind === 'tight') tights.push({ s, r });
    }
    if (blockers.length) return { kind: 'blocked', blockers };
    if (tights.length) return { kind: 'tight', tights };
    return { kind: 'free' };
  }

  // Otras fechas de la MISMA obra que siguen viables. De esto depende que el
  // veredicto distinga "perdida" de "la ves el sábado", que es toda la gracia.
  function rescueDays(show, picked) {
    return shows
      .filter(s => s.title === show.title && s.id !== show.id)
      .filter(s => picked.has(s.id) || statusOf(s, picked).kind !== 'blocked')
      .map(s => ({ day: s.day, picked: picked.has(s.id) }));
  }

  function wouldKill(show, picked) {
    return shows
      .filter(s => s.day === show.day && s.id !== show.id && !picked.has(s.id))
      .filter(s => statusOf(s, picked).kind !== 'blocked')
      .filter(s => rel(show, s, travel).kind === 'conflict');
  }

  function uniqTitles(arr) { return [...new Set(arr.map(s => s.title))]; }

  function listTitles(arr) {
    const names = uniqTitles(arr);
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' y ' + names[1];
    return names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1];
  }

  function plural(arr, uno, varios) {
    return uniqTitles(arr).length === 1 ? uno : varios;
  }

  // Un veredicto que depende de una duración inventada no es un hecho. Quien
  // pinte esto tiene que poder marcarlo distinto, así que se devuelve aparte.
  function dependeDeEstimacion(show, picked) {
    const involucradas = [show, ...pickedShows(picked).filter(s => s.day === show.day)];
    return involucradas.some(s => s.durEstimada === true);
  }

  function verdictFor(show, picked) {
    const st = statusOf(show, picked);
    const estimado = dependeDeEstimacion(show, picked);

    if (st.kind === 'picked') {
      const kills = shows.filter(s =>
        s.day === show.day && s.id !== show.id && !picked.has(s.id) &&
        rel(show, s, travel).kind === 'conflict');
      if (!kills.length) {
        return { cls: 'v-pick', ic: '✓', txt: 'En tu plan. No choca con nada más de esta noche.', estimado };
      }
      const gone = kills.filter(s => !rescueDays(s, picked).length);
      const saved = kills.filter(s => rescueDays(s, picked).length);
      let txt = 'En tu plan. ';
      if (gone.length) txt += `Por elegirla pierdes ${listTitles(gone)}. `;
      if (saved.length) txt += `${listTitles(saved)} ${plural(saved, 'la recuperas', 'las recuperas')} otro día.`;
      return { cls: 'v-pick', ic: '✓', txt: txt.trim(), estimado };
    }

    if (st.kind === 'blocked') {
      const by = listTitles(st.blockers);
      const rescue = rescueDays(show, picked);
      if (rescue.length) {
        const already = rescue.find(r => r.picked);
        if (already) {
          return {
            cls: 'v-keep', ic: '↻',
            txt: `Choca con ${by}, pero ya la tienes agendada el ${(dayNames[already.day] || already.day).toLowerCase()}.`,
            estimado,
          };
        }
        const dias = [...new Set(rescue.map(r => (dayNames[r.day] || r.day).toLowerCase()))].join(' o ');
        return { cls: 'v-keep', ic: '↻', txt: `Choca con ${by}. No la pierdes: vuelve el ${dias}.`, estimado };
      }
      // "No se repite" y "se repite pero esa fecha también está ocupada" son
      // cosas distintas y se deciden distinto: la segunda tiene salida si el
      // usuario está dispuesto a mover lo que ocupa el otro día.
      const otrasFechas = shows.filter(s => s.title === show.title && s.id !== show.id);
      if (!otrasFechas.length) {
        return { cls: 'v-lost', ic: '✕', txt: `Perdida. Choca con ${by} y no se repite en ninguna otra fecha.`, estimado };
      }
      const bloqueadas = otrasFechas
        .map(s => ({ s, st: statusOf(s, picked) }))
        .filter(x => x.st.kind === 'blocked');
      if (bloqueadas.length) {
        const nombres = [...new Set(bloqueadas.map(x => (dayNames[x.s.day] || x.s.day).toLowerCase()))];
        const dias = nombres.length === 1
          ? `el ${nombres[0]}`
          : nombres.slice(0, -1).map(d => `el ${d}`).join(', ') + ` y el ${nombres.at(-1)}`;
        const quien = listTitles(bloqueadas.flatMap(x => x.st.blockers));
        const frase = nombres.length === 1
          ? `su otra fecha, ${dias}, la tienes ocupada con ${quien}`
          : `sus otras fechas, ${dias}, las tienes ocupadas con ${quien}`;
        return { cls: 'v-lost', ic: '✕', txt: `Perdida. Choca con ${by}, y ${frase}.`, estimado };
      }
      return { cls: 'v-lost', ic: '✕', txt: `Perdida. Choca con ${by} y no se repite en ninguna otra fecha.`, estimado };
    }

    if (st.kind === 'tight') {
      const { s, r } = st.tights[0];
      return {
        cls: 'v-tight', ic: '!',
        txt: `Alcanzas justo tras ${s.title}: ${r.gap} min entre función y función, y necesitas ${r.need} de traslado.`,
        estimado,
      };
    }

    const kills = wouldKill(show, picked);
    if (!kills.length) {
      const others = pickedShows(picked).filter(s => s.day === show.day);
      if (others.length) {
        return { cls: 'v-free', ic: '+', txt: 'Compatible con lo que ya elegiste esta noche. Puedes sumarla sin perder nada.', estimado };
      }
      return { cls: 'v-free', ic: '·', txt: 'Disponible. Márcala para ver qué desplaza.', estimado };
    }
    const gone = kills.filter(s => !rescueDays(s, picked).length);
    const saved = kills.filter(s => rescueDays(s, picked).length);
    let txt = 'Si la eliges, ';
    if (gone.length) txt += `pierdes ${listTitles(gone)} definitivamente`;
    if (gone.length && saved.length) txt += ', y ';
    if (saved.length) txt += `desplazas ${listTitles(saved)} a otra fecha`;
    return {
      cls: gone.length ? 'v-lost' : 'v-free',
      ic: gone.length ? '⚠' : '↔',
      txt: txt + '.',
      estimado,
    };
  }

  return { statusOf, rescueDays, wouldKill, verdictFor, listTitles, byId: BY_ID };
}

/** Convierte filas de la tabla eventos.funciones a la forma que espera el motor. */
export function desdeFilas(filas, salasPorId) {
  return filas.map(f => ({
    id: f.id,
    day: f.fecha,
    t: f.hora_min,
    dur: f.duracion_min,
    durEstimada: !f.duracion_confirmada,
    title: f.obra,
    cia: f.compania,
    v: salasPorId[f.sala_id]?.slug ?? 'sin-sala',
    p: f.precio_pleno,
    note: f.nota_boleteria,
  }));
}
