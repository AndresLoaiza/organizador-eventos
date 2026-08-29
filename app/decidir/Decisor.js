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

// El decisor: día por día, con el costo de cada elección a la vista.
//
// Con 776 funciones en diez días, la pregunta deja de ser "qué me alcanza el
// bolsillo" y pasa a ser "qué descarto". Por eso lo primero es el filtro por
// franja, y solo después el veredicto: sin recortar, ningún motor de choques
// sirve de nada frente a cien opciones diarias.

export default function Decisor({ p, recargar }) {
  // El decisor trabaja sobre lo ojeado, no sobre el volante entero: mirar 776
  // veredictos de choque a la vez no es decidir, es rendirse.
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
          <b>Todavía no has marcado nada como &laquo;me interesa&raquo;</b>
          Empieza por Ojear: ahí se elige sin mirar el reloj, y lo que marques
          aparece aquí con el costo de cada elección.
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
      <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
        <h1>Decidir</h1>
        <p className="entradilla">
          {filtrado ? (
            <>
              {candidatas.length} de {p.funciones.length} funciones — solo las que
              marcaste en <b>Ojear</b>. <b>{elegidas.size}</b> en tu agenda.
            </>
          ) : (
            <>
              {p.funciones.length} funciones, sin ojear todavía.{' '}
              <b>{elegidas.size}</b> en tu agenda. Pasa primero por <b>Ojear</b>:
              aquí cada renglón ya viene con el costo de elegirlo encima.
            </>
          )}
        </p>
      </section>

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
          <div className="vacio"><b>Nada con ese filtro</b>Prueba otra franja o borra la búsqueda.</div>
        ) : (
          <ul className="funciones">
            {delDia.map(f => {
              const v = p.decisor.verdictFor({
                id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
                durEstimada: !f.duracion_confirmada, title: f.obra, v: f.sala_slug,
              }, elegidas);
              return (
                <li className="funcion" key={f.id} data-elegida={String(f.agendada)}>
                  <span className="hora num">{fmtHora(f.hora_min)}</span>
                  <span className="obra">
                    {f.obra}
                    {razonesDe(f).map(r => (
                      <b className="razon" key={r.id} title={r.fuente}> {r.etiqueta}</b>
                    ))}
                    <span className="cia">
                      {f.sala?.nombre ?? 'Sala por confirmar'} · {f.duracion_min} min
                      {f.duracion_confirmada ? '' : ' estimados'}
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
                  <Veredicto v={v} agendada={f.agendada} />
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
