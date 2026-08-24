import { NextResponse } from 'next/server';
import { sql, unaFila, almacen, BUCKET, FALTA_LLAVE_STORAGE } from '../../../lib/db.mjs';
import { hashContenido, claveBoleta, claveHuerfana } from '../../../lib/nombres.mjs';
import { hoyMedellin } from '../../../lib/datos.mjs';

export const runtime = 'nodejs';

// El original entra una vez y no se toca más. Toda corrección posterior vive en
// columnas de la base, nunca en el archivo.

export async function POST(req) {
  const storage = almacen();
  if (!storage) {
    return NextResponse.json({ error: FALTA_LLAVE_STORAGE }, { status: 503 });
  }

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

  try {
    // Subir dos veces la misma foto no crea un duplicado ni sobrescribe nada.
    const yaEsta = await unaFila(
      'select id from eventos.boletas where hash_contenido = $1', [hash]);
    if (yaEsta) {
      return NextResponse.json({
        ok: true, repetida: true, id: yaEsta.id,
        mensaje: 'Ese archivo ya estaba en el baúl.',
      });
    }

    const funcionId = form.get('funcion_id') || null;
    const festivalId = form.get('festival_id') || null;
    const mime = archivo.type || 'application/octet-stream';

    let clave;
    if (funcionId) {
      const f = await unaFila(
        `select f.fecha, f.hora_min, f.obra, f.festival_id,
                s.slug as sala_slug, fe.slug as festival_slug
           from eventos.funciones f
           left join eventos.salas s on s.id = f.sala_id
           left join eventos.festivales fe on fe.id = f.festival_id
          where f.id = $1`, [funcionId]);
      if (!f) return NextResponse.json({ error: 'Esa función no existe.' }, { status: 400 });
      const fecha = typeof f.fecha === 'string' ? f.fecha.slice(0, 10)
        : f.fecha.toISOString().slice(0, 10);
      clave = claveBoleta(
        f.festival_slug ?? 'festival',
        { fecha, hora_min: f.hora_min, obra: f.obra, salaSlug: f.sala_slug ?? 'sin-sala' },
        hash, mime, archivo.name,
      );
    } else {
      clave = claveHuerfana(hash, mime, archivo.name, hoyMedellin());
    }

    const { error: errSubida } = await storage.storage.from(BUCKET)
      .upload(clave, buffer, { contentType: mime, upsert: false });
    if (errSubida && !/exists/i.test(errSubida.message)) {
      return NextResponse.json({ error: `Storage: ${errSubida.message}` }, { status: 500 });
    }

    const valor = form.get('valor_ticket');
    const obraTexto = form.get('obra_texto');
    const fila = await unaFila(
      `insert into eventos.boletas
         (funcion_id, festival_id, storage_key, hash_contenido, mime, titular,
          valor_ticket, origen, extraccion_estado, extraccion_json)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente', $9)
       returning id`,
      [
        funcionId, festivalId || null, clave, hash, mime,
        form.get('titular') || null,
        valor ? Number(valor) : null,
        form.get('origen') || 'subida',
        obraTexto ? JSON.stringify({ obra_texto: obraTexto }) : null,
      ]);

    return NextResponse.json({
      ok: true, id: fila.id, storage_key: clave,
      mensaje: funcionId
        ? 'Guardada y vinculada. La extracción completa queda pendiente.'
        : 'Guardada sin vincular. Dime a qué función pertenece.',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
