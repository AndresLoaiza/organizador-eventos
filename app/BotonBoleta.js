'use client';
import { useState } from 'react';
import { urlFirmada } from '../lib/cliente.mjs';

// Abre el original de una boleta desde el baúl.
//
// El bucket es privado, así que hay que pedir una URL firmada y esa petición es
// asíncrona. Si se hiciera `window.open` después del await, Safari e iOS lo
// tratan como ventana emergente y lo bloquean, porque el gesto del usuario ya
// se perdió. Por eso la pestaña se abre vacía en el mismo clic y se le pone el
// destino cuando llega la firma.

export default function BotonBoleta({ boleta, etiqueta, descargar = false }) {
  const [estado, setEstado] = useState({ fase: 'listo' });

  if (!boleta?.storage_key) return null;

  async function abrir() {
    setEstado({ fase: 'pidiendo' });
    const pestana = window.open('', '_blank');
    try {
      const url = await urlFirmada(boleta.storage_key, undefined, 3600, descargar);
      if (pestana && !pestana.closed) pestana.location = url;
      else window.location.href = url;
      setEstado({ fase: 'listo' });
    } catch (e) {
      if (pestana && !pestana.closed) pestana.close();
      setEstado({ fase: 'error', msg: e.message });
    }
  }

  return (
    <>
      <button
        type="button" className="boton" data-tam="chico"
        onClick={abrir} disabled={estado.fase === 'pidiendo'}
      >
        {estado.fase === 'pidiendo' ? 'Abriendo…' : etiqueta}
      </button>
      {estado.fase === 'error' && (
        <span className="nota" style={{ color: 'var(--acento)', marginLeft: 'var(--e2)' }}>
          {estado.msg}
        </span>
      )}
    </>
  );
}

/** Las boletas de una función, en fila. Con acompañante son dos. */
export function BoletasDe({ funcion }) {
  const todas = (funcion.boletas ?? []).filter(b => b.storage_key || b.url_entrada);
  if (!todas.length) return null;

  return (
    <div className="boletas-fila">
      {todas.map((b, i) => {
        const etiqueta = todas.length > 1 ? `Boleta ${i + 1} de ${todas.length}` : 'Ver boleta';
        return b.storage_key
          ? <BotonBoleta key={b.id} boleta={b} etiqueta={etiqueta} />
          : <a key={b.id} className="boton" data-tam="chico" href={b.url_entrada}
               target="_blank" rel="noopener noreferrer">{etiqueta}</a>;
      })}
    </div>
  );
}
