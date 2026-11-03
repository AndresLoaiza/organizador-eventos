-- El evento de Google Calendar de cada función agendada (calendario «Festivales»).
-- Lo escribe la sincronización en sesión; ver lib/calendario.mjs.

alter table eventos.funciones add column if not exists calendar_event_id text;

notify pgrst, 'reload schema';
