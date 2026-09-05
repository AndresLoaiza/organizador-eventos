-- "Gratis" y "no lo sé" no son lo mismo, y con un entero NOT NULL DEFAULT 0 se
-- volvían indistinguibles.
--
-- La Fiesta del Libro es de entrada libre de verdad: ahí el cero es un dato.
-- El Festival San Ignacio cobra por tarifas escalonadas TA/TB/TC/TD según
-- afiliación a Comfama, pero no publica ninguna en el sitio. Cargarlo con cero
-- hacía que la agenda dijera "Entrada libre" sobre funciones que se pagan, y
-- que la tabla de pendientes mostrara un costo de $0 que parece un hecho.
--
-- NULL pasa a significar "no publicado". Cero sigue significando gratis.

alter table eventos.funciones alter column precio_pleno drop not null;
alter table eventos.funciones alter column precio_pleno drop default;

update eventos.funciones set precio_pleno = null
 where precio_pleno = 0
   and festival_id in (select id from eventos.festivales
                        where slug = 'festival-teatro-san-ignacio-2026');

comment on column eventos.funciones.precio_pleno is
  'Tarifa plena en pesos. 0 = entrada libre. NULL = el organizador no la publicó.';
