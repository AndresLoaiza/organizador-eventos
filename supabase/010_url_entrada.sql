-- Enlace para abrir/descargar cada entrada digital (una por boleta). NULL = sin enlace.
alter table eventos.boletas add column if not exists url_entrada text;
