'use client';
import { estrellasDeToque, numeroEstrellas } from '../lib/juicio.mjs';

// Cinco estrellas de 64 px con media estrella: la mitad izquierda de cada una
// pone media, la derecha la pone entera. Cada mitad mide 32 px, por debajo de
// los 44 que piden las guías táctiles; lo compensa que cada mitad tiene su
// nombre para lectores de pantalla y que el número se ve al lado al tocar.
// Volver a tocar el mismo valor lo quita.

export default function Estrellas({ valor, alCambiar, deshabilitado = false, rotulo = 'Estrellas' }) {
  const v = Number(valor) || 0;
  return (
    <div className="estrellas-toque" role="group" aria-label={rotulo}>
      {[1, 2, 3, 4, 5].map(n => {
        const lleno = v >= n ? 100 : v >= n - 0.5 ? 50 : 0;
        return (
          <span className="estrella" key={n}>
            <span className="vacia" aria-hidden="true">☆</span>
            <span className="llena" aria-hidden="true" style={{ width: `${lleno}%` }}>
              <span>★</span>
            </span>
            {[true, false].map(izquierda => {
              const x = estrellasDeToque(n, izquierda);
              return (
                <button
                  key={izquierda ? 'izq' : 'der'} type="button"
                  className={`mitad ${izquierda ? 'izq' : 'der'}`}
                  disabled={deshabilitado}
                  aria-label={`${numeroEstrellas(x)} ${x === 1 ? 'estrella' : 'estrellas'}`}
                  aria-pressed={v === x}
                  onClick={() => alCambiar(v === x ? 0 : x)}
                />
              );
            })}
          </span>
        );
      })}
      <span className="estrellas-numero num" aria-live="polite">{v ? numeroEstrellas(v) : ''}</span>
    </div>
  );
}
