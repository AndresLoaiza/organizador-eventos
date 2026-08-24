import { NextResponse } from 'next/server';
import { sql, unaFila } from '../../../lib/db.mjs';

export const runtime = 'nodejs';

// El texto es obligatorio y las estrellas no. Es a propósito: "me aburrió la
// primera media hora pero el final valió" sirve para recomendar; un 3 sobre 5
// no. El orden del formulario dice lo mismo.

export async function POST(req) {
  const cuerpo = await req.json().catch(() => null);
  const texto = (cuerpo?.texto ?? '').trim();
  if (!cuerpo?.funcion_id) return NextResponse.json({ error: 'Falta la función.' }, { status: 400 });
  if (!texto) return NextResponse.json({ error: 'Escribe qué te pareció, aunque sea una línea.' }, { status: 400 });

  const estrellas = cuerpo.estrellas ? Number(cuerpo.estrellas) : null;
  if (estrellas != null && (estrellas < 1 || estrellas > 5)) {
    return NextResponse.json({ error: 'Las estrellas van de 1 a 5.' }, { status: 400 });
  }

  try {
    const previa = await unaFila(
      'select id from eventos.bitacora where funcion_id = $1', [cuerpo.funcion_id]);

    if (previa) {
      await sql(
        `update eventos.bitacora
            set texto = $2, estrellas = $3, sincronizado_obsidian = null
          where id = $1`,
        [previa.id, texto, estrellas]);
    } else {
      await sql(
        `insert into eventos.bitacora (funcion_id, texto, estrellas)
         values ($1, $2, $3)`,
        [cuerpo.funcion_id, texto, estrellas]);
    }
    return NextResponse.json({ ok: true, actualizada: Boolean(previa) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
