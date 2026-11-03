-- Campos de la ficha que antes iban pegados dentro de compania y nota_boleteria.
-- Las columnas viejas se siguen llenando (recompuestas) hasta que las pantallas
-- lean estas; ver lib/legado.mjs.

alter table eventos.funciones add column if not exists descripcion text;
alter table eventos.funciones add column if not exists franjas text[];
alter table eventos.funciones add column if not exists publico text;

comment on column eventos.funciones.franjas is
  'Franjas de programación del organizador. Un evento puede estar en varias.';

notify pgrst, 'reload schema';
