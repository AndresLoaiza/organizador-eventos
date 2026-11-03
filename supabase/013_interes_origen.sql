-- De dónde viene cada marca de interés: manual (una obra a la vez), lote
-- («Descartar las N sin resaltar») o NULL = desconocido (marcas anteriores a
-- esta columna, que mezclan las dos cosas sin forma de separarlas).

alter table eventos.funciones add column if not exists interes_origen text
  check (interes_origen in ('manual', 'lote'));

comment on column eventos.funciones.interes_origen is
  'manual | lote | NULL desconocido. Solo cuenta como juicio de la obra el manual.';

notify pgrst, 'reload schema';
