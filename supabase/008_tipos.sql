-- Tipo de obra (clown, títeres y objetos, teatro físico…), para poder filtrar
-- un festival de teatro por lo que de verdad cambia la decisión: no es lo mismo
-- una hora de clown que una de drama de texto.
--
-- Es una lista y no un valor: una obra puede ser danza-teatro y teatro musical.
-- NULL significa "sin clasificar" (no hay información que lo sostenga), no
-- "ninguno": se distingue a propósito de un arreglo vacío.

alter table eventos.funciones add column if not exists tipos text[];

comment on column eventos.funciones.tipos is
  'Técnica escénica de la obra, varias posibles. NULL = sin clasificar.';
