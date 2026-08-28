'use client';
import { usarPanorama } from './usarPanorama.js';
import Puerta from './Puerta.js';

// Envoltura común de las cuatro pantallas: puerta, carga y errores en un solo
// sitio para que cada pantalla se ocupe solo de lo suyo.

export default function Pantalla({ children }) {
  const { fase, p, msg, recargar, cambiarFestival } = usarPanorama();

  if (fase === 'sin-codigo') return <Puerta alEntrar={recargar} />;
  if (fase === 'cargando') {
    return <section className="seccion"><p className="entradilla">Cargando…</p></section>;
  }
  if (fase === 'error') {
    return (
      <section className="seccion">
        <h1>No se pudo leer</h1>
        <div className="aviso" data-sev="alto">
          <span className="marca" aria-hidden="true">!</span><span>{msg}</span>
        </div>
      </section>
    );
  }
  if (fase === 'sin-datos') {
    return (
      <section className="seccion">
        <h1>Sin festivales</h1>
        <div className="vacio">
          <b>La base está vacía o el código no abre nada</b>
          Si es lo primero, corre <code>npm run seed</code> desde el PC.
        </div>
      </section>
    );
  }
  return (
    <>
      {p.festivales?.length > 1 && (
        <div className="cambio-festival">
          <label htmlFor="festival">Festival</label>
          <select
            id="festival" value={p.festival.slug}
            onChange={e => cambiarFestival(e.target.value)}
          >
            {p.festivales.map(f => (
              <option key={f.slug} value={f.slug}>{f.nombre}</option>
            ))}
          </select>
        </div>
      )}
      {children({ p, recargar })}
    </>
  );
}
