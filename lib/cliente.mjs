'use client';
import { createClient } from '@supabase/supabase-js';
import { armarPanorama } from './panorama.mjs';

// Cliente del navegador para la app publicada en GitHub Pages.
//
// La llave publishable viaja en el bundle, como en cualquier app estática, y en
// este proyecto además ya está publicada en los repos de polla-app y viajes-app.
// Lo que protege los datos no es la llave: es el código de acceso, que Andrés
// escribe una vez, viaja en la cabecera x-acceso y Postgres verifica en RLS.
// Sin ese código las consultas devuelven cero filas, no un error: la base
// simplemente no tiene nada que mostrarle a quien no lo trae.

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const LLAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const BUCKET = 'baul-eventos';
export const CLAVE_LOCAL = 'canovaccio.codigo';

export function leerCodigo() {
  try { return localStorage.getItem(CLAVE_LOCAL) ?? ''; } catch { return ''; }
}

export function guardarCodigo(codigo) {
  try { localStorage.setItem(CLAVE_LOCAL, codigo); } catch { /* modo privado */ }
}

export function olvidarCodigo() {
  try { localStorage.removeItem(CLAVE_LOCAL); } catch { /* modo privado */ }
}

let cache = { codigo: null, cliente: null };

export function db(codigo = leerCodigo()) {
  if (cache.cliente && cache.codigo === codigo) return cache.cliente;
  cache = {
    codigo,
    cliente: createClient(URL_SUPABASE, LLAVE, {
      db: { schema: 'eventos' },
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-acceso': codigo } },
    }),
  };
  return cache.cliente;
}

async function traer(c, tabla, columnas = '*') {
  const { data, error } = await c.from(tabla).select(columnas);
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return data ?? [];
}

/** Lee todo el festival activo. Devuelve null si el código no abre nada. */
export async function cargarPanorama(codigo = leerCodigo()) {
  const c = db(codigo);

  const { data: festivales, error } = await c
    .from('festivales').select('*').order('fecha_inicio', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  if (!festivales?.length) return null;
  const festival = festivales[0];

  const [salas, funciones, boletas, estados, bitacora, traslados, archivos] = await Promise.all([
    traer(c, 'salas'),
    traer(c, 'funciones'),
    traer(c, 'boletas'),
    traer(c, 'estados_compra'),
    traer(c, 'bitacora'),
    traer(c, 'traslados'),
    traer(c, 'archivos'),
  ]);

  // El estado de extracción y la clave del archivo viven en archivos, no en la
  // boleta: un mismo PDF puede traer dos entradas.
  const porArchivo = Object.fromEntries(archivos.map(a => [a.id, a]));
  const boletasConArchivo = boletas.map(b => ({
    ...b,
    storage_key: porArchivo[b.archivo_id]?.storage_key ?? null,
    extraccion_estado: porArchivo[b.archivo_id]?.extraccion_estado ?? null,
  }));

  return armarPanorama({
    festival, salas,
    funciones: funciones.filter(f => f.festival_id === festival.id),
    boletas: boletasConArchivo,
    estados, bitacora,
    traslados: traslados.filter(t => t.ciudad === festival.ciudad),
  });
}

/** Comprueba el código sin traerse el festival entero. */
export async function codigoSirve(codigo) {
  try {
    const { data, error } = await db(codigo).from('festivales').select('id').limit(1);
    if (error) return false;
    return Boolean(data?.length);
  } catch { return false; }
}

export async function urlFirmada(storageKey, codigo = leerCodigo(), segundos = 3600, descargar = false) {
  const { data, error } = await db(codigo).storage.from(BUCKET)
    .createSignedUrl(storageKey, segundos, descargar ? { download: true } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function guardarJuicio({ funcion_id, texto, estrellas }, codigo = leerCodigo()) {
  const c = db(codigo);
  const { data: previa } = await c.from('bitacora').select('id').eq('funcion_id', funcion_id).limit(1);
  const fila = { funcion_id, texto, estrellas: estrellas || null, sincronizado_obsidian: null };
  const { error } = previa?.length
    ? await c.from('bitacora').update(fila).eq('id', previa[0].id)
    : await c.from('bitacora').insert(fila);
  if (error) throw new Error(error.message);
  return { actualizada: Boolean(previa?.length) };
}

export async function subirBoleta({ archivo, funcionId, festivalId, valor, clave }, codigo = leerCodigo()) {
  const c = db(codigo);
  const buffer = await archivo.arrayBuffer();
  const hash = await sha256(buffer);

  const { data: repetida } = await c.from('archivos').select('id').eq('hash_contenido', hash).limit(1);
  if (repetida?.length) {
    return { repetida: true, mensaje: 'Ese archivo ya estaba en el baúl.' };
  }

  const { error: errSubida } = await c.storage.from(BUCKET)
    .upload(clave, archivo, { contentType: archivo.type || 'application/octet-stream', upsert: false });
  if (errSubida && !/exists/i.test(errSubida.message)) throw new Error(errSubida.message);

  const { data: fila, error } = await c.from('archivos').insert({
    festival_id: festivalId ?? null,
    storage_key: clave,
    hash_contenido: hash,
    mime: archivo.type || null,
    origen: 'subida',
    extraccion_estado: 'pendiente',
  }).select('id').single();
  if (error) throw new Error(error.message);

  const { error: errBoleta } = await c.from('boletas').insert({
    funcion_id: funcionId ?? null,
    festival_id: festivalId ?? null,
    archivo_id: fila.id,
    pagina: 1,
    valor_ticket: valor ?? null,
  });
  if (errBoleta) throw new Error(errBoleta.message);

  return {
    repetida: false,
    mensaje: funcionId
      ? 'Guardado y vinculado. Si el archivo trae más de una boleta, la extracción las separa.'
      : 'Guardado sin vincular. Dime a qué función pertenece.',
  };
}

async function sha256(buffer) {
  const d = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
