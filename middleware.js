import { NextResponse } from 'next/server';

// Sin login: una cookie httpOnly puesta por /entrar. El middleware solo compara;
// ninguna llave de Supabase llega jamás al navegador.

const LIBRES = ['/entrar', '/_next', '/favicon', '/manifest'];

export function middleware(req) {
  const { pathname, searchParams } = req.nextUrl;
  if (LIBRES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get('canovaccio')?.value;
  if (cookie && cookie === process.env.ACCESO_SECRETO) return NextResponse.next();

  // Permite pegar el enlace secreto directo sobre cualquier ruta.
  const k = searchParams.get('k');
  if (k && k === process.env.ACCESO_SECRETO) {
    const limpia = req.nextUrl.clone();
    limpia.searchParams.delete('k');
    const res = NextResponse.redirect(limpia);
    res.cookies.set('canovaccio', k, {
      httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 60 * 60 * 24 * 120,
    });
    return res;
  }

  return new NextResponse('No.', { status: 404 });
}

export const config = { matcher: '/((?!_next/static|_next/image).*)' };
