import { writeFile, rm } from 'node:fs/promises';
import process from 'node:process';

// Entrar a la app en desarrollo sin escribir el código a mano y sin que el
// código pase por la terminal ni por el chat.
//
// Escribe public/_entrar-local.html, que guarda el código en localStorage del
// navegador (mismo origen que `npm run dev`) y redirige a la app. A los 60 s
// borra el archivo. Nunca imprime el código. El archivo está en .gitignore.
//
//   node --env-file=.env.local scripts/entrar-local.mjs
//   luego abrir http://localhost:<puerto>/_entrar-local.html

const codigo = process.env.CODIGO_ACCESO?.trim();
if (!codigo) { console.error('Falta CODIGO_ACCESO en .env.local.'); process.exit(1); }

const ruta = new URL('../public/_entrar-local.html', import.meta.url);
await writeFile(ruta,
  `<!doctype html><meta charset="utf-8"><script>` +
  `localStorage.setItem("canovaccio.codigo", ${JSON.stringify(codigo)});location.replace("/");` +
  `</script>`);
console.log('Página temporal lista: /_entrar-local.html (se borra en 60 s).');

setTimeout(async () => {
  await rm(ruta, { force: true });
  console.log('Página temporal borrada.');
}, 60_000);
