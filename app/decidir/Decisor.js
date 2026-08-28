'use client';
import { useMemo, useState } from 'react';
import { marcarAgendada } from '../../lib/cliente.mjs';
import { fmtHora } from '../../lib/decisor.mjs';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';
import Tipo, { tipoDeVeredicto } from '../Tipo.js';

// El decisor: día por día, con el costo de cada elección a la vista.
//
// Con 776 funciones en diez días, la pregunta deja de ser "qué me alcanza el
// bolsillo" y pasa a ser "qué descarto". Por eso lo primero es el filtro por
// franja, y solo después el veredicto: sin recortar, ningún motor de choques
// sirve de nada frente a cien opciones diarias.

export default function Decisor({ p, recargar }) {
  const fechas = useMemo(
    () => [...new Set(p.funciones.map(f => f.fecha))].sort(), [p.funciones]);
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
    for (const f of p.funciones) {
      const x = franjaDe(f);
      if (x) c.set(x, (c.get(x) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [p.funciones]);

  const elegidas = useMemo(
    () => new Set(p.funciones.filter(f => f.agendada).map(f => f.id)), [p.funciones]);

  const fecha = fechas[dia];
  const norm = s => (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const delDia = useMemo(() => p.funciones
    .filter(f => f.fecha === fecha)
    .filter(f => !franja || franjaDe(f) === franja)
    .filter(f => !busca || norm(`${f.obra} ${f.compania} ${f.sala?.nombre}`).includes(norm(busca)))
    .sort((a, b) => a.hora_min - b.hora_min),
  [p.funciones, fecha, franja, busca]);

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
          {p.funciones.length} funciones · <b>{elegidas.size}</b> en tu agenda.
          Marca una y mira abajo qué se cae por elegirla.
        </p>
      </section>

      <div className="dias">
        {fechas.map((f, i) => {
          const n = p.funciones.filter(x => x.fecha === f && x.agendada).length;
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
          <option value="">Todas las franjas ({p.funciones.length})</option>
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
                  <span className="pie">
                    <Tipo t={f.agendada ? 'comprada' : tipoDeVeredicto(v)} />{' '}
                    {v.txt}
                    {v.estimado && ' Depende de una duración estimada.'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
