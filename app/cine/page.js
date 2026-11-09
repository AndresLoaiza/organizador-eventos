'use client';
import datos from '../../cartelera/cartelera.json';

const URL_CC = 'https://www.cinecolombia.com/peliculas/';
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
              <div className="donde">{f.original !== f.titulo ? `${f.original} · ` : ''}{f.idioma}</div>
              <div className="donde">{f.salas.join(' · ')}</div>
              {f.fechas?.length > 0 && <div className="donde num">{f.fechas.map(dia).join(' · ')}</div>}
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
              <div className="boletas-fila">
                <a className="boton" data-tam="chico" data-v="primario"
                   href={`${URL_CC}${f.slug}`} target="_blank" rel="noreferrer">Comprar boleta</a>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <h2>Cadenas</h2>
      <ul>
        {datos.cadenas.map(c => (
          <li key={c.nombre}>
            <b>{c.nombre}</b>: {c.estado}{' '}
            {c.url && <a href={c.url} target="_blank" rel="noreferrer">Abrir</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
