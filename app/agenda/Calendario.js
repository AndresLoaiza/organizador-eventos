'use client';
import { armarCalendario } from '../../lib/vistaCalendario.mjs';
import { fmtHora } from '../../lib/decisor.mjs';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';

// La agenda como calendario: un día por columna, la hora hacia abajo, cada
// función del alto de su duración. Sirve para ver de un golpe los huecos y los
// choques que la lista cuenta renglón por renglón. Solo de hoy en adelante.

const PX_POR_MIN = 1.6;   // una hora mide 96 px; una función de 45 min, 72: hora, obra en dos líneas y sala

const ESTADO = { comprada: 'Comprada', agendada: 'Sin boleta', vencida: 'Vencida', no_alcanzada: 'No alcanzada' };

// Entrada libre sin boleta no es «sin boleta»: no hay nada que comprar.
const estadoDe = b => (b.estado !== 'comprada' && b.precio_pleno === 0 && !b.boletas?.length ? 'libre' : b.estado);
const ROTULO = { ...ESTADO, libre: 'Libre' };

export default function Calendario({ p }) {
  const { dias, inicio, fin, bloques } = armarCalendario(p.funciones, p.hoy);
  if (!dias.length) {
    return <div className="vacio"><b>Nada agendado de hoy en adelante</b>Marca funciones en Decidir.</div>;
  }
  const alto = (fin - inicio) * PX_POR_MIN;
  const horas = [];
  for (let t = inicio; t < fin; t += 60) horas.push(t);

  return (
    <div className="cal-scroll">
      <div className="cal" style={{ '--dias': dias.length }}>
        <div className="cal-esquina" aria-hidden="true" />
        {dias.map(d => (
          <div key={d} className="cal-dia-titulo" data-hoy={String(d === p.hoy)}>
            <b>{d === p.hoy ? 'Hoy' : nombreDia(d)}</b>
            <span className="num">{fechaLarga(d)}</span>
          </div>
        ))}

        <div className="cal-horas" style={{ height: alto }} aria-hidden="true">
          {horas.map(t => (
            <span key={t} className="num" style={{ top: (t - inicio) * PX_POR_MIN }}>{fmtHora(t)}</span>
          ))}
        </div>

        {dias.map(d => (
          <div key={d} className="cal-columna" style={{ height: alto }}
               aria-label={`${d === p.hoy ? 'Hoy' : nombreDia(d)} ${fechaLarga(d)}`}>
            {horas.map(t => (
              <span key={t} className="cal-linea" style={{ top: (t - inicio) * PX_POR_MIN }} aria-hidden="true" />
            ))}
            {bloques.filter(b => b.fecha === d).map(b => (
              <article
                key={b.id} className="cal-bloque" data-estado={estadoDe(b)}
                style={{
                  top: b.desde * PX_POR_MIN,
                  height: Math.max(b.dura * PX_POR_MIN, 48),
                  left: `calc(${(b.carril / b.carriles) * 100}% + 2px)`,
                  width: `calc(${100 / b.carriles}% - 4px)`,
                }}
                title={`${fmtHora(b.hora_min)} · ${b.obra} · ${b.sala?.nombre ?? 'Sala por confirmar'}`}
              >
                <span className="cal-cabeza">
                  <span className="cal-hora num">{fmtHora(b.hora_min)}{b.duracion_confirmada ? '' : ' ~'}</span>
                  <span className="cal-estado">{ROTULO[estadoDe(b)] ?? b.estado}</span>
                </span>
                <b className="cal-obra">{b.obra}</b>
                <span className="cal-sala">{b.sala?.nombre ?? 'Sala por confirmar'}</span>
              </article>
            ))}
          </div>
        ))}
      </div>
      <p className="nota">
        «~» junto a la hora: duración estimada. Dos bloques lado a lado se pisan; uno pegado
        al otro no se pisa, pero puede no alcanzar el traslado (lo dicen los avisos).
      </p>
    </div>
  );
}
