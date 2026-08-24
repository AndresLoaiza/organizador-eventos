// Los scripts comparten la misma capa que la app: Postgres para datos, Storage
// solo cuando existe la llave secreta.
export { sql, unaFila, almacen, poolPg, BUCKET, FALTA_LLAVE_STORAGE } from '../lib/db.mjs';
