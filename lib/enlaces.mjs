// Enlaces hacia afuera desde una función: el Instagram del grupo y el carro a la sala.

import { companiaReal } from './evidencia.mjs';

/**
 * Uber con el destino puesto y la recogida donde estés. Su enlace universal
 * abre la app si está instalada y si no, la web. Sin coordenadas no hay
 * enlace: la dirección sola no la ubica.
 */
export function urlUber(sala) {
  if (sala?.lat == null || sala?.lng == null) return null;
  const p = new URLSearchParams({
    action: 'setPickup',
    pickup: 'my_location',
    'dropoff[latitude]': String(sala.lat),
    'dropoff[longitude]': String(sala.lng),
    'dropoff[nickname]': sala.nombre ?? '',
  });
  if (sala.direccion) p.set('dropoff[formatted_address]', `${sala.direccion}, ${sala.ciudad ?? 'Medellín'}`);
  return `https://m.uber.com/ul/?${p}`;
}

/**
 * Lo que se pega en DiDi. DiDi no publica un enlace que reciba el destino, así
 * que la app copia esto y el usuario lo pega en «¿A dónde vas?».
 */
export function destinoTexto(sala) {
  if (!sala?.nombre) return null;
  const dir = sala.direccion?.split(' · ')[0];   // sin el teléfono
  const partes = [sala.nombre];
  if (dir && !dir.startsWith(sala.nombre)) partes.push(dir);
  partes.push(sala.ciudad ?? 'Medellín');
  return partes.join(', ');
}

/**
 * Las cuentas de Instagram de quienes hacen la obra (funciones.instagram,
 * separadas por espacio: el grupo, o directora y actriz si el grupo no tiene).
 * Cada una abre el perfil, que el celular abre en la app.
 */
export function cuentasInstagram(f) {
  return (f.instagram ?? '').split(/[\s,]+/).map(c => c.replace(/^@/, '')).filter(Boolean)
    .map(cuenta => ({ cuenta, url: `https://www.instagram.com/${encodeURIComponent(cuenta)}/` }));
}

/** Sin cuenta confirmada: búsqueda en Google acotada a instagram.com. No abre la app. */
export function urlInstagram(f) {
  const quien = companiaReal(f) || f.obra;
  if (!quien) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${quien}`)}`;
}
