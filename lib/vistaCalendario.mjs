// La agenda vista como calendario: un día por columna, la hora hacia abajo.
//
// Pura: posiciones en minutos, sin píxeles. Lo que se pisa en el tiempo va en
// carriles lado a lado para que el choque se vea; dos funciones que solo se
// tocan (una termina cuando la otra empieza) comparten carril, y lo que falla
// ahí es el traslado, que ya lo dicen los avisos.

/**
 * @param funciones  del panorama: { id, fecha, hora_min, duracion_min, agendada, ... }
 * @param hoy        AAAA-MM-DD; lo anterior no se muestra
 * @returns { dias, inicio, fin, bloques: [{ ...funcion, desde, dura, carril, carriles }] }
 */
export function armarCalendario(funciones, hoy) {
  const vigentes = funciones
    .filter(f => f.agendada && f.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_min - b.hora_min);
  if (!vigentes.length) return { dias: [], inicio: 0, fin: 0, bloques: [] };

  const dias = [...new Set(vigentes.map(f => f.fecha))];
  const fin = f => f.hora_min + (f.duracion_min || 60);
  const inicio = Math.floor(Math.min(...vigentes.map(f => f.hora_min)) / 60) * 60;
  const ultimo = Math.ceil(Math.max(...vigentes.map(fin)) / 60) * 60;

  const bloques = [];
  for (const dia of dias) {
    const delDia = vigentes.filter(f => f.fecha === dia);
    // Grupos de funciones que se solapan entre sí, en cadena.
    let grupo = [], finGrupo = -1;
    const cerrar = () => {
      const libres = [];               // fin de cada carril dentro del grupo
      const asignados = grupo.map(f => {
        let c = libres.findIndex(t => t <= f.hora_min);
        if (c === -1) { c = libres.length; libres.push(0); }
        libres[c] = fin(f);
        return { f, c };
      });
      for (const { f, c } of asignados) {
        bloques.push({ ...f, desde: f.hora_min - inicio, dura: fin(f) - f.hora_min, carril: c, carriles: libres.length });
      }
      grupo = []; finGrupo = -1;
    };
    for (const f of delDia) {
      if (grupo.length && f.hora_min >= finGrupo) cerrar();
      grupo.push(f);
      finGrupo = Math.max(finGrupo, fin(f));
    }
    if (grupo.length) cerrar();
  }
  return { dias, inicio, fin: ultimo, bloques };
}
