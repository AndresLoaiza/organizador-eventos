'use client';
import { useMemo, useState } from 'react';
import { marcarAgendada } from '../../lib/cliente.mjs';
import { fmtHora } from '../../lib/decisor.mjs';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';
import Veredicto from '../Veredicto.js';
import { razonesDe } from '../../lib/interes.mjs';
import Exportar from '../Exportar.js';
import { filasProgramacion, COLS_PROGRAMACION } from '../../lib/exportar.mjs';
import { paraDecidir } from '../../lib/interes.mjs';
import Margen, { Cabecera, Friso } from '../Margen.js';

// El decisor: día por día, con el costo de cada elección a la vista.
//
// Con 776 funciones en diez días, la pregunta deja de ser "qué me alcanza el
// bolsillo" y pasa a ser "qué descarto". Por eso lo primero es el filtro por
// franja, y solo después el veredicto: sin recortar, ningún motor de choques
// sirve de nada frente a cien opciones diarias.

export default function Decisor({ p, recargar }) {
  // Sin lo descartado en Ojear, pero con lo que aún no has ojeado: una función
  // sin marcar que cae a la misma hora de otra tiene que poder agendarse.
  const { funciones: candidatas, filtrado } = useMemo(
    () => paraDecidir(p.funciones), [p.funciones]);

  const fechas = useMemo(
    () => [...new Set(candidatas.map(f => f.fecha))].sort(), [candidatas]);
  const hoyIdx = Math.max(0, fechas.findIndex(f => f >= p.hoy));

  const [dia, setDia] = useState(hoyIdx === -1 ? 0 : hoyIdx);
  const [franja, setFranja] = useState('');
  const [busca, setBusca] = useState('');
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState(null);

  // La franja va al principio de la nota, antes del primer separador.
  const franjaDe = f => (f.nota_boleteria ?? '').split(' · ')[0].trim();

  const franjas = useMemo(() => {
    const c = new Map();
    for (const f of candidatas) {
      const x = franjaDe(f);
      if (x) c.set(x, (c.get(x) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [candidatas]);

  const elegidas = useMemo(
    () => new Set(p.funciones.filter(f => f.agendada).map(f => f.id)), [p.funciones]);
  // Ojo: las agendadas salen de TODAS, no de las candidatas. El motor evalúa
  // los choques contra la agenda completa del festival.

  // Lo que dijiste que no en Ojear no cuenta en el veredicto, pero si cae a la
  // misma hora que una función de aquí se avisa, para que no parezca un olvido.
  const descartadas = useMemo(() => p.funciones.filter(f => f.interes === 'no' && !f.agendada),
    [p.funciones]);
  const descartadasQueSeCruzan = f => [...new Set(descartadas
    .filter(d => d.fecha === f.fecha && d.hora_min < f.hora_min + f.duracion_min
      && f.hora_min < d.hora_min + d.duracion_min)
    .map(d => d.obra))];

  // Si ya agendaste una fecha de la obra, las demás son solo información:
  // no compiten por ninguna noche, así que no llevan botón ni veredicto.
  const agendadaDe = useMemo(() => {
    const m = new Map();
    for (const f of p.funciones) if (f.agendada && !m.has(f.obra)) m.set(f.obra, f);
    return m;
  }, [p.funciones]);

  // Las demás funciones de cada obra, para decir «también está el…» en cada fila.
  const otrasFechas = f => p.funciones
    .filter(o => o.obra === f.obra && o.id !== f.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_min - b.hora_min)
    .map(o => `${nombreDia(o.fecha).slice(0, 3).toLowerCase()} ${o.fecha.slice(8)} · ${fmtHora(o.hora_min)}${o.agendada ? ' (agendada)' : ''}`);

  const fecha = fechas[dia];
  const norm = s => (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const delDia = useMemo(() => candidatas
    .filter(f => f.fecha === fecha)
    .filter(f => !franja || franjaDe(f) === franja)
    .filter(f => !busca || norm(`${f.obra} ${f.compania} ${f.sala?.nombre}`).includes(norm(busca)))
    .sort((a, b) => a.hora_min - b.hora_min),
  [candidatas, fecha, franja, busca]);

  async function alternar(f) {
    setGuardando(f.id);
    setError(null);
    try {
      await marcarAgendada(f.id, !f.agendada);
      await recargar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setGuardando(null);
    }
  }

  if (!fechas.length && filtrado) {
    return (
      <section className="seccion">
        <h1>Decidir</h1>
        <div className="vacio">
          <b>Descartaste todo en Ojear</b>
          Vuelve a Ojear y desmarca lo que quieras recuperar: lo que no
          descartes aparece aquí con el costo de cada elección.
          <Margen tipo="capitano" tam="medio" />
        </div>
      </section>
    );
  }

  if (!fechas.length) {
    return (
      <section className="seccion">
        <h1>Decidir</h1>
        <div className="vacio">
          <b>Este festival no tiene programación cargada</b>
          Carga la programación desde el PC antes de poder decidir.
        </div>
      </section>
    );
  }

  return (
    <>
      <Cabecera mascara="bauta" titulo="Decidir">
          {filtrado ? (
            <>
              {candidatas.length} de {p.funciones.length} funciones — sin las que
              descartaste en <b>Ojear</b>. <b>{elegidas.size}</b> en tu agenda.
            </>
          ) : (
            <>
              {p.funciones.length} funciones, sin ojear todavía.{' '}
              <b>{elegidas.size}</b> en tu agenda. Pasa primero por <b>Ojear</b>:
              aquí cada renglón ya viene con el costo de elegirlo encima.
            </>
          )}
      </Cabecera>

      <div className="dias">
        {fechas.map((f, i) => {
          const n = candidatas.filter(x => x.fecha === f && x.agendada).length;
          return (
            <button
              key={f} type="button" className="dia"
              aria-current={i === dia ? 'true' : 'false'}
              onClick={() => setDia(i)}
            >
              <span className="dd">{nombreDia(f).slice(0, 3)}</span>
              <span className="dn num">{f.slice(8)}</span>
              <span className="dc">{n ? '●'.repeat(Math.min(n, 4)) : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="filtros">
        <select value={franja} onChange={e => setFranja(e.target.value)} aria-label="Franja">
          <option value="">Todas las franjas ({candidatas.length})</option>
          {franjas.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
        </select>
        <input
          type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar obra, grupo o sala" aria-label="Buscar"
        />
      </div>

      {error && (
        <div className="aviso" data-sev="alto">
          <span className="marca" aria-hidden="true">!</span><span>{error}</span>
        </div>
      )}

      <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
        <h2 style={{ textTransform: 'capitalize' }}>{nombreDia(fecha)}</h2>
        <p className="entradilla num">
          {fechaLarga(fecha)} · {delDia.length} funciones
          {franja && ' en esta franja'}
        </p>

        {/* Se exporta lo que está a la vista, no las 776 de todo el festival:
            el filtro es la decisión, y una hoja con todo el volante no sirve
            para lo que él hace con ella, que es mandarla o imprimirla. */}
        {delDia.length > 0 && (
          <Exportar
            cols={COLS_PROGRAMACION}
            filas={filasProgramacion(delDia, p.decisor, elegidas)}
            que="lo que estás viendo"
          />
        )}

        {delDia.length === 0 ? (
          <div className="vacio">
            <b>Nada con ese filtro</b>Prueba otra franja o borra la búsqueda.
            <Margen tipo="capitano" tam="medio" />
          </div>
        ) : (
          <ul className="funciones">
            {delDia.map(f => {
              const otra = !f.agendada ? agendadaDe.get(f.obra) : null;
              if (otra) {
                return (
                  <li className="funcion" key={f.id} data-elegida="false" style={{ opacity: 0.7 }}>
                    <span className="hora num">{fmtHora(f.hora_min)}</span>
                    <span className="obra">
                      {f.obra}
                      <span className="cia">
                        {f.sala?.nombre ?? 'Sala por confirmar'} · {f.duracion_min} min
                      </span>
                    </span>
                    <span className="pie">
                      Ya la tienes agendada el {nombreDia(otra.fecha).toLowerCase()}{' '}
                      {fechaLarga(otra.fecha)} a las {fmtHora(otra.hora_min)}.
                    </span>
                  </li>
                );
              }
              const v = p.decisor.verdictFor({
                id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
                durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
              }, elegidas);
              return (
                <li className="funcion" key={f.id} data-elegida={String(f.agendada)}>
                  <span className="hora num">{fmtHora(f.hora_min)}</span>
                  <span className="obra">
                    {f.obra}
                    {f.interes === 'si' && <b className="razon" title="La marcaste en Ojear"> ★ Me interesa</b>}
                    {razonesDe(f).map(r => (
                      <b className="razon" key={r.id} title={r.fuente}> {r.etiqueta}</b>
                    ))}
                    <span className="cia">
                      {f.sala?.nombre ?? 'Sala por confirmar'} · {f.duracion_min} min
                      {f.duracion_confirmada ? '' : ' estimados'}
                    </span>
                    <span className="cia">
                      {otrasFechas(f).length
                        ? <>También: {otrasFechas(f).join(' · ')}</>
                        : 'Única función'}
                    </span>
                  </span>
                  <span className="estado">
                    <button
                      type="button" className="boton" data-tam="chico"
                      data-v={f.agendada ? 'primario' : undefined}
                      disabled={guardando === f.id}
                      onClick={() => alternar(f)}
                    >
                      {guardando === f.id ? '…' : f.agendada ? 'En la agenda' : 'Agendar'}
                    </button>
                  </span>
                  {descartadasQueSeCruzan(f).map(o => (
                    <span className="pie" key={o}>
                      Se cruza en horario con <b>{o}</b>, pero dijiste que no a esa obra en Ojear.
                    </span>
                  ))}
                  <Veredicto v={v} agendada={f.agendada} comprada={f.boletas?.length > 0} />
                  {/* El título solo no basta para decidir: "Pura carreta" no
                      dice nada, y la ficha sí cuenta que es Quijote con
                      percusión. Va plegada para no tapar el veredicto. */}
                  {f.compania && (
                    <details className="ficha">
                      <summary>De qué se trata</summary>
                      <p>{f.compania}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
