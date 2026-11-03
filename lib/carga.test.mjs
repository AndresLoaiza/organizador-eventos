import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aFila, planificar, cambiosCatalogo } from './carga.mjs';

const salaId = { 'sala-a': 'uuid-a' };
const fn = (extra = {}) => ({
  obra: 'Petra', compania: 'Ambidiestro', descripcion: 'Gesto y danza', franjas: [], tipos: ['Danza-teatro'],
  publico: '+14 años', nota: 'Descuentos Comfama', fuente_horario: 'volante',
  fecha: '2026-11-01', hora: '20:00', sala: 'sala-a',
  duracion: { min: 80, confirmada: false },
  precio: { pleno: 35000, dcto: 10900, libre: false },
  url_compra: null, imagen: null, ...extra,
});
const json = funciones => ({ funciones });
// Una fila de la base tal como la devuelve la consulta de cargar.mjs.
const fila = (extra = {}) => ({ id: 'f1', sala_slug: 'sala-a', ...aFila(fn(), salaId), ...extra });

test('aFila recompone las columnas heredadas y llena las nuevas', () => {
  const r = aFila(fn(), salaId);
  assert.equal(r.compania, 'Ambidiestro · Gesto y danza');
  assert.equal(r.nota_boleteria, '+14 años · Descuentos Comfama');
  assert.equal(r.descripcion, 'Gesto y danza');
  assert.equal(r.publico, '+14 años');
  assert.equal(r.hora_min, 1200);
  assert.equal(r.sala_id, 'uuid-a');
});

test('aFila: libre es precio 0, franjas vacías son null', () => {
  const r = aFila(fn({ precio: { pleno: 0, dcto: null, libre: true } }), salaId);
  assert.equal(r.precio_pleno, 0);
  assert.equal(r.franjas, null);
});

test('sin cambios no hay nada que hacer', () => {
  const p = planificar(json([fn()]), [fila()], salaId);
  assert.deepEqual(p, { insertar: [], actualizar: [], retirar: [], avisar: [] });
});

test('un cambio de precio se reporta campo por campo', () => {
  const p = planificar(json([fn({ precio: { pleno: 40000, dcto: 10900, libre: false } })]), [fila()], salaId);
  assert.equal(p.actualizar.length, 1);
  assert.deepEqual(p.actualizar[0].cambios, { precio_pleno: { antes: 35000, despues: 40000 } });
});

test('la misma obra con otra mayúscula es la misma función', () => {
  const p = planificar(json([fn({ obra: 'PETRA' })]), [fila()], salaId);
  assert.equal(p.insertar.length, 0);
  assert.deepEqual(Object.keys(p.actualizar[0].cambios), ['obra']);
});

test('función nueva se inserta', () => {
  const p = planificar(json([fn(), fn({ hora: '22:00' })]), [fila()], salaId);
  assert.equal(p.insertar.length, 1);
  assert.equal(p.insertar[0].hora_min, 1320);
});

test('retirada sin datos del usuario se borra; con datos, se avisa', () => {
  const otra = fila({ id: 'f2', hora_min: 1320 });
  const usada = fila({ id: 'f3', hora_min: 900 });
  const p = planificar(json([fn()]), [fila(), otra, usada], salaId, new Set(['f3']));
  assert.deepEqual(p.retirar.map(r => r.id), ['f2']);
  assert.deepEqual(p.avisar.map(r => r.id), ['f3']);
});

test('dos filas de la base con la misma llave es un error', () => {
  assert.throws(() => planificar(json([fn()]), [fila(), fila({ id: 'f9', obra: 'PETRA' })], salaId), /misma llave/);
});

test('arreglos y nulos se comparan por valor', () => {
  const p = planificar(json([fn({ tipos: ['Danza-teatro'] })]), [fila({ tipos: ['Danza-teatro'] })], salaId);
  assert.equal(p.actualizar.length, 0);
});

test('cambiosCatalogo detecta sala y traslado distintos', () => {
  const j = {
    salas: [{ slug: 'sala-a', nombre: 'Sala A', direccion: 'Cra 1', telefono: null, zona: 'centro' }],
    traslados: [{ zona_a: 'centro', zona_b: 'centro', minutos: 12 }],
  };
  const c = cambiosCatalogo(j,
    [{ slug: 'sala-a', nombre: 'Sala A', direccion: 'Cra 2', telefono: null, zona: 'centro' }],
    [{ zona_a: 'centro', zona_b: 'centro', minutos: 10 }]);
  assert.deepEqual(c, ['sala sala-a: direccion "Cra 2" → "Cra 1"', 'traslado centro → centro: 10 → 12']);
});
