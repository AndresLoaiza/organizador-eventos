import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

// supabase-js no ejecuta DDL, así que el schema se pega una vez en el editor SQL
// del proyecto. Este script verifica que quedó bien y crea el bucket.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'baul-eventos';

if (!URL || !KEY) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Copia .env.example a .env.local y toma los valores del proyecto nuestros-viajes\n' +
    '(están en D:\\ANDRES\\Claude_Projects\\Consulta_Viajes\\viajes-app\\.env).'
  );
  process.exit(1);
}

const c = createClient(URL, KEY, { db: { schema: 'eventos' }, auth: { persistSession: false } });

const { error } = await c.from('festivales').select('id').limit(1);
if (error) {
  const sql = await readFile(new URL('../supabase/001_schema_eventos.sql', import.meta.url), 'utf8');
  console.error(
    `El schema "eventos" todavía no existe (${error.message}).\n\n` +
    'Abre el editor SQL del proyecto en Supabase, pega el contenido de\n' +
    'supabase/001_schema_eventos.sql y córrelo. Son ' + sql.split('\n').length + ' líneas.\n' +
    'Después vuelve a correr npm run setup.'
  );
  process.exit(1);
}
console.log('Schema eventos: listo.');

const almacen = createClient(URL, KEY, { auth: { persistSession: false } });
const { data: buckets } = await almacen.storage.listBuckets();
if (buckets?.some(b => b.name === BUCKET)) {
  console.log(`Bucket ${BUCKET}: ya existía.`);
} else {
  const { error: e } = await almacen.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '25MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  });
  if (e) { console.error(`No se pudo crear el bucket: ${e.message}`); process.exit(1); }
  console.log(`Bucket ${BUCKET}: creado, privado.`);
}

if (!process.env.ACCESO_SECRETO) {
  console.log(
    '\nFalta ACCESO_SECRETO. Genera uno y ponlo en .env.local y en Vercel:\n' +
    '  node -e "console.log(crypto.randomUUID())"\n' +
    'Después entras una sola vez con  https://TU-APP/entrar?k=ESE_VALOR'
  );
} else {
  console.log('ACCESO_SECRETO: definido.');
}

console.log('\nSiguiente: npm run seed');
