import { sql, poolPg, almacen, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';

// Verifica que el schema esté aplicado y crea el bucket privado del baúl.
// El DDL lo aplica npm run migrar, que va por Postgres directo.

const tablas = await sql(
  `select table_name from information_schema.tables
    where table_schema = 'eventos' order by table_name`);

if (!tablas.length) {
  console.error('El schema "eventos" no existe todavía. Corre primero: npm run migrar');
  await poolPg().end();
  process.exit(1);
}
console.log(`Schema eventos: ${tablas.length} tablas (${tablas.map(t => t.table_name).join(', ')}).`);

const storage = almacen();
if (!storage) {
  console.log(`\nBucket: no se pudo revisar. ${FALTA_LLAVE_STORAGE}`);
} else {
  const { data: buckets, error } = await storage.storage.listBuckets();
  if (error) {
    console.error(`No se pudo listar buckets: ${error.message}`);
  } else if (buckets.some(b => b.name === BUCKET)) {
    console.log(`Bucket ${BUCKET}: ya existía.`);
  } else {
    const { error: e } = await storage.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: '25MB',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
    });
    if (e) console.error(`No se pudo crear el bucket: ${e.message}`);
    else console.log(`Bucket ${BUCKET}: creado, privado.`);
  }
}

console.log(process.env.ACCESO_SECRETO ? 'ACCESO_SECRETO: definido.' : 'Falta ACCESO_SECRETO.');
await poolPg().end();
