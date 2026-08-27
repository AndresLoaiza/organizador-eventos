'use client';
import { nombreDia, fechaLarga } from '../../lib/panorama.mjs';
import Registrar from './Registrar.js';
import Pantalla from '../Pantalla.js';

export default function Bitacora() {
  return <Pantalla>{({ p, recargar }) => <Cuerpo p={p} recargar={recargar} />}</Pantalla>;
}

function Cuerpo({ p, recargar }) {
  // Solo se juzga lo que ya pasó. Ofrecer registrar una obra que aún no ve
  // invita a inventar, y el perfil del vault vive de no inventar.
  const pasadas = p.funciones
    .filter(f => f.agendada && f.fecha <= p.hoy)
    .sort((a, b) => (b.fecha + b.hora_min).localeCompare(a.fecha + a.hora_min))
    .map(f => ({
      id: f.id,
      juicio: f.juicio,
      etiqueta: `${nombreDia(f.fecha)} ${fechaLarga(f.fecha)} · ${f.obra}`,
      obra: f.obra,
      fecha: f.fecha,
    }));

  const registradas = pasadas.filter(f => f.juicio);
  const sinRegistrar = pasadas.filter(f => !f.juicio);

  return (
    <>
      <section className="seccion" style={{ marginTop: 'var(--e5)' }}>
        <h1>Bitácora</h1>
        <p className="entradilla">
          {registradas.length} de {pasadas.length} funciones vistas ya tienen juicio.
          Lo que escribas aquí va al perfil de Obsidian y decide qué se te recomienda
          en el próximo festival.
        </p>
      </section>

      <section className="seccion">
        <h2>Registrar</h2>
        <Registrar funciones={pasadas} alGuardar={recargar} />
      </section>

      {sinRegistrar.length > 0 && (
        <section className="seccion">
          <h2>Pendientes de juicio</h2>
          <p className="entradilla">
            Escríbelas el mismo día. A la semana ya se te olvidó qué te molestó.
          </p>
          <ul className="funciones">
            {sinRegistrar.map(f => (
              <li className="funcion" key={f.id}>
                <span className="hora num">{f.fecha.slice(8)}</span>
                <span className="obra">{f.obra}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {registradas.length > 0 && (
        <section className="seccion">
          <h2>Ya registradas</h2>
          <ul className="funciones">
            {registradas.map(f => (
              <li className="funcion" key={f.id} style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="obra">
                  {f.obra}
                  <span className="cia" style={{ whiteSpace: 'normal', marginTop: '0.35rem' }}>
                    {f.juicio.texto}
                  </span>
                </span>
                <span className="estado" style={{ color: 'var(--justo)' }}>
                  {f.juicio.estrellas ? '★'.repeat(f.juicio.estrellas) : ''}
                </span>
                <span className="pie">
                  {f.juicio.sincronizado_obsidian
                    ? 'En el perfil de Obsidian'
                    : 'Sin llevar a Obsidian todavía'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
