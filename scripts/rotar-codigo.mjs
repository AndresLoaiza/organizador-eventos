import crypto from 'node:crypto';
import { sql, poolPg } from './_cliente.mjs';

// Genera un código nuevo, guarda solo su hash en la base y lo imprime una vez.
// El código no queda en ningún archivo del repositorio: si el repo se hace
// público para usar GitHub Pages, no hay nada que romper por fuerza bruta.

const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';   // sin l, o, 0, 1
const bytes = crypto.randomBytes(20);
const codigo = [...bytes].map(b => alfabeto[b % alfabeto.length]).join('')
  .replace(/(.{5})(?=.)/g, '$1-');

const hash = crypto.createHash('sha256').update(codigo).digest('hex');

await sql(
  `insert into eventos.acceso (id, hash, puesto) values (1, $1, now())
   on conflict (id) do update set hash = excluded.hash, puesto = now()`,
  [hash]);

console.log('\nCódigo de acceso nuevo:\n');
console.log('   ' + codigo + '\n');
console.log('Escríbelo una vez en la app. Queda guardado en ese navegador.');
console.log('El anterior dejó de servir en este momento.');
console.log('No queda en ningún archivo del repositorio: si lo pierdes, vuelve a correr esto.\n');

await poolPg().end();
