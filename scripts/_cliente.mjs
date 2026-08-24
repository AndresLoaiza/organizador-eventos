import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corre npm run setup.');
  process.exit(1);
}

export const BUCKET = 'baul-eventos';
export const datos = createClient(URL, KEY, { db: { schema: 'eventos' }, auth: { persistSession: false } });
export const almacen = createClient(URL, KEY, { auth: { persistSession: false } });
