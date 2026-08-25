'use client';
import Link from 'next/link';
import { nocheDe, hoyMedellin, nombreDia, fechaLarga } from '../lib/panorama.mjs';
import Avisos from './Avisos.js';
import Pantalla from './Pantalla.js';

const SELLO = {
  comprada: 'Comprada', agendada: 'Agendada',
  vencida: 'Vencida', no_alcanzada: 'No alcanzada',
};

export default function Canovaccio() {
  return <Pantalla>{({ p }) => <Hoja p={p} />}</Pantalla>;
}

function Hoja({ p }) {
  const hoy = hoyMedellin();
  // Si hoy no hay nada, muestra la próxima noche con funciones. La pantalla
  // sirve para salir de casa, no para contemplar un día vacío.
  const fechas = [...new Set(p.funciones.filter(f => f.agendada).map(f => f.fecha))].sort();
  const fecha = fechas.includes(hoy) ? hoy : (fechas.find(f => f >= hoy) ?? fechas.at(-1));
  const escenas = fecha ? nocheDe(p, fecha) : [];
  const altos = p.avisos.filter(a => a.severidad === 'alto');

  return (
    <>
      {altos.length > 0 && (
        <section className="seccion" style={{ marginTop: 'var(--p5)' }}>
          <Avisos avisos={altos} />
        </section>
      )}

      <section className="canovaccio">
        <div className="encabezado">
          <span className="rotulo">{fecha === hoy ? 'Esta noche' : `El ${nombreDia(fecha)}`}</span>
          <span className="fecha num">{fechaLarga(fecha)} · {p.festival.nombre}</span>
        </div>

        {escenas.length === 0 ? (
          <p style={{ paddingLeft: '4.4rem', color: 'var(--tinta-2)' }}>
            Nada agendado. <Link href="/agenda">Mira la agenda completa</Link>.
          </p>
        ) : (
          <ol className="escenas">
            {escenas.map((e, i) => (
              <li className="escena" key={e.id} data-estado={e.estado}>
                <span className="n num" aria-hidden="true">{i + 1}</span>
                <div>
                  <div className="hora num">{e.horaTexto}</div>
                  <div className="obra">{e.obra}</div>
                  <div className="donde">
                    {e.sala?.nombre ?? 'Sala por confirmar'}
                    {e.sala?.direccion ? ` · ${e.sala.direccion}` : ''}
                  </div>
                  {e.margen && (
                    <div className="margen" data-estimado={String(e.margen.estimado)}>{e.margen.texto}</div>
                  )}
                  <div>
                    <span className="sello" data-t={e.estado}>
                      {SELLO[e.estado] ?? e.estado}
                      {e.necesarias > 1 && e.estado === 'comprada' ? ` ×${e.necesarias}` : ''}
                    </span>
                  </div>
                  {e.estado !== 'comprada' && e.necesarias > e.boletas.length && (
                    <div className="margen">
                      {e.boletas.length} de {e.necesarias} boletas.{' '}
                      <Link href="/boletas">Cargar la que falta</Link>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="entradilla">
        {escenas.length > 0 && (
          <>Llevas <b className="num">${p.total.toLocaleString('es-CO')}</b> en este festival. </>
        )}
        <Link href="/agenda">Agenda completa</Link> · <Link href="/boletas">Baúl</Link>
      </p>
    </>
  );
}
