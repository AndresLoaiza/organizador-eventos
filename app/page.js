'use client';
import Link from 'next/link';
import { nocheDe, hoyMedellin, nombreDia, fechaLarga } from '../lib/panorama.mjs';
import Avisos from './Avisos.js';
import Pantalla from './Pantalla.js';
import { BoletasDe } from './BotonBoleta.js';
import Margen, { Friso } from './Margen.js';

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
        <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
          <Avisos avisos={altos} />
        </section>
      )}

      <section className="canovaccio">
        <div className="encabezado">
          <Margen tipo="cuoio" tam="capitular" className="marca-noche" />
          <span className="rotulo">{fecha === hoy ? 'Esta noche' : `El ${nombreDia(fecha)}`}</span>
          <span className="fecha num">{fechaLarga(fecha)} · {p.festival.nombre}</span>
        </div>

        {escenas.length === 0 ? (
          <div className="vacio">
            <b>Nada agendado para esta noche</b>
            <Link href="/agenda">Mira la agenda completa</Link>.
            <Margen tipo="arlecchino" tam="medio" />
          </div>
        ) : (
          <ol className="escenas">
            {escenas.map((e, i) => (
              <li className="escena" key={e.id} data-estado={e.estado}>
                <span className="n num" aria-hidden="true">{i + 1}</span>
                <div>
                  {e.imagen_url && (
                    <img
                      className="foto" src={e.imagen_url} alt={`${e.obra}, ${e.compania ?? ''}`}
                      loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                    />
                  )}
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
                  <BoletasDe funcion={e} />
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

        {escenas.length > 0 && (
          <div className="pie-de-hoja">
            <Margen tipo="arlecchino" tam="grande" />
            <p>Canovaccio · {escenas.length} {escenas.length === 1 ? 'escena' : 'escenas'} · el resto se improvisa</p>
          </div>
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
