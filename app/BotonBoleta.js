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
  const suyas = (funcion.boletas ?? []).filter(b => b.storage_key);
  if (!suyas.length) return null;

  return (
    <div className="boletas-fila">
      {suyas.map((b, i) => (
        <BotonBoleta
          key={b.id}
          boleta={b}
          etiqueta={suyas.length > 1 ? `Boleta ${i + 1} de ${suyas.length}` : 'Ver boleta'}
        />
      ))}
    </div>
  );
}
