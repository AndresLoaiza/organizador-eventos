import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escogerFestival } from './cliente.mjs';

// Abrir la app en mitad de un festival y que muestre otro sería absurdo, así que
// el que está corriendo hoy manda sobre el más reciente.

const ESCENICAS = { slug: 'escenicas', fecha_inicio: '2026-08-20', fecha_fin: '2026-08-30' };
const LIBRO     = { slug: 'libro',     fecha_inicio: '2026-09-11', fecha_fin: '2026-09-20' };
const VIEJO     = { slug: 'viejo',     fecha_inicio: '2025-08-20', fecha_fin: '2025-08-30' };
const TODOS = [LIBRO, ESCENICAS, VIEJO];

test('durante un festival manda ese, no el que empieza después', () => {
  assert.equal(escogerFestival(TODOS, '2026-08-28').slug, 'escenicas');
});

test('entre festivales manda el próximo que empieza', () => {
  assert.equal(escogerFestival(TODOS, '2026-09-02').slug, 'libro');
});

test('si ya pasaron todos, el más reciente', () => {
  assert.equal(escogerFestival(TODOS, '2026-12-01').slug, 'libro');
});

test('la elección explícita gana sobre todo lo demás', () => {
  assert.equal(escogerFestival(TODOS, '2026-08-28', 'libro').slug, 'libro');
});

test('una elección que ya no existe no rompe nada', () => {
  assert.equal(escogerFestival(TODOS, '2026-08-28', 'borrado').slug, 'escenicas');
});

test('sin festivales devuelve null', () => {
  assert.equal(escogerFestival([], '2026-08-28'), null);
});
