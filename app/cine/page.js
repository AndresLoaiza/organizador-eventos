'use client';
import { useEffect, useMemo, useState } from 'react';
import datos from '../../cartelera/cartelera.json';
import { urlSegura } from '../../lib/url.mjs';
import { filtrarCartelera, diasDe } from '../../lib/cartelera.mjs';
import { hoyMedellin } from '../../lib/panorama.mjs';
import { Cabecera } from '../Margen.js';

// Cartelera en idioma original. Sin Pantalla: son datos públicos, no pasan por
// la base ni piden el código de acceso. Es herramienta, no escena: renglones,
// póster como referencia visual y los filtros que responden «¿qué veo el
// jueves?» sin leer las 35.

const CORTO = { 'Procinal (Terminal del Sur)': 'Procinal', 'Colombo Americano': 'Colombo', 'MAMM (cine)': 'MAMM' };
const corto = c => CORTO[c] ?? c;

// '2026-11-09' → 'lun 9'. Mediodía UTC para que el huso no corra el día.
const dia = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

function etiquetaDia(iso, hoy) {
  if (iso === hoy) return 'hoy';
  const manana = new Date(`${hoy}T12:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  return iso === manana.toISOString().slice(0, 10) ? 'mañana' : dia(iso);
}

function Interruptor({ activo, onClick, children }) {
  return (
    <button type="button" className="boton" data-tam="chico" aria-pressed={activo} onClick={onClick}>
      {children}
    </button>
  );
}

function Imdb({ imdb }) {
  if (!imdb) return <span className="cine-imdb" data-sin="true">IMDb sin dato seguro</span>;
  const dudas = [imdb.votos < 1000 && 'pocos votos', imdb.dudoso && 'coincidencia por título'].filter(Boolean);
  return (
    <a className="cine-imdb" href={`https://www.imdb.com/title/${imdb.id}/`} target="_blank" rel="noreferrer">
      <span className="cine-imdb-marca">IMDb</span>
      <b className="num">{imdb.nota.toFixed(1)}</b>
      <span className="num">{imdb.votos.toLocaleString('es-CO')} votos</span>
      {dudas.length > 0 && <span className="cine-duda">? {dudas.join(', ')}</span>}
    </a>
  );
}

function Pelicula({ f, hoy }) {
  const [sinPoster, setSinPoster] = useState(false);
  return (
    <li className="cine-peli">
      {f.poster && !sinPoster ? (
        <img
          className="cine-poster" src={f.poster} alt="" width="96" height="144"
          loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setSinPoster(true)}
        />
      ) : (
        <div className="cine-poster" data-vacio="true" aria-hidden="true">{f.titulo.charAt(0)}</div>
      )}
      <div className="cine-cuerpo">
        <h2 className="cine-titulo">{f.titulo}</h2>
        {f.original && f.original !== f.titulo && <p className="cine-original">{f.original}</p>}
        <Imdb imdb={f.imdb} />
        {f.motivo && <p className="cine-motivo">{f.motivo}</p>}
      </div>
      <ul className="cine-salas">
          {f.donde.map(d => (
            <li key={`${d.cadena}-${d.sede}`} className="cine-sala">
              <div className="cine-sala-texto">
                <b>{d.sede.startsWith(d.cadena.split(' ')[0]) ? d.sede : `${corto(d.cadena)} · ${d.sede}`}</b>
                <span data-dudoso={d.idioma_confirmado === false || undefined}>
                  {d.idioma_confirmado === false ? `Idioma sin confirmar: ${d.idioma}` : d.idioma}
                </span>
                {d.fechas?.length > 0 && (
                  <span className="num">{d.fechas.map(x => etiquetaDia(x, hoy)).join(', ')}</span>
                )}
              </div>
              {urlSegura(d.url) && (
                <a className="boton" data-tam="chico" href={d.url} target="_blank" rel="noreferrer"
                   aria-label={`Comprar ${f.titulo} en ${d.sede}`}>
                  Comprar
                </a>
              )}
            </li>
          ))}
      </ul>
    </li>
  );
}

export default function Cine() {
  // La página se exporta estática: el primer render usa el día de la lectura
  // (igual en el servidor y en el navegador) y luego pasa al día de verdad.
  const [hoy, setHoy] = useState(datos.verificado);
  useEffect(() => setHoy(hoyMedellin()), []);
  const dias = useMemo(() => diasDe(datos.peliculas).filter(d => d >= hoy), [hoy]);
  const cadenas = useMemo(() => [...new Set(datos.peliculas.flatMap(p => p.donde.map(d => d.cadena)))], []);
  const [filtro, setFiltro] = useState({ dia: null, cadena: null, soloConfirmado: true, orden: 'nota' });
  const poner = cambio => setFiltro(f => ({ ...f, ...cambio }));
  const lista = useMemo(() => filtrarCartelera(datos.peliculas, filtro), [filtro]);
  const ocultas = filtro.soloConfirmado
    ? filtrarCartelera(datos.peliculas, { ...filtro, soloConfirmado: false }).length - lista.length : 0;

  return (
    <section className="seccion">
      <Cabecera mascara="antifaz" titulo="Cine en idioma original">
        Subtitulada o en su idioma, en Medellín, hasta la próxima semana. Leída el{' '}
        <b className="num">{datos.verificado}</b>.
      </Cabecera>

      <div className="cine-filtros" role="group" aria-label="Filtros">
        <div className="vista-toggle" role="group" aria-label="Día">
          <Interruptor activo={!filtro.dia} onClick={() => poner({ dia: null })}>Toda la semana</Interruptor>
          {dias.map(d => (
            <Interruptor key={d} activo={filtro.dia === d} onClick={() => poner({ dia: d })}>{etiquetaDia(d, hoy)}</Interruptor>
          ))}
        </div>
        <div className="vista-toggle" role="group" aria-label="Sala">
          <Interruptor activo={!filtro.cadena} onClick={() => poner({ cadena: null })}>Todas las salas</Interruptor>
          {cadenas.map(c => (
            <Interruptor key={c} activo={filtro.cadena === c} onClick={() => poner({ cadena: c })}>{corto(c)}</Interruptor>
          ))}
        </div>
        <div className="vista-toggle" role="group" aria-label="Orden">
          <Interruptor activo={filtro.orden === 'nota'} onClick={() => poner({ orden: 'nota' })}>Mejor nota</Interruptor>
          <Interruptor activo={filtro.orden === 'salas'} onClick={() => poner({ orden: 'salas' })}>Más salas</Interruptor>
          <Interruptor activo={!filtro.soloConfirmado} onClick={() => poner({ soloConfirmado: !filtro.soloConfirmado })}>
            Incluir idioma sin confirmar
          </Interruptor>
        </div>
      </div>

      <p className="cine-cuenta" aria-live="polite">
        <b className="num">{lista.length}</b> {lista.length === 1 ? 'película' : 'películas'}
        {ocultas > 0 && <> · {ocultas} más solo en salas que no publican el idioma</>}
      </p>

      {lista.length === 0 ? (
        <div className="vacio">
          <b>Nada con esos filtros</b>
          Prueba otro día o incluye las salas sin idioma confirmado.
        </div>
      ) : (
        <ol className="cine-lista">
          {lista.map(f => <Pelicula key={f.slug} f={f} hoy={hoy} />)}
        </ol>
      )}

      <details className="ficha cine-fuentes">
        <summary>Qué se leyó en cada sala</summary>
        <ul>
          {datos.cadenas.map(c => (
            <li key={c.nombre}>
              <b>{c.nombre}</b>: {c.estado}{' '}
              {urlSegura(c.url) && <a href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
