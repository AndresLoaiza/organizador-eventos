'use client';
import { useMemo, useState } from 'react';
import { marcarInteresVarias } from '../../lib/cliente.mjs';
import { fmtHora } from '../../lib/decisor.mjs';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';
import {
  razonesDe, avisoCuerpo, ordenarParaOjear, contarOjeo,
  agruparPorObra, interesDeGrupo,
} from '../../lib/interes.mjs';
import Margen, { Cabecera, Friso } from '../Margen.js';

// Ojear: el primer paso, y a propósito sin motor de choques.
//
// Decidir qué te interesa y decidir qué alcanzas son dos preguntas distintas.
// Si la segunda entra primero, se descarta algo que sí interesaba solo porque
// esa noche ya estaba ocupada — y esa noche puede liberarse después. Aquí no se
// muestra ningún veredicto: solo la obra, y sí o no.
//
// Y "la obra" es justo eso: una tarjeta por obra, no una por función. El
// volante repite Dark Circus Stereoptik en el domingo y en el lunes, pero es
// una sola pregunta de gusto contestada dos veces si se muestra dos veces.
// Marcar aquí decide sobre todas las fechas de la obra a la vez; cuál fecha
// específica —la que no choca con otra cosa— se decide después, en Decidir.

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

  // Todas las fechas de cada obra en el festival, sin filtrar: marcar interés
  // en una tarjeta tiene que alcanzar a la función del lunes aunque el filtro
  // de día solo esté mostrando la del domingo.
  const porObra = useMemo(() => {
    const m = new Map();
    for (const [obra, fs] of agruparPorObra(p.funciones)) {
      m.set(obra, [...fs].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_min - b.hora_min));
    }
    return m;
  }, [p.funciones]);

  // Una tarjeta por obra: la primera función visible de cada obra decide el
  // orden y presta sus razones/aviso, pero las ocurrencias que trae la tarjeta
  // —y lo que se marca al tocar el botón— son todas las fechas de esa obra.
  const grupos = useMemo(() => {
    const vistos = new Set();
    const out = [];
    for (const f of visibles) {
      if (vistos.has(f.obra)) continue;
      vistos.add(f.obra);
      out.push({ obra: f.obra, ref: f, ocurrencias: porObra.get(f.obra) ?? [f] });
    }
    return out;
  }, [visibles, porObra]);

  // Nunca toca lo destacado ni lo ya marcado, en ninguna de sus fechas: sirve
  // para vaciar una franja de 317 lanzamientos, no para borrar trabajo hecho.
  const gruposParaDescartar = grupos.filter(g =>
    g.ocurrencias.every(o => !o.interes) && !razonesDe(g.ref).length);

  async function marcar(g, valor) {
    const ids = g.ocurrencias.map(o => o.id);
    const actual = interesDeGrupo(g.ocurrencias);
    setOcupado(g.obra);
    setError(null);
    try {
      // Volver a tocar el mismo botón deshace: un descarte de afán se corrige.
      await marcarInteresVarias(ids, actual === valor ? null : valor);
      await recargar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setOcupado(null);
    }
  }

  async function descartarLote() {
    if (!gruposParaDescartar.length) return;
    const ids = gruposParaDescartar.flatMap(g => g.ocurrencias.map(o => o.id));
    setOcupado('lote');
    setError(null);
    try {
      await marcarInteresVarias(ids, 'no');
      await recargar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <Cabecera mascara="antifaz" titulo="Ojear">
        Sí o no, sin pensar en horarios. Los choques se miran después, en{' '}
        <b>Decidir</b>, y solo sobre lo que marques aquí.
      </Cabecera>

      <section className="seccion" style={{ marginTop: 0 }}>
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
        <h2>{grupos.length} {grupos.length === 1 ? 'obra' : 'obras'}</h2>

        {gruposParaDescartar.length > 2 && (
          <p className="exportar">
            <button
              type="button" className="boton" data-tam="chico"
              disabled={ocupado === 'lote'} onClick={descartarLote}
            >
              {ocupado === 'lote' ? '…' : `Descartar las ${gruposParaDescartar.length} sin resaltar`}
            </button>
            <span className="exportar-aviso">No toca las resaltadas ni las ya marcadas.</span>
          </p>
        )}

        {grupos.length === 0 ? (
          <div className="vacio">
            <b>Nada con ese filtro</b>
            {ver === 'sinVer'
              ? 'Ojeaste todo lo que cabía aquí.'
              : 'Prueba otro día o borra la búsqueda.'}
            <Margen tipo="colombina" tam="medio" />
          </div>
        ) : (
          <ul className="funciones">
            {grupos.map(g => {
              const estado = interesDeGrupo(g.ocurrencias);
              const razones = razonesDe(g.ref);
              const cuerpo = avisoCuerpo(g.ref);
              const unaSola = g.ocurrencias.length === 1;
              // La foto se ata función por función (script cargar-imagenes),
              // pero es la misma obra: basta con que una fecha la tenga.
              const imagen = g.ocurrencias.find(o => o.imagen_url)?.imagen_url;
              return (
                <li className="funcion ojeo" key={g.obra} data-interes={estado ?? 'sin'}>
                  <span className="hora num">
                    {unaSola
                      ? fmtHora(g.ocurrencias[0].hora_min)
                      : <>{g.ocurrencias.length}<span className="hora-cuenta"> fechas</span></>}
                  </span>
                  <span className="obra">
                    {imagen && (
                      <img className="miniatura" src={imagen} alt="" loading="lazy" decoding="async" />
                    )}
                    {g.obra}
                    <span className="cia">
                      {g.ocurrencias.map(o => (
                        <span className="ocurrencia" key={o.id}>
                          {nombreDia(o.fecha)} {fechaLarga(o.fecha)}
                          {!unaSola && ` · ${fmtHora(o.hora_min)}`} ·{' '}
                          {o.sala?.nombre ?? franjaDe(o) ?? 'Sala por confirmar'}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="estado ojeo-botones">
                    <button
                      type="button" className="boton" data-tam="chico"
                      data-v={estado === 'si' ? 'primario' : undefined}
                      disabled={ocupado === g.obra}
                      aria-pressed={estado === 'si'}
                      onClick={() => marcar(g, 'si')}
                    >
                      Me interesa
                    </button>
                    <button
                      type="button" className="boton boton-no" data-tam="chico"
                      disabled={ocupado === g.obra}
                      aria-pressed={estado === 'no'}
                      onClick={() => marcar(g, 'no')}
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
                  {g.ref.compania && (
                    <details className="ficha">
                      <summary>De qué se trata</summary>
                      <p>{g.ref.compania}</p>
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
