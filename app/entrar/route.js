import { NextResponse } from 'next/server';
import { secretoValido, opcionesCookie } from '../../lib/sesion.mjs';

// Se abre una vez desde el celular. A partir de ahí no hay nada que recordar.
export async function GET(req) {
  const k = new URL(req.url).searchParams.get('k');
  if (!secretoValido(k)) return new NextResponse('No.', { status: 404 });

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(opcionesCookie());
  return res;
}
