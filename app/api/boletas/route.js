import { NextResponse } from 'next/server';
import { db } from '../../../lib/db.mjs';

export const runtime = 'nodejs';

const EDITABLES = [
  'funcion_id', 'festival_id', 'titular', 'categoria', 'valor_ticket', 'valor_servicio',
  'localidad', 'codigo', 'pulep', 'operador', 'extraccion_estado', 'campos_dudosos',
];

export async function PATCH(req) {
  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo?.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const cambios = {};
  for (const k of EDITABLES) if (k in cuerpo) cambios[k] = cuerpo[k];
  if (!Object.keys(cambios).length) {
    return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });
  }
  // Corregir a mano significa que un humano lo miró.
  if (!('extraccion_estado' in cambios)) cambios.extraccion_estado = 'confirmada';

  const { error } = await db().from('boletas').update(cambios).eq('id', cuerpo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
