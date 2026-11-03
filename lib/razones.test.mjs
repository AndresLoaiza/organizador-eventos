import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarRazones, canonicas, MAX_TEXTO } from './razones.mjs';

const obras = ['Petra, versión libre', 'Ixaquene'];
const ok = { obra: 'Petra, versión libre', texto: 'Teatro gestual con hilo narrativo: tu punto medio.' };

test('una lista bien formada no tiene errores', () => {
  assert.deepEqual(validarRazones([ok], obras), []);
});

test('la obra se reconoce sin importar mayúsculas ni tildes, y se devuelve con el nombre de la base', () => {
  const lista = [{ obra: 'IXAQUENE', texto: 'Acrobacia aérea.' }];
  assert.deepEqual(validarRazones(lista, obras), []);
  assert.deepEqual(canonicas(lista, obras), [{ obra: 'Ixaquene', texto: 'Acrobacia aérea.' }]);
});

test('obra que no está en el festival', () => {
  assert.match(validarRazones([{ obra: 'Hamlet', texto: 'x' }], obras).join(), /Hamlet.*no está/);
});

test('obra repetida, texto vacío o demasiado largo', () => {
  assert.match(validarRazones([ok, ok], obras).join(), /repetida/);
  assert.match(validarRazones([{ ...ok, texto: '  ' }], obras).join(), /vacío/);
  assert.match(validarRazones([{ ...ok, texto: 'x'.repeat(MAX_TEXTO + 1) }], obras).join(), /máximo/);
});

test('algo que no es una lista', () => {
  assert.match(validarRazones({}, obras).join(), /lista/);
});
