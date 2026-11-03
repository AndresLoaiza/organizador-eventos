import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separar, recomponer } from './legado.mjs';

const ida = (tipo, fila) => recomponer(separar(tipo, fila));

test('artes: no se separa nada, aunque la compañía traiga " · "', () => {
  const fila = { compania: 'Evento especial · INCOLBALLET (Cali)', nota_boleteria: 'Entrada libre con Eticketa Blanca.' };
  const s = separar('artes', fila);
  assert.equal(s.compania, 'Evento especial · INCOLBALLET (Cali)');
  assert.equal(s.descripcion, null);
  assert.deepEqual(s.franjas, []);
  assert.equal(s.publico, null);
  assert.deepEqual(ida('artes', fila), fila);
});

test('artes: nulos se quedan nulos', () => {
  const fila = { compania: null, nota_boleteria: null };
  assert.deepEqual(ida('artes', fila), fila);
});

test('san ignacio: compañía y descripción se parten en el primer " · "', () => {
  const fila = {
    compania: 'Comfama (Colombia) · Inspirada en el clásico de Lyman Frank Baum, esta es una historia.',
    nota_boleteria: '+ 5 años · Boletería por confirmar (tarifas Comfama)',
  };
  const s = separar('san-ignacio', fila);
  assert.equal(s.compania, 'Comfama (Colombia)');
  assert.equal(s.descripcion, 'Inspirada en el clásico de Lyman Frank Baum, esta es una historia.');
  assert.equal(s.publico, '+ 5 años');
  assert.equal(s.nota, 'Boletería por confirmar (tarifas Comfama)');
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('san ignacio: la académica no trae público ni descripción', () => {
  const fila = { compania: 'Dirigido a actores y directores', nota_boleteria: 'Entrada libre con inscripción previa' };
  const s = separar('san-ignacio', fila);
  assert.equal(s.publico, null);
  assert.equal(s.descripcion, null);
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('san ignacio: "Familiar" también es público', () => {
  const fila = { compania: 'X (Chile)', nota_boleteria: 'Familiar · Entrada libre' };
  assert.equal(separar('san-ignacio', fila).publico, 'Familiar');
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('libro: compania es la descripción y la nota trae franjas antes de los sufijos', () => {
  const fila = {
    compania: 'Cómo la ficción contemporánea narra el desplazamiento.',
    nota_boleteria: 'El Quijote · Universidad de Antioquia · Con intérprete de Lengua de Señas Colombiana · Entrada libre',
  };
  const s = separar('libro', fila);
  assert.equal(s.compania, null);
  assert.equal(s.descripcion, 'Cómo la ficción contemporánea narra el desplazamiento.');
  assert.deepEqual(s.franjas, ['El Quijote', 'Universidad de Antioquia']);
  assert.equal(s.nota, 'Con intérprete de Lengua de Señas Colombiana · Entrada libre');
  assert.deepEqual(ida('libro', fila), fila);
});

test('libro: una franja con coma adentro es una sola franja', () => {
  const fila = { compania: null, nota_boleteria: 'El Quijote,Universidad de Antioquia · Entrada libre' };
  assert.deepEqual(separar('libro', fila).franjas, ['El Quijote,Universidad de Antioquia']);
  assert.deepEqual(ida('libro', fila), fila);
});

test('texto vacío es lo mismo que null: 15 lanzamientos de la Fiesta del Libro traen compania ""', () => {
  const fila = { compania: '', nota_boleteria: 'Lanzamientos de libros · Entrada libre' };
  const s = separar('libro', fila);
  assert.equal(s.descripcion, null);
  assert.equal(recomponer(s).compania, null);
  assert.equal(separar('artes', { compania: '', nota_boleteria: '' }).nota, null);
});

test('recomponer recorta compania a 900 como el cargador viejo', () => {
  const r = recomponer({ compania: 'A', descripcion: 'x'.repeat(1000), franjas: [], publico: null, nota: null });
  assert.equal(r.compania.length, 900);
});

test('tipo desconocido es un error, no un silencio', () => {
  assert.throws(() => separar('otro', { compania: null, nota_boleteria: null }), /tipo de legado/);
});
