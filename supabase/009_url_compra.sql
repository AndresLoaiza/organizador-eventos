-- Dónde se compra la boleta de una función. NULL = el sitio no publica enlace.
alter table eventos.funciones add column if not exists url_compra text;
