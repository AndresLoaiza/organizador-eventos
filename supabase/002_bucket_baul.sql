-- Bucket privado del baúl. Se crea por SQL para no depender de la llave secreta:
-- así queda listo desde el primer día y lo único que falta cuando aparezca la
-- llave es subir los archivos.
--
-- Sin políticas de acceso a propósito: solo la service_role, que salta RLS,
-- puede leer o escribir. La llave publishable de este proyecto va dentro de los
-- bundles públicos de polla-app y viajes-app, así que cualquier política que la
-- admitiera dejaría el baúl abierto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'baul-eventos', 'baul-eventos', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
