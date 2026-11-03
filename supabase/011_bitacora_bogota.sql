-- La fecha de un juicio es el día en Medellín, no en UTC. Con current_date el
-- servidor (UTC) fechaba como "mañana" todo juicio guardado después de las 7 p.m.
-- Pasó el 2 nov 2026: Mohammed y Winnipeg quedaron con fecha 3 nov.

alter table eventos.bitacora
  alter column fecha set default ((now() at time zone 'America/Bogota')::date);

-- Idempotente: solo toca filas cuya fecha no coincide con su día en Bogotá.
update eventos.bitacora
   set fecha = (creado at time zone 'America/Bogota')::date
 where fecha <> (creado at time zone 'America/Bogota')::date;

notify pgrst, 'reload schema';
