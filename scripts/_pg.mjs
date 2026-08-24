import pg from 'pg';
import process from 'node:process';
import tls from 'node:tls';
import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';

// Conexión directa a Postgres para DDL y siembra. La app en runtime NO usa esto:
// va por los route handlers con supabase-js. Aquí hace falta porque PostgREST no
// ejecuta DDL, y porque sembrar en una transacción es más seguro que veinte
// upserts sueltos.

// Supabase firma los certificados de Postgres con su propia autoridad:
//   *.pooler.supabase.com  <-  Supabase Intermediate 2021 CA  <-  Supabase Root 2021 CA
//
// Ese root no está en el bundle de Node, así que sin él toda conexión muere con
// "self-signed certificate in certificate chain". La salida NO es apagar la
// verificación: es sumar ese root a los de Node y además comprobar su huella,
// para que solo se acepte esa cadena y no cualquier certificado que alguien
// logre colar en medio.
//
// Huella verificada el 24 de agosto de 2026. Si cambia, algo pasó: confírmala
// contra el certificado que ofrece el panel de Supabase antes de actualizarla.
const HUELLA_ROOT =
  '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';

function autoridades() {
  const ruta = new URL('../certs/supabase-root-2021.pem', import.meta.url);
  if (!existsSync(ruta)) {
    console.error('Falta certs/supabase-root-2021.pem, el root CA de Supabase.');
    process.exit(1);
  }
  const pem = readFileSync(ruta, 'utf8');
  const huella = new crypto.X509Certificate(pem).fingerprint256;
  if (huella !== HUELLA_ROOT) {
    console.error('La huella del root CA no coincide con la verificada.');
    console.error(`  esperada: ${HUELLA_ROOT}`);
    console.error(`  leída:    ${huella}`);
    process.exit(1);
  }
  return [...tls.rootCertificates, pem];
}

const CA = autoridades();

const REF = process.env.SUPABASE_PROJECT_REF;
const PWD = process.env.SUPABASE_DB_PASSWORD;

if (!REF || !PWD) {
  console.error('Faltan SUPABASE_PROJECT_REF o SUPABASE_DB_PASSWORD en .env.local.');
  process.exit(1);
}

// El host directo db.<ref>.supabase.co resuelve SOLO a IPv6 y esta red no tiene
// ruta IPv6, así que muere por timeout. El camino real es el pooler en la región
// del proyecto (us-east-1, deducida del rango 2600:1f18 al que resuelve el
// directo), en puerto 5432 = modo sesión, que es el que admite DDL y
// transacciones. El 6543 es modo transacción y no sirve para migrar.
const CANDIDATOS = [
  { host: 'aws-1-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
];

export async function conectar() {
  const errores = [];
  for (const c of CANDIDATOS) {
    const cliente = new pg.Client({
      host: c.host, port: c.port, user: c.user,
      password: PWD, database: 'postgres',
      ssl: { rejectUnauthorized: true, ca: CA },
      connectionTimeoutMillis: 30000,
      statement_timeout: 60000,
    });
    try {
      await cliente.connect();
      await cliente.query('select 1');
      console.log(`Conectado por ${c.host}`);
      return cliente;
    } catch (e) {
      errores.push(`${c.host}: ${e.message}`);
      try { await cliente.end(); } catch { /* ya estaba caído */ }
    }
  }
  console.error('No se pudo conectar a Postgres por ninguna ruta:');
  for (const e of errores) console.error('  ' + e);
  process.exit(1);
}
