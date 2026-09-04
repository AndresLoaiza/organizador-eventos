'use client';
import { useMemo, useState } from 'react';
import { marcarInteres, marcarInteresVarias } from '../../lib/cliente.mjs';
import { fmtHora } from '../../lib/decisor.mjs';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';
import { razonesDe, avisoCuerpo, ordenarParaOjear, contarOjeo } from '../../lib/interes.mjs';
import Margen from '../Margen.js';

// Ojear: el primer paso, y a propósito sin motor de choques.
//
// Decidir qué te interesa y decidir qué alcanzas son dos preguntas distintas.
// Si la segunda entra primero, se descarta algo que sí interesaba solo porque
// esa noche ya estaba ocupada — y esa noche puede liberarse después. Aquí no se
// muestra ningún veredicto: solo la obra, y sí o no.

const franjaDe = f => (f.nota_boleteria ?? '').split(' · ')[0].trim();

export default function Ojeo({ p, recargar }) {
  const [dia, setDia] = useState('');
  const [franja, setFranja] = useState('');
  const [ver, setVer] = useState('sinVer');
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  const fechas = useMemo(
    () => [...new Set(p.funciones.map(f => f.fecha))].sort(), [p.funciones]);

  const franjas = useMemo(() => {
    const c = new Map();
    for (const f of p.funciones) {
      const x = franjaDe(f);
      if (x) c.set(x, (c.get(x) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [p.funciones]);

  const cuenta = useMemo(() => contarOjeo(p.funciones), [p.funciones]);

  const norm = s => (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const visibles = useMemo(() => ordenarParaOjear(p.funciones
    .filter(f => !dia || f.fecha === dia)
    .filter(f => !franja || franjaDe(f) === franja)
    .filter(f => ver === 'todas'
      || (ver === 'sinVer' && !f.interes)
      || (ver === 'destacadas' && razonesDe(f).length && f.interes !== 'no')
      || f.interes === ver)
    .filter(f => !busca || norm(`${f.obra} ${f.compania}`).includes(norm(busca)))),
  [p.funciones, dia, franja, ver, busca]);

  // Nunca toca lo destacado ni lo ya marcado: sirve para vaciar una franja de
  // 317 lanzamientos, no para borrar trabajo hecho.
  const paraDescartar = visibles.filter(f => !f.interes && !razonesDe(f).length);

  async function marcar(f, valor) {
    setOcupado(f.id);
    setError(null);
    try {
      // Volver a tocar el mismo botón deshace: un descarte de afán se corrige.
      await marcarInteres(f.id, f.interes === valor ? null : valor);
      await recargar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setOcupado(null);
    }
  }

  async function descartarLote() {
    if (!paraDescartar.length) return;
    setOcupado('lote');
    setError(null);
    try {
      await marcarInteresVarias(paraDescartar.map(f => f.id), 'no');
      await recargar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
        <h1>Ojear</h1>
        <p className="entradilla">
          Sí o no, sin pensar en horarios. Los choques se miran después, en{' '}
          <b>Decidir</b>, y solo sobre lo que marques aquí.
        </p>
        <p className="marcador num">
          <b>{cuenta.si}</b> te interesan · {cuenta.no} descartadas ·{' '}
          {cuenta.sinVer} sin ojear
        </p>
      </section>

      <div className="filtros">
        <select value={ver} onChange={e => setVer(e.target.value)} aria-label="Qué mostrar">
          <option value="sinVer">Sin ojear ({cuenta.sinVer})</option>
          <option value="destacadas">Puede que te interesen</option>
          <option value="si">Marcadas que sí ({cuenta.si})</option>
          <option value="no">Descartadas ({cuenta.no})</option>
          <option value="todas">Todas ({p.funciones.length})</option>
        </select>
        <select value={dia} onChange={e => setDia(e.target.value)} aria-label="Día">
          <option value="">Todos los días</option>
          {fechas.map(f => (
            <option key={f} value={f}>{nombreDia(f)} {f.slice(8)}</option>
          ))}
        </select>
        <select value={franja} onChange={e => setFranja(e.target.value)} aria-label="Franja">
          <option value="">Todas las franjas</option>
          {franjas.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
        </select>
        <input
          type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar obra o invitado" aria-label="Buscar"
        />
      </div>

      {error && (
        <div className="aviso" data-sev="alto">
          <span className="marca" aria-hidden="true">!</span><span>{error}</span>
        </div>
      )}

      <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
        <h2>{visibles.length} {visibles.length === 1 ? 'función' : 'funciones'}</h2>

        {paraDescartar.length > 2 && (
          <p className="exportar">
            <button
              type="button" className="boton" data-tam="chico"
              disabled={ocupado === 'lote'} onClick={descartarLote}
            >
              {ocupado === 'lote' ? '…' : `Descartar las ${paraDescartar.length} sin resaltar`}
            </button>
            <span className="exportar-aviso">No toca las resaltadas ni las ya marcadas.</span>
          </p>
        )}

        {visibles.length === 0 ? (
          <div className="vacio">
            <b>Nada con ese filtro</b>
            {ver === 'sinVer'
              ? 'Ojeaste todo lo que cabía aquí.'
              : 'Prueba otro día o borra la búsqueda.'}
            <Margen tipo="arlecchino" tam="medio" />
          </div>
        ) : (
          <ul className="funciones">
            {visibles.map(f => {
              const razones = razonesDe(f);
              const cuerpo = avisoCuerpo(f);
              return (
                <li className="funcion ojeo" key={f.id} data-interes={f.interes ?? 'sin'}>
                  <span className="hora num">{fmtHora(f.hora_min)}</span>
                  <span className="obra">
                    {f.obra}
                    <span className="cia">
                      {nombreDia(f.fecha)} {fechaLarga(f.fecha)} ·{' '}
                      {f.sala?.nombre ?? franjaDe(f) ?? 'Sala por confirmar'}
                    </span>
                  </span>
                  <span className="estado ojeo-botones">
                    <button
                      type="button" className="boton" data-tam="chico"
                      data-v={f.interes === 'si' ? 'primario' : undefined}
                      disabled={ocupado === f.id}
                      aria-pressed={f.interes === 'si'}
                      onClick={() => marcar(f, 'si')}
                    >
                      Me interesa
                    </button>
                    <button
                      type="button" className="boton boton-no" data-tam="chico"
                      disabled={ocupado === f.id}
                      aria-pressed={f.interes === 'no'}
                      onClick={() => marcar(f, 'no')}
                    >
                      No
                    </button>
                  </span>
                  {(razones.length > 0 || cuerpo) && (
                    <span className="pie">
                      {/* Cada razón lleva su origen en el title: para poder
                          darle la contraria a la app, hay que saber de dónde
                          sacó que esto te interesaba. */}
                      {razones.map(r => (
                        <b className="razon" key={r.id} title={r.fuente}>{r.etiqueta}</b>
                      ))}
                      {cuerpo && <span className="cuerpo-aviso">{cuerpo}</span>}
                    </span>
                  )}
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
