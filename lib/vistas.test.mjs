import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yaTermino } from './panorama.mjs';

// Regresión del bug que le atribuyó a Petra el juicio de KRAPP: filtrar por
// fecha daba por vista una función de esa misma noche que aún no empezaba.

const PETRA = { fecha: '2026-08-25', hora_min: 1200, duracion_min: 80 };  // 8:00 pm
const KRAPP = { fecha: '2026-08-24', hora_min: 1200, duracion_min: 80 };

test('una función de días anteriores ya terminó', () => {
  assert.equal(yaTermino(KRAPP, '2026-08-25', 15 * 60), true);
});

test('la función de esta misma noche todavía no', () => {
  assert.equal(yaTermino(PETRA, '2026-08-25', 15 * 60), false);   // 3:00 pm
  assert.equal(yaTermino(PETRA, '2026-08-25', 20 * 60), false);   // justo al empezar
  assert.equal(yaTermino(PETRA, '2026-08-25', 21 * 60), false);   // a mitad
});

test('termina cuando pasa su duración, no cuando empieza', () => {
  assert.equal(yaTermino(PETRA, '2026-08-25', 21 * 60 + 19), false);
  assert.equal(yaTermino(PETRA, '2026-08-25', 21 * 60 + 20), true);
});

test('una función futura nunca ha terminado', () => {
  assert.equal(yaTermino(PETRA, '2026-08-24', 23 * 60), false);
});

test('acepta la fecha como Date, que es lo que devuelve Postgres', () => {
  const conDate = { fecha: new Date(2026, 7, 24), hora_min: 1200, duracion_min: 80 };
  assert.equal(yaTermino(conDate, '2026-08-25', 10 * 60), true);
});
