'use client';
import { useEffect, useState } from 'react';

// Tres estados reales: sistema, claro, oscuro. Ninguno es el bueno por defecto;
// la app se usa de día en el escritorio y de noche en la calle.
const CICLO = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' };
const ROTULO = { sistema: 'Auto', claro: 'Claro', oscuro: 'Oscuro' };

export default function InterruptorTema() {
  const [tema, setTema] = useState('sistema');

  useEffect(() => {
    const guardado = localStorage.getItem('tema');
    if (guardado && ROTULO[guardado]) aplicar(guardado, setTema);
  }, []);

  return (
    <button
      className="boton"
      style={{ minWidth: '5.5rem', padding: '0 0.75rem' }}
      onClick={() => aplicar(CICLO[tema], setTema)}
      aria-label={`Tema: ${ROTULO[tema]}. Cambiar a ${ROTULO[CICLO[tema]]}`}
    >
      {ROTULO[tema]}
    </button>
  );
}

function aplicar(nuevo, setTema) {
  setTema(nuevo);
  try {
    localStorage.setItem('tema', nuevo);
    const raiz = document.documentElement;
    if (nuevo === 'sistema') raiz.removeAttribute('data-tema');
    else raiz.setAttribute('data-tema', nuevo);
  } catch { /* modo privado: el tema simplemente sigue al sistema */ }
}
