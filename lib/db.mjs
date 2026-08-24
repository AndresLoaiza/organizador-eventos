// Solo servidor: este módulo nunca debe importarse desde un componente cliente.
import { createClient } from '@supabase/supabase-js';

// Cliente único de servidor. La service_role nunca sale de aquí: todo acceso a
// datos pasa por route handlers o server components, jamás por el navegador.
// Por eso no existe un cliente de Supabase del lado del cliente en este proyecto.

let cliente = null;

export function db() {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Copia .env.example a .env.local ' +
      'y toma los valores del proyecto nuestros-viajes.'
    );
  }
  cliente = createClient(url, key, {
    db: { schema: 'eventos' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export const BUCKET = 'baul-eventos';

/** URL firmada de corta vida para ver un original sin hacer público el bucket. */
export async function urlFirmada(storageKey, segundos = 300) {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(storageKey, segundos);
  if (error) throw error;
  return data.signedUrl;
}
