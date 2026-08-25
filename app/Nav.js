'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InterruptorTema from './InterruptorTema.js';

const RUTAS = [
  { href: '/', txt: 'Esta noche' },
  { href: '/agenda', txt: 'Agenda' },
  { href: '/boletas', txt: 'Baúl' },
  { href: '/bitacora', txt: 'Bitácora' },
];

export default function Nav() {
  const ruta = usePathname();
  const activa = h => (h === '/' ? ruta === '/' : ruta.startsWith(h));

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
