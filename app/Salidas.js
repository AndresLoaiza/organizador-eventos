'use client';
import { useState } from 'react';
import { urlUber, destinoTexto, urlInstagram, cuentasInstagram } from '../lib/enlaces.mjs';

// Lo que se hace con una función fuera de la app: ver el Instagram del grupo y
// pedir el carro a la sala. Botones sueltos: el que los pone decide la fila.
//
// DiDi no publica un enlace que reciba el destino, así que su botón copia la
// dirección para pegarla en «¿A dónde vas?» y, en Android, abre la app.

const DIDI_ANDROID = 'intent:#Intent;action=android.intent.action.MAIN;'
  + 'category=android.intent.category.LAUNCHER;package=com.didiglobal.passenger;end';

export default function Salidas({ funcion }) {
  const [copiado, setCopiado] = useState(false);
  const cuentas = cuentasInstagram(funcion);
  const ig = cuentas.length ? null : urlInstagram(funcion);
  const uber = urlUber(funcion.sala);
  const destino = destinoTexto(funcion.sala);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(destino);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 6000);
    } catch {
      window.prompt('Copia la dirección y pégala en DiDi:', destino);
    }
    // En Android, Chrome abre la app por su paquete; si no está, va a la
    // tienda. iOS no tiene un enlace público de DiDi: ahí solo se copia.
    if (/Android/i.test(navigator.userAgent)) window.location.href = DIDI_ANDROID;
  }

  return (
    <>
      {/* Una cuenta: «Instagram». Varias (directora, actriz): la cuenta en el botón. */}
      {cuentas.map(c => (
        <a key={c.cuenta} className="boton" data-tam="chico" href={c.url} target="_blank" rel="noopener noreferrer"
           aria-label={`Instagram @${c.cuenta}`}>
          {cuentas.length > 1 ? `@${c.cuenta}` : 'Instagram'}
        </a>
      ))}
      {ig && (
        <a className="boton" data-tam="chico" href={ig} target="_blank" rel="noopener noreferrer"
           aria-label={`Buscar el Instagram de ${funcion.obra}`}>Buscar IG</a>
      )}
      {uber && (
        <a className="boton" data-tam="chico" href={uber} target="_blank" rel="noopener noreferrer"
           aria-label={`Pedir Uber a ${funcion.sala.nombre}`}>Uber</a>
      )}
      {destino && (
        <button type="button" className="boton" data-tam="chico" onClick={copiar} aria-live="polite"
                aria-label={`Copiar la dirección de ${funcion.sala.nombre} para DiDi`}>
          {copiado ? 'Copiada: pégala en DiDi' : 'DiDi'}
        </button>
      )}
    </>
  );
}
