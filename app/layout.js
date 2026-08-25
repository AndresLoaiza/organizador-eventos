import './globals.css';
import { Archivo } from 'next/font/google';
import Nav from './Nav.js';

// Una sola familia con rango completo de peso. La jerarquía sale del contraste
// 800 contra 400, no de mezclar dos tipografías: en producto, dos familias son
// ruido y esta app se lee de reojo en la calle.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--fuente-archivo',
  display: 'swap',
});

export const metadata = {
  title: 'Canovaccio',
  description: 'Programación, boletas y bitácora de festivales',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#231d18' },
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={archivo.variable} suppressHydrationWarning>
      <body>
        <Nav />
        <main className="marco">{children}</main>
      </body>
    </html>
  );
}
