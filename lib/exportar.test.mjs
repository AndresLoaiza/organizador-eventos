import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filasAgenda, filasProgramacion, aTSV, aHTML, COLS_AGENDA, COLS_PROGRAMACION,
} from './exportar.mjs';
import { crearTraslado, crearDecisor } from './decisor.mjs';

const F = (x) => ({
  duracion_min: 80, duracion_confirmada: true, agendada: true, necesarias: 1,
  boletas: [], pagado: 0, sala: { nombre: 'Casa Clown' }, sala_slug: 'clown', ...x,
});

const KRAPP = F({
  id: 'k', fecha: '2026-08-24', hora_min: 1200, obra: 'KRAPP, la última cinta',
  compania: 'Actores en Escena (Manizales)', estado: 'comprada',
  boletas: [{}], pagado: 45000,
  juicio: { estrellas: 2, texto: 'No me gustó.\nSe hizo larga | y fría' },
});
const PETRA = F({
  id: 'p', fecha: '2026-08-25', hora_min: 1200, obra: 'Petra',
  compania: 'AmbidiestroLab (Bogotá)', estado: 'agendada',
  necesarias: 2, boletas: [{}],
});

test('la agenda sale en orden cronológico, no en el de la base', () => {
  const filas = filasAgenda([PETRA, KRAPP]);
  assert.deepEqual(filas.map(f => f[3]), ['KRAPP, la última cinta', 'Petra']);
  assert.equal(filas.length, COLS_AGENDA.length && 2);
  assert.equal(filas[0].length, COLS_AGENDA.length);
});

test('lo que no está agendado no entra en la agenda', () => {
  assert.equal(filasAgenda([F({ id: 'x', fecha: '2026-08-24', hora_min: 900, obra: 'Otra', agendada: false })]).length, 0);
});

test('las boletas se dicen como cuántas de cuántas hacen falta', () => {
  const [krapp, petra] = filasAgenda([KRAPP, PETRA]);
  assert.equal(krapp[8], '1 de 1');
  assert.equal(petra[8], '1 de 2');   // va acompañado y falta una
});

test('el valor pagado va con separador de miles y en blanco si no hay', () => {
  const [krapp, petra] = filasAgenda([KRAPP, PETRA]);
  assert.equal(krapp[9], '45.000');
  assert.equal(petra[9], '');
});

test('una duración estimada se marca como tal', () => {
  const [f] = filasAgenda([F({ id: 'e', fecha: '2026-08-24', hora_min: 900, obra: 'X', duracion_confirmada: false })]);
  assert.equal(f[6], '80 est.');
});

test('el salto de línea del juicio no parte la fila al pegar', () => {
  const tsv = aTSV(COLS_AGENDA, filasAgenda([KRAPP]));
  const lineas = tsv.split('\n');
  assert.equal(lineas.length, 2, 'cabecera y una sola fila');
  assert.equal(lineas[1].split('\t').length, COLS_AGENDA.length);
  assert.match(lineas[1], /No me gustó. Se hizo larga \| y fría/);
});

test('el HTML escapa lo que rompería la tabla', () => {
  const html = aHTML(['A'], [['<b>Tom & Jerry</b>']]);
  assert.match(html, /&lt;b&gt;Tom &amp; Jerry&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test('la programación lleva el veredicto de cada opción, agendada o no', () => {
  const travel = crearTraslado({ clown: { n: 'Casa Clown', z: 'centro' } }, { centro: { centro: 10 } });
  const fs = [KRAPP, F({ id: 'c', fecha: '2026-08-24', hora_min: 1230, obra: 'Choca', agendada: false })];
  const decisor = crearDecisor(
    fs.map(f => ({ id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min, title: f.obra, v: f.sala_slug })),
    travel, { '2026-08-24': 'lunes' });

  const filas = filasProgramacion(fs, decisor, new Set(['k']));
  assert.equal(filas[0].length, COLS_PROGRAMACION.length);
  assert.equal(filas[0][7], 'sí');           // KRAPP está en la agenda
  assert.equal(filas[1][7], '');
  assert.match(filas[1][8], /KRAPP/);        // y por eso la otra choca con ella
});
