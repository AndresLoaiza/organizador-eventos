import { createHash } from 'node:crypto';

// Solo para scripts locales. El navegador usa crypto.subtle, que no existe en
// Node antiguo y cuya API es asíncrona; mezclarlos en un módulo compartido hace
// que el bundler intente empaquetar node:crypto y el build falle.

export function hashContenido(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
