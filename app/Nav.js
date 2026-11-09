'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InterruptorTema from './InterruptorTema.js';

const RUTAS = [
  { href: '/', txt: 'Esta noche' },
  { href: '/agenda', txt: 'Agenda' },
  { href: '/ojear', txt: 'Ojear' },
  { href: '/cine', txt: 'Cine' },
  { href: '/decidir', txt: 'Decidir' },
  { href: '/boletas', txt: 'Baúl' },
  { href: '/bitacora', txt: 'Bitácora' },
];

export default function Nav() {
  const ruta = usePathname();
  const activa = h => (h === '/' ? ruta === '/' : ruta.startsWith(h));
  // En el celular no caben las siete: la barra se desliza hasta la pestaña
  // activa para que se vea dónde estás.
  useEffect(() => {
    document.querySelector('.barra [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [ruta]);

  return (
    <header className="barra">
      <nav>
        {RUTAS.map(r => (
          <Link
            key={r.href} href={r.href} className="tab"
            aria-current={activa(r.href) ? 'page' : undefined}
            style={activa(r.href)
              ? { color: 'var(--tinta)', borderBottomColor: 'var(--acento)' }
              : undefined}
          >
            {r.txt}
          </Link>
        ))}
      </nav>
      <div style={{ marginLeft: 'auto' }}><InterruptorTema /></div>
    </header>
  );
}
