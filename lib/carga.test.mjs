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
  assert.deepEqual(p, { insertar: [], actualizar: [], retirar: [], avisar: [], dudosas: [] });
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

// --- Hallazgos de la revisión del 2 nov 2026 --------------------------------
// Filas con la forma que devuelve pg, no construidas con aFila: si no, el test
// compara aFila contra sí misma y no prueba nada.
const filaPg = (extra = {}) => ({
  id: 'f1', sala_slug: 'sala-a', sala_id: 'uuid-a', fecha: '2026-11-01', hora_min: 1200,
  duracion_min: 80, duracion_confirmada: false, obra: 'Petra',
  compania: 'Ambidiestro · Gesto y danza', descripcion: null, franjas: null, publico: null,
  precio_pleno: 35000, precio_dcto: 10900, nota_boleteria: '+14 años · Descuentos Comfama',
  fuente_horario: 'volante', imagen_key: null, imagen_credito: null, tipos: ['Danza-teatro'],
  url_compra: null, ...extra,
});

test('fila recién migrada: solo cambian las columnas nuevas', () => {
  const p = planificar(json([fn()]), [filaPg()], salaId);
  assert.deepEqual(Object.keys(p.actualizar[0].cambios).sort(), ['descripcion', 'publico']);
});

test('"" en la base y null en el JSON no son un cambio', () => {
  const sinDesc = fn({ descripcion: null, compania: null, publico: null, nota: 'Entrada libre' });
  const p = planificar(json([sinDesc]), [filaPg({ compania: '', nota_boleteria: 'Entrada libre', tipos: ['Danza-teatro'] })], salaId);
  assert.equal(p.actualizar.length, 0);
});

test('tipos [] es lo mismo que null', () => {
  const r = aFila(fn({ tipos: [] }), salaId);
  assert.equal(r.tipos, null);
});

test('fecha como Date en vez de texto es un error, no un borrado masivo', () => {
  assert.throws(() => planificar(json([fn()]), [filaPg({ fecha: new Date('2026-11-01') })], salaId), /fecha/);
});

test('hora_min que no es entero es un error', () => {
  assert.throws(() => planificar(json([fn()]), [filaPg({ hora_min: '1200' })], salaId), /hora_min/);
});

test('sala sin id es un error, no una función sin sala', () => {
  assert.throws(() => aFila(fn({ sala: 'sala-z' }), salaId), /sala-z/);
});

test('borrar más de la décima parte exige permiso explícito', () => {
  const muchas = Array.from({ length: 10 }, (_, i) => filaPg({ id: 'x' + i, hora_min: 600 + i }));
  assert.throws(() => planificar(json([fn()]), [filaPg(), ...muchas], salaId), /borraría/);
  const p = planificar(json([fn()]), [filaPg(), ...muchas], salaId, new Set(), { permitirBorrado: true });
  assert.equal(p.retirar.length, 10);
});

test('función con datos tuyos que cambió de hora: se marca dudosa, no se duplica', () => {
  const p = planificar(json([fn({ hora: '20:30' })]), [filaPg({ id: 'mia' })], salaId, new Set(['mia']));
  assert.equal(p.insertar.length, 0);
  assert.equal(p.avisar.length, 0);
  assert.equal(p.dudosas.length, 1);
  assert.equal(p.dudosas[0].previa.id, 'mia');
  assert.equal(p.dudosas[0].nueva.hora_min, 1230);
});
