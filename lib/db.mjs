// Solo servidor: este módulo nunca debe importarse desde un componente cliente.
import pg from 'pg';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ROOT_CA, HUELLA_ROOT } from './supabase-ca.mjs';

// Los datos van por Postgres directo, no por PostgREST. Dos razones: PostgREST
// no ejecuta DDL, y sobre todo, así la app no depende de la service_role, que en
// este proyecto de Supabase es compartida con polla-app y viajes-app. Una llave
// menos circulando.
//
// Storage sí necesita esa llave y no hay alternativa: los bytes viven en S3, no
// en la base. Mientras no exista, la app funciona completa salvo subir y ver
// archivos, y lo dice en vez de fallar en silencio.

function autoridades() {
  const huella = new crypto.X509Certificate(SUPABASE_ROOT_CA).fingerprint256;
  if (huella !== HUELLA_ROOT) {
    throw new Error(
      `La huella del root CA de Supabase no coincide con la verificada. ` +
      `Esperada ${HUELLA_ROOT}, leída ${huella}. No se conecta hasta aclararlo.`
    );
  }
  return [...tls.rootCertificates, SUPABASE_ROOT_CA];
}

let pool = null;

export function poolPg() {
  if (pool) return pool;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !pwd) {
    throw new Error(
      'Faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD. Copia .env.example a .env.local.'
    );
  }

  // 5432 es modo sesión y 6543 modo transacción. En serverless conviene el de
  // transacción, que no deja conexiones colgando entre invocaciones.
  const enVercel = Boolean(process.env.VERCEL);
  const puerto = Number(process.env.SUPABASE_DB_PORT ?? (enVercel ? 6543 : 5432));
  const host = process.env.SUPABASE_DB_HOST ?? 'aws-1-us-east-1.pooler.supabase.com';

  pool = new pg.Pool({
    host, port: puerto, user: `postgres.${ref}`, password: pwd, database: 'postgres',
    ssl: { rejectUnauthorized: true, ca: autoridades() },
    max: enVercel ? 1 : 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
  });
  return pool;
}

/**
 * Consulta parametrizada. Nunca interpolar valores en el texto: todo va por $1.
 * Supavisor a veces despierta frío y devuelve "connection to database not
 * available" en el primer intento, así que se reintenta una vez.
 */
export async function sql(texto, params = []) {
  const p = poolPg();
  try {
    const { rows } = await p.query(texto, params);
    return rows;
  } catch (e) {
    if (/not available|Connection terminated|ECONNRESET/i.test(e.message)) {
      const { rows } = await p.query(texto, params);
      return rows;
    }
    throw e;
  }
}

export async function unaFila(texto, params = []) {
  const filas = await sql(texto, params);
  return filas[0] ?? null;
}

export const BUCKET = 'baul-eventos';

/** Cliente de Storage, o null si todavía no hay llave secreta. */
export function almacen() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const FALTA_LLAVE_STORAGE =
  'Falta SUPABASE_SERVICE_ROLE_KEY. Sin ella no se pueden subir ni ver los archivos ' +
  'del baúl. Está en el panel de Supabase, en Project Settings > API Keys > secret key.';

/** URL firmada de corta vida para ver un original sin hacer público el bucket. */
export async function urlFirmada(storageKey, segundos = 300) {
  const a = almacen();
  if (!a) throw new Error(FALTA_LLAVE_STORAGE);
  const { data, error } = await a.storage.from(BUCKET).createSignedUrl(storageKey, segundos);
  if (error) throw error;
  return data.signedUrl;
}
