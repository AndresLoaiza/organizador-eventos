import { NextResponse } from 'next/server';
import { db, BUCKET } from '../../../lib/db.mjs';
import { hashContenido, claveBoleta, claveHuerfana } from '../../../lib/nombres.mjs';
import { hoyMedellin } from '../../../lib/datos.mjs';

export const runtime = 'nodejs';

// El original entra una vez y no se toca más. Toda corrección posterior vive en
// columnas de la base, nunca en el archivo.

export async function POST(req) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No llegó el archivo.' }, { status: 400 });
  }

  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'El archivo llegó vacío.' }, { status: 400 });
  }
  const hash = hashContenido(buffer);
  const c = db();

  // Subir dos veces la misma foto no crea un duplicado ni sobrescribe nada.
  const { data: yaEsta } = await c.from('boletas')
    .select('id, storage_key').eq('hash_contenido', hash).maybeSingle();
  if (yaEsta) {
    return NextResponse.json(
      { ok: true, repetida: true, id: yaEsta.id, mensaje: 'Ese archivo ya estaba en el baúl.' });
  }

  const funcionId = form.get('funcion_id') || null;
  const festivalId = form.get('festival_id') || null;
  const mime = archivo.type || 'application/octet-stream';

  let clave;
  if (funcionId) {
    const { data: f } = await c.from('funciones')
      .select('fecha, hora_min, obra, festival_id, sala_id').eq('id', funcionId).single();
    const { data: sala } = f?.sala_id
      ? await c.from('salas').select('slug').eq('id', f.sala_id).single()
      : { data: null };
    const { data: fest } = await c.from('festivales')
      .select('slug').eq('id', f.festival_id).single();
    clave = claveBoleta(
      fest?.slug ?? 'festival',
      { fecha: f.fecha, hora_min: f.hora_min, obra: f.obra, salaSlug: sala?.slug ?? 'sin-sala' },
      hash, mime, archivo.name,
    );
  } else {
    clave = claveHuerfana(hash, mime, archivo.name, hoyMedellin());
  }

  const { error: errSubida } = await c.storage.from(BUCKET)
    .upload(clave, buffer, { contentType: mime, upsert: false });
  if (errSubida && !/exists/i.test(errSubida.message)) {
    return NextResponse.json({ error: `Storage: ${errSubida.message}` }, { status: 500 });
  }

  const valor = form.get('valor_ticket');
  const { data: fila, error } = await c.from('boletas').insert({
    funcion_id: funcionId,
    festival_id: festivalId || null,
    storage_key: clave,
    hash_contenido: hash,
    mime,
    titular: form.get('titular') || null,
    valor_ticket: valor ? Number(valor) : null,
    origen: form.get('origen') || 'subida',
    extraccion_estado: 'pendiente',
    extraccion_json: form.get('obra_texto') ? { obra_texto: form.get('obra_texto') } : null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true, id: fila.id, storage_key: clave,
    mensaje: funcionId
      ? 'Guardada y vinculada. La extracción completa queda pendiente.'
      : 'Guardada sin vincular. Dime a qué función pertenece.',
  });
}
