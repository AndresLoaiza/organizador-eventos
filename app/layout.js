import './globals.css';
import Link from 'next/link';
import InterruptorTema from './InterruptorTema.js';

export const metadata = {
  title: 'Canovaccio',
  description: 'Programación, boletas y bitácora de festivales',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#211d19' },
  ],
};

const RUTAS = [
  { href: '/', txt: 'Esta noche' },
  { href: '/agenda', txt: 'Agenda' },
  { href: '/boletas', txt: 'Baúl' },
  { href: '/bitacora', txt: 'Bitácora' },
];

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <header className="barra">
          <nav>
            {RUTAS.map(r => (
              <Link key={r.href} href={r.href} className="tab">{r.txt}</Link>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto' }}><InterruptorTema /></div>
        </header>
        <main className="marco">{children}</main>
      </body>
    </html>
  );
}
