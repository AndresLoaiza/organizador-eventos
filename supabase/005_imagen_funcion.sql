-- Foto de la obra, recortada del volante.
--
-- El volante trae una foto por montaje con el nombre de la compañía impreso
-- encima en blanco. Ese rótulo cae dentro del recuadro de la imagen, así que
-- sirve para atribuir cada foto sin adivinar: se recorta por la caja de la
-- imagen y se leen las palabras que quedan dentro.
--
-- Una foto puede servir a varias funciones (la misma obra en dos fechas, o dos
-- obras de la misma compañía), por eso la clave va en la función y no al revés.

alter table eventos.funciones add column if not exists imagen_key text;
alter table eventos.funciones add column if not exists imagen_credito text;
