'use client';
import Link from 'next/link';
import { nocheDe, hoyMedellin, nombreDia, fechaLarga, minutosAhoraMedellin } from '../lib/panorama.mjs';
import { porJuzgar } from '../lib/juicio.mjs';
import JuicioRapido from './JuicioRapido.js';
import Avisos from './Avisos.js';
import Pantalla from './Pantalla.js';
import { BoletasDe } from './BotonBoleta.js';
import Salidas from './Salidas.js';
import Margen, { Friso } from './Margen.js';

const SELLO = {
  comprada: 'Comprada', agendada: 'Agendada',
  vencida: 'Vencida', no_alcanzada: 'No alcanzada',
};

export default function Canovaccio() {
  return <Pantalla>{({ p, recargar }) => <Hoja p={p} recargar={recargar} />}</Pantalla>;
}

function Hoja({ p, recargar }) {
  const hoy = hoyMedellin();
  // Si hoy no hay nada, muestra la próxima noche con funciones. La pantalla
  // sirve para salir de casa, no para contemplar un día vacío.
  const fechas = [...new Set(p.funciones.filter(f => f.agendada).map(f => f.fecha))].sort();
  const fecha = fechas.includes(hoy) ? hoy : (fechas.find(f => f >= hoy) ?? fechas.at(-1));
  const escenas = fecha ? nocheDe(p, fecha) : [];
  const altos = p.avisos.filter(a => a.severidad === 'alto');
  // Lo que ya viste y no has juzgado. Se vence a los pocos días, pero va debajo
  // de la noche: la escena de las 7:15 manda en esta pantalla.
  const pendientes = porJuzgar(p.funciones, hoy, minutosAhoraMedellin());

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
          {fecha ? (
            <>
              <h1 className="rotulo">{fecha === hoy ? 'Esta noche' : `El ${nombreDia(fecha)}`}</h1>
              <span className="fecha num">{fechaLarga(fecha)} · {p.festival.nombre}</span>
            </>
          ) : (
            <span className="fecha num">{p.festival.nombre}</span>
          )}
        </div>

        {escenas.length === 0 ? (
          <div className="vacio">
            {/* Sin fecha no hay "esta noche" que contemplar: nada del
                festival tiene agendada=true todavía, así que el mensaje es
                sobre el festival entero, no sobre una noche vacía. */}
            <b>{fecha ? 'Nada agendado para esta noche' : 'Todavía no has agendado nada'}</b>
            <Link href="/agenda">Mira la agenda completa</Link>.
            <Margen tipo="arlecchino" tam="medio" />
          </div>
        ) : (
          <ol className="escenas">
            {escenas.map((e, i) => (
              <li className="escena" key={e.id} data-estado={e.estado}>
                <span className="n num" aria-hidden="true">{i + 1}</span>
                <div>
                  <div className="hora num">{e.horaTexto}</div>
                  <div className="obra">{e.obra}</div>
                  <div className="donde">
                    {/* Si la dirección ya empieza con el nombre de la sala, no se repite. */}
                    {e.sala?.nombre && e.sala?.direccion?.startsWith(e.sala.nombre)
                      ? e.sala.direccion
                      : <>{e.sala?.nombre ?? 'Sala por confirmar'}{e.sala?.direccion ? ` · ${e.sala.direccion}` : ''}</>}
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
                  <div className="boletas-fila"><Salidas funcion={e} /></div>
                  {/* La foto va al final: a las 7:15 lo que se mira de reojo es
                      la hora, la sala y la boleta. Antes iba arriba y empujaba la
                      hora fuera de la pantalla. */}
                  {e.imagen_url && (
                    <img
                      className="foto" src={e.imagen_url} alt={`${e.obra}, ${e.compania ?? ''}`}
                      loading="lazy" decoding="async"
                    />
                  )}
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

      {/* Debajo de la noche, no encima: a las 7:15 lo primero es la hora, la sala
          y la boleta. El juicio puede esperar un renglón. */}
      {pendientes.length > 0 && (
        <section className="seccion juicios-rapidos" aria-label="Lo que ya viste">
          {pendientes.map(f => (
            <JuicioRapido key={f.id} funcion={f} hoy={hoy} alTerminar={recargar} />
          ))}
        </section>
      )}

      <p className="entradilla">
        {escenas.length > 0 && (
          <>Llevas <b className="num">${p.total.toLocaleString('es-CO')}</b> en este festival. </>
        )}
        <Link href="/agenda">Agenda completa</Link> · <Link href="/boletas">Baúl</Link>
      </p>
    </>
  );
}
