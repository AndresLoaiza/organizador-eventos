import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marca, idDeMarca, horasEvento, descripcionEvento, urlPlantilla, eventoDeseado, planCalendario } from './calendario.mjs';

const F = x => ({
  id: 'abc-123', obra: 'Cariño malo', fecha: '2026-11-01', hora_min: 1170, duracion_min: 75,
  duracion_confirmada: true, agendada: true,
  sala: { nombre: 'Teatro Matacandelas', direccion: 'Clle. 47 #43-47' },
  estado: 'comprada', boletas: [{}], necesarias: 1, ...x,
});

test('la marca identifica la función y se puede leer de vuelta', () => {
  assert.equal(marca('abc-123'), '[oe:abc-123]');
  assert.equal(idDeMarca('Sala…\n[oe:abc-123]'), 'abc-123');
  assert.equal(idDeMarca('un evento cualquiera'), null);
  assert.equal(idDeMarca(null), null);
});

test('horas en hora local, y la duración define el fin', () => {
  assert.deepEqual(horasEvento(F()), { inicio: '2026-11-01T19:30:00', fin: '2026-11-01T20:45:00' });
});

test('una función que termina después de medianoche termina al día siguiente', () => {
  assert.deepEqual(horasEvento(F({ hora_min: 1320, duracion_min: 120 })),
    { inicio: '2026-11-01T22:00:00', fin: '2026-11-02T00:00:00' });
});

test('la descripción dice sala, boleta y si la duración es estimada, y lleva la marca', () => {
  const d = descripcionEvento(F({ duracion_confirmada: false, estado: 'agendada', boletas: [], necesarias: 2 }));
  assert.match(d, /Teatro Matacandelas/);
  assert.match(d, /Boleta: falta \(0 de 2\)/);
  assert.match(d, /Duración estimada/);
  assert.match(d, /\[oe:abc-123\]$/);
  assert.match(descripcionEvento(F()), /Boleta: comprada/);
});

test('el enlace de plantilla abre Google Calendar con el evento lleno', () => {
  const u = new URL(urlPlantilla(F()));
  assert.equal(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('text'), 'Cariño malo');
  assert.equal(u.searchParams.get('dates'), '20261101T193000/20261101T204500');
  assert.equal(u.searchParams.get('ctz'), 'America/Bogota');
  assert.equal(u.searchParams.get('location'), 'Teatro Matacandelas, Clle. 47 #43-47');
  assert.match(u.searchParams.get('details'), /\[oe:abc-123\]/);
});

test('el evento que se quiere en el calendario, con recordatorio de 45 min', () => {
  const e = eventoDeseado(F());
  assert.equal(e.summary, 'Cariño malo');
  assert.equal(e.startTime, '2026-11-01T19:30:00');
  assert.equal(e.location, 'Teatro Matacandelas, Clle. 47 #43-47');
  assert.deepEqual(e.reminders, [{ method: 'popup', minutes: 45 }]);
});

// --- Plan de sincronización -------------------------------------------------
const ev = (id, funcionId, extra = {}) => ({ id, description: funcionId ? `x\n[oe:${funcionId}]` : 'sin marca', ...extra });

test('función agendada sin evento: se crea', () => {
  const p = planCalendario([F()], []);
  assert.equal(p.crear.length, 1);
  assert.equal(p.crear[0].funcion_id, 'abc-123');
});

test('función con su evento guardado: se actualiza, y los repetidos se borran', () => {
  const p = planCalendario([F({ calendar_event_id: 'e1' })], [ev('e1', 'abc-123'), ev('e2', 'abc-123')]);
  assert.deepEqual(p.actualizar.map(a => a.eventId), ['e1']);
  assert.deepEqual(p.borrar.map(b => b.eventId), ['e2']);
});

test('evento con marca pero sin id guardado: se adopta en vez de crear otro', () => {
  const p = planCalendario([F()], [ev('e9', 'abc-123')]);
  assert.equal(p.crear.length, 0);
  assert.deepEqual(p.actualizar.map(a => [a.eventId, a.adoptar]), [['e9', true]]);
});

test('evento con marca de una función que ya no está agendada: se borra', () => {
  const p = planCalendario([F({ agendada: false, calendar_event_id: 'e1' })], [ev('e1', 'abc-123')]);
  assert.deepEqual(p.borrar.map(b => b.eventId), ['e1']);
});

test('regla dura: un evento sin marca nunca entra en el plan', () => {
  const p = planCalendario([F()], [ev('ajeno', null), ev('otro', null, { summary: 'Cumpleaños' })]);
  assert.equal(p.borrar.length, 0);
  assert.equal(p.actualizar.length, 0);
  assert.equal(p.crear.length, 1);
});

test('el id guardado no se usa si el evento ya no existe: se crea de nuevo', () => {
  const p = planCalendario([F({ calendar_event_id: 'borrado-a-mano' })], []);
  assert.equal(p.crear.length, 1);
});

test('un evento con marca de una función de otro festival no se toca', () => {
  // El plan se calcula festival por festival: lo que no es de este festival no
  // es asunto suyo, aunque tenga la marca.
  const p = planCalendario([F()], [ev('e1', 'abc-123'), ev('e-otro', 'de-otro-festival')]);
  assert.equal(p.borrar.length, 0);
});

// --- Tras ver el plan con los datos de San Ignacio (3 nov 2026) -------------
test('lo que ya pasó no se crea: un evento de anteayer en el calendario es ruido', () => {
  const p = planCalendario([F({ fecha: '2026-11-01' }), F({ id: 'futura', fecha: '2026-11-05' })], [], '2026-11-03');
  assert.deepEqual(p.crear.map(c => c.funcion_id), ['futura']);
});

test('lo que ya pasó y ya tiene evento se deja como está', () => {
  const p = planCalendario([F({ fecha: '2026-11-01', calendar_event_id: 'e1' })], [ev('e1', 'abc-123')], '2026-11-03');
  assert.equal(p.actualizar.length, 0);
  assert.equal(p.borrar.length, 0);
});

test('el lugar no repite el nombre de la sala ni lleva el teléfono', () => {
  assert.equal(eventoDeseado(F({ sala: { nombre: 'Plazuela San Ignacio', direccion: 'Plazuela San Ignacio, al aire libre' } })).location,
    'Plazuela San Ignacio, al aire libre');
  assert.equal(eventoDeseado(F({ sala: { nombre: 'Teatro Popular de Medellín (TPM)', direccion: 'Clle. 48 #41-13 · 604 5574964' } })).location,
    'Teatro Popular de Medellín (TPM), Clle. 48 #41-13');
});

test('entrada libre sin boleta no dice «falta»', () => {
  assert.match(descripcionEvento(F({ precio_pleno: 0, estado: 'agendada', boletas: [] })), /Entrada libre/);
  assert.doesNotMatch(descripcionEvento(F({ precio_pleno: 0, estado: 'agendada', boletas: [] })), /falta/);
});
