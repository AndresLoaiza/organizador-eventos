import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';

// Acceso sin login: se abre una vez el enlace secreto y queda una cookie
// httpOnly de larga duración. El secreto vive solo en el servidor; el navegador
// nunca recibe una llave de Supabase.

export const COOKIE = 'canovaccio';
const DIAS = 120;

function iguales(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function secretoValido(valor) {
  const esperado = process.env.ACCESO_SECRETO;
  if (!esperado || !valor) return false;
  return iguales(valor, esperado);
}

export async function haySesion() {
  const c = await cookies();
  return secretoValido(c.get(COOKIE)?.value);
}

export function opcionesCookie() {
  return {
    name: COOKIE,
    value: process.env.ACCESO_SECRETO,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * DIAS,
  };
}
