export const dynamic = 'force-static';

// Permite "Instalar app" / "Añadir a pantalla de inicio". En Pages la app vive
// bajo /organizador-eventos, así que ruta y recursos llevan el prefijo.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/organizador-eventos' : '';

export default function manifest() {
  return {
    name: 'Canovaccio',
    short_name: 'Canovaccio',
    description: 'Programación, boletas y bitácora de festivales',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#231d18',
    theme_color: '#231d18',
    lang: 'es',
    icons: [
      { src: `${base}/icono-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `${base}/icono-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
