-- Triaje: "me interesa" antes de mirar choques.
--
-- Decidir qué ver y decidir qué se puede ver son dos preguntas, y mezclarlas
-- rompe la primera. En la Fiesta del Libro hay 776 funciones: si cada una llega
-- ya con un veredicto de choque encima, se elige contra el reloj en vez de
-- contra el gusto, y se descarta algo que interesa solo porque ese día ya
-- estaba ocupado. Primero se ojea sin restricciones; el motor de choques entra
-- después, y solo sobre lo que quedó marcado.
--
-- Tres estados, no un booleano: 'si', 'no' y NULL. NULL es "todavía no lo he
-- mirado", que con 776 filas es la mayoría y no es lo mismo que un "no".
-- Un booleano obligaría a fingir que todo lo no marcado fue descartado.

alter table eventos.funciones
  add column if not exists interes text
    check (interes in ('si', 'no'));

comment on column eventos.funciones.interes is
  'Triaje previo al decisor: si | no | null (sin ojear). Independiente de agendada.';

-- Se ojea día por día y franja por franja, siempre filtrando por lo que aún no
-- se ha mirado.
create index if not exists funciones_interes
  on eventos.funciones (festival_id, interes);
