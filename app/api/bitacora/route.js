import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.mjs';

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

  const c = db();
  const { data: previa } = await c.from('bitacora')
    .select('id').eq('funcion_id', cuerpo.funcion_id).maybeSingle();

  const fila = { funcion_id: cuerpo.funcion_id, texto, estrellas, sincronizado_obsidian: null };
  const { error } = previa
    ? await c.from('bitacora').update(fila).eq('id', previa.id)
    : await c.from('bitacora').insert(fila);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, actualizada: Boolean(previa) });
}
