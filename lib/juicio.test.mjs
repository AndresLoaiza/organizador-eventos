import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pintarEstrellas, estrellasDeToque, numeroEstrellas, filaJuicio, porJuzgar, cuandoFue,
  VENTANA_DIAS,
} from './juicio.mjs';

test('estrellas con media: ★★½', () => {
  assert.equal(pintarEstrellas(4), '★★★★');
  assert.equal(pintarEstrellas(2.5), '★★½');
  assert.equal(pintarEstrellas(0.5), '½');
  assert.equal(pintarEstrellas(null), '');
  assert.equal(pintarEstrellas(0), '');
});

test('pg manda numeric como texto, PostgREST como número: los dos se pintan igual', () => {
  assert.equal(pintarEstrellas('4.0'), '★★★★');
  assert.equal(pintarEstrellas('2.5'), '★★½');
});

test('tocar la mitad izquierda de una estrella es media menos', () => {
  assert.equal(estrellasDeToque(3, true), 2.5);
  assert.equal(estrellasDeToque(1, true), 0.5);
  assert.equal(estrellasDeToque(3, false), 3);
});

test('el número se dice con coma, como en Colombia', () => {
  assert.equal(numeroEstrellas(2.5), '2,5');
  assert.equal(numeroEstrellas(4), '4');
});

test('la fila: texto vacío es null, y «no fui» no lleva estrellas', () => {
  assert.deepEqual(filaJuicio({ funcion_id: 'f', texto: '   ', estrellas: 3.5 }),
    { funcion_id: 'f', texto: null, estrellas: 3.5, asistio: true, sincronizado_obsidian: null });
  assert.deepEqual(filaJuicio({ funcion_id: 'f', estrellas: 4, asistio: false }),
    { funcion_id: 'f', texto: null, estrellas: null, asistio: false, sincronizado_obsidian: null });
  assert.equal(filaJuicio({ funcion_id: 'f', texto: ' Bonita ', estrellas: 0 }).estrellas, null);
  assert.equal(filaJuicio({ funcion_id: 'f', texto: ' Bonita ' }).texto, 'Bonita');
});

const HOY = '2026-11-02';
const F = x => ({ id: x.obra, agendada: true, juicio: null, fecha: '2026-11-01', hora_min: 1200, duracion_min: 80, ...x });

test('se pregunta por lo agendado que ya terminó, sin juicio, de los últimos días', () => {
  const fs = [
    F({ obra: 'Anoche' }),
    F({ obra: 'Ya juzgada', juicio: { estrellas: 4 } }),
    F({ obra: 'No agendada', agendada: false }),
    F({ obra: 'Hace mucho', fecha: '2026-10-28' }),
    F({ obra: 'Esta noche, aún no', fecha: HOY, hora_min: 1200 }),
    F({ obra: 'Hoy temprano', fecha: HOY, hora_min: 600 }),
  ];
  // A las 3 p. m.: la de las 10 a. m. ya terminó, la de las 8 p. m. no.
  assert.deepEqual(porJuzgar(fs, HOY, 900).map(f => f.obra), ['Hoy temprano', 'Anoche']);
});

test(`la ventana es de ${VENTANA_DIAS} días: el día ${VENTANA_DIAS} entra, el siguiente no`, () => {
  const fs = [F({ obra: 'Borde', fecha: '2026-10-30' }), F({ obra: 'Fuera', fecha: '2026-10-29' })];
  assert.deepEqual(porJuzgar(fs, HOY, 900).map(f => f.obra), ['Borde']);
});

test('cuándo fue, dicho como se dice', () => {
  const nombreDia = () => 'viernes';
  assert.equal(cuandoFue(HOY, HOY, nombreDia), 'Hoy');
  assert.equal(cuandoFue('2026-11-01', HOY, nombreDia), 'Anoche');
  assert.equal(cuandoFue('2026-10-30', HOY, nombreDia), 'El viernes');
});
