import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarCalendario } from './vistaCalendario.mjs';

const F = (id, fecha, hora_min, duracion_min, extra = {}) =>
  ({ id, fecha, hora_min, duracion_min, obra: id, agendada: true, ...extra });

test('días de hoy en adelante, en orden, solo con lo agendado', () => {
  const c = armarCalendario([
    F('pasada', '2026-11-02', 1200, 60), F('b', '2026-11-05', 960, 70), F('a', '2026-11-03', 1170, 90),
    F('no', '2026-11-04', 1200, 60, { agendada: false }),
  ], '2026-11-03');
  assert.deepEqual(c.dias, ['2026-11-03', '2026-11-05']);
  assert.deepEqual(c.bloques.map(b => b.id).sort(), ['a', 'b']);
});

test('el rango va de la hora en punto antes de la primera a la hora en punto después de la última', () => {
  const c = armarCalendario([F('a', '2026-11-03', 970, 45), F('b', '2026-11-03', 1170, 90)], '2026-11-03');
  assert.equal(c.inicio, 960);    // 4:10 pm -> 4:00 pm
  assert.equal(c.fin, 1260);      // termina 9:00 pm justo
});

test('lo que se pisa va en carriles lado a lado; lo que no, ocupa todo el ancho', () => {
  const c = armarCalendario([
    F('conversatorio', '2026-11-06', 1020, 60), F('panza', '2026-11-06', 1080, 83),
    F('ceguera', '2026-11-06', 1200, 140),
  ], '2026-11-03');
  const por = Object.fromEntries(c.bloques.map(b => [b.id, b]));
  // Conversatorio termina 6:00 y Panza empieza 6:00: no se pisan en el tiempo,
  // así que caben en el mismo carril. El choque por traslado lo dicen los avisos.
  assert.equal(por.conversatorio.carriles, 1);
  assert.equal(por.ceguera.carriles, 1);
});

test('dos funciones que se solapan comparten el ancho', () => {
  const c = armarCalendario([F('a', '2026-11-06', 1020, 90), F('b', '2026-11-06', 1080, 60), F('c', '2026-11-06', 1260, 60)], '2026-11-03');
  const por = Object.fromEntries(c.bloques.map(b => [b.id, b]));
  assert.deepEqual([por.a.carril, por.a.carriles], [0, 2]);
  assert.deepEqual([por.b.carril, por.b.carriles], [1, 2]);
  assert.deepEqual([por.c.carril, por.c.carriles], [0, 1]);
});

test('la posición sale en minutos desde el inicio del rango', () => {
  const c = armarCalendario([F('a', '2026-11-03', 960, 45), F('b', '2026-11-03', 1170, 90)], '2026-11-03');
  const b = c.bloques.find(x => x.id === 'b');
  assert.equal(b.desde, 210);
  assert.equal(b.dura, 90);
});

test('sin nada agendado por delante, no hay días', () => {
  assert.deepEqual(armarCalendario([F('a', '2026-11-01', 960, 60)], '2026-11-03').dias, []);
});
