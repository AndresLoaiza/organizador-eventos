import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db.mjs';

export const runtime = 'nodejs';

const EDITABLES = [
  'funcion_id', 'festival_id', 'titular', 'categoria', 'valor_ticket', 'valor_servicio',
  'localidad', 'codigo', 'pulep', 'operador', 'extraccion_estado', 'campos_dudosos',
];

export async function PATCH(req) {
  const cuerpo = await req.json().catch(() => null);
  if (!cuerpo?.id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  const columnas = EDITABLES.filter(k => k in cuerpo);
  if (!columnas.length) return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });

  // Corregir a mano significa que un humano lo miró.
  if (!columnas.includes('extraccion_estado')) {
    columnas.push('extraccion_estado');
    cuerpo.extraccion_estado = 'confirmada';
  }

  // Los nombres de columna salen de una lista fija, nunca del cuerpo del
  // request; los valores van todos parametrizados.
  const asignaciones = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const valores = columnas.map(c => cuerpo[c]);

  try {
    await sql(`update eventos.boletas set ${asignaciones} where id = $1`, [cuerpo.id, ...valores]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
