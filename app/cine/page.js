'use client';
import datos from '../../cartelera/cartelera.json';
import { urlSegura } from '../../lib/url.mjs';

// '2026-11-09' → 'lun 9'. Mediodía UTC para que el huso no corra el día.
const dia = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

// Cartelera en idioma original. Sin Pantalla: son datos públicos, no pasan por
// la base ni piden el código de acceso.
export default function Cine() {
  return (
    <section className="seccion">
      <h1>Cine en idioma original</h1>
      <p className="entradilla">{datos.ciudad} · verificado el <b>{datos.verificado}</b>. {datos.nota}</p>

      <ol className="escenas">
        {datos.peliculas.map((f, i) => (
          <li className="escena" key={f.slug}>
            <span className="n num" aria-hidden="true">{i + 1}</span>
            <div>
              <div className="obra">{f.titulo}</div>
              {f.original && f.original !== f.titulo && <div className="donde">{f.original}</div>}
              <div className="donde">
                {f.imdb ? (
                  <>
                    <a href={`https://www.imdb.com/title/${f.imdb.id}/`} target="_blank" rel="noreferrer">IMDb</a>{' '}
                    <b className="num">{f.imdb.nota.toFixed(1)}</b> · {f.imdb.votos.toLocaleString('es-CO')} votos
                    {f.imdb.votos < 1000 ? ' (pocos votos: poco fiable)' : ''}
                    {f.imdb.dudoso ? ' (coincidencia por título; confirma que es la misma película)' : ''}
                  </>
                ) : 'IMDb: sin dato seguro'}
              </div>
              {f.motivo && <div className="margen">{f.motivo}</div>}
              {f.donde.map(d => (
                <div className="boletas-fila" key={`${d.cadena}-${d.sede}`}>
                  <div className="donde">
                    {/* «Cinemark El Tesoro», «MAMM»: la sede ya nombra la cadena. */}
                    <b>{d.sede.startsWith(d.cadena.split(' ')[0]) ? d.sede : `${d.cadena} · ${d.sede}`}</b>
                    {' · '}{d.idioma_confirmado ? d.idioma : `idioma sin confirmar: ${d.idioma}`}
                    {d.fechas?.length > 0 && <span className="num"> · {d.fechas.map(dia).join(', ')}</span>}
                  </div>
                  {urlSegura(d.url) && (
                    <a className="boton" data-tam="chico" data-v="primario"
                       href={d.url} target="_blank" rel="noreferrer">Comprar</a>
                  )}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <h2>Salas</h2>
      <ul>
        {datos.cadenas.map(c => (
          <li key={c.nombre}>
            <b>{c.nombre}</b>: {c.estado}{' '}
            {urlSegura(c.url) && <a href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
