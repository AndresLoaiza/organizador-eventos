-- Bitácora de un toque (3 nov 2026).
--
-- Tres juicios en tres festivales: con el texto obligatorio, registrar costaba
-- demasiado. Ahora un toque en una estrella ya es un juicio y el texto viene
-- después. Deshace la decisión de agosto («el texto pesa más que la estrella y
-- por eso es obligatorio»): sigue pesando más, pero un juicio con solo
-- estrellas vale más que ninguno.

alter table eventos.bitacora alter column texto drop not null;

-- Media estrella: 0,5 a 5 en pasos de 0,5. Las filas viejas (enteras) caben.
alter table eventos.bitacora drop constraint if exists bitacora_estrellas_check;
alter table eventos.bitacora alter column estrellas type numeric(2,1);
alter table eventos.bitacora drop constraint if exists bitacora_estrellas_medias;
alter table eventos.bitacora add constraint bitacora_estrellas_medias
  check (estrellas between 0.5 and 5 and estrellas * 2 = floor(estrellas * 2));

-- «No fui»: agendaste, quizá pagaste, y no fuiste. Importa para el cierre del
-- festival, y no lleva estrellas.
alter table eventos.bitacora add column if not exists asistio boolean not null default true;
alter table eventos.bitacora drop constraint if exists bitacora_no_fui_sin_estrellas;
alter table eventos.bitacora add constraint bitacora_no_fui_sin_estrellas
  check (asistio or estrellas is null);

notify pgrst, 'reload schema';
