import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlUber, destinoTexto, urlInstagram, cuentasInstagram } from './enlaces.mjs';

const tpm = { nombre: 'Teatro Popular de Medellín (TPM)', direccion: 'Clle. 48 #41-13 · 604 5574964', ciudad: 'Medellín', lat: 6.24454, lng: -75.562155 };

test('Uber lleva el destino en coordenadas y la recogida donde estés', () => {
  const u = new URL(urlUber(tpm));
  assert.equal(u.origin + u.pathname, 'https://m.uber.com/ul/');
  assert.equal(u.searchParams.get('pickup'), 'my_location');
  assert.equal(u.searchParams.get('dropoff[latitude]'), '6.24454');
  assert.equal(u.searchParams.get('dropoff[longitude]'), '-75.562155');
  assert.equal(u.searchParams.get('dropoff[nickname]'), tpm.nombre);
});

test('sin coordenadas no hay Uber', () => {
  assert.equal(urlUber({ nombre: 'Bodega' }), null);
  assert.equal(urlUber(null), null);
});

test('el texto para DiDi deja el teléfono y no repite el nombre', () => {
  assert.equal(destinoTexto(tpm), 'Teatro Popular de Medellín (TPM), Clle. 48 #41-13, Medellín');
  assert.equal(destinoTexto({ nombre: 'La Pascasia', direccion: 'La Pascasia, San Ignacio' }), 'La Pascasia, Medellín');
});

test('cada cuenta abre su perfil', () => {
  assert.deepEqual(cuentasInstagram({ instagram: 'julietadaga @davidpiccotto' }).map(c => c.url),
    ['https://www.instagram.com/julietadaga/', 'https://www.instagram.com/davidpiccotto/']);
  assert.deepEqual(cuentasInstagram({ instagram: null }), []);
});

test('sin cuenta, Instagram busca por el grupo; sin grupo, por la obra', () => {
  assert.match(urlInstagram({ obra: 'Panza', compania: 'Teatro Matacandelas' }), /site%3Ainstagram\.com%20Teatro%20Matacandelas$/);
  assert.match(urlInstagram({ obra: 'Panza' }), /site%3Ainstagram\.com%20Panza$/);
});
