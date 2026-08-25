import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slug, claveBoleta, tituloNormalizado, mismoTitulo, horaCorta, extension } from './nombres.mjs';

test('el slug aplana tildes y eñes para que la sala no se duplique', () => {
  assert.equal(slug('Teatro Matacándelas'), 'teatro-matacandelas');
  assert.equal(slug('Corporación Nuestra Gente'), 'corporacion-nuestra-gente');
  assert.equal(slug('Teatro Carantoña'), 'teatro-carantona');
});

test('IXAQUENE e Ixaquene son la misma obra', () => {
  // Caso real: la semilla la escribió en mayúsculas y el volante en minúsculas.
  // Sin normalizar quedaban como dos obras y el motor decía que se perdía algo
  // que sí se podía ver el otro día.
  assert.ok(mismoTitulo('IXAQUENE', 'Ixaquene'));
  assert.ok(mismoTitulo('KRAPP, la última cinta', 'KRAPP, LA ÚLTIMA CINTA'));
});

test('el título suelta la compañía pegada al final', () => {
  assert.equal(tituloNormalizado('Perversa (Teatro Escena 3)'), 'perversa');
  assert.ok(mismoTitulo('Perversa', 'Perversa (Teatro Escena 3)'));
});

test('dos boletas distintas de la misma función no colisionan', () => {
  const f = { fecha: '2026-08-27', hora_min: 1200, obra: 'Primer Amor', salaSlug: 'mata' };
  const a = claveBoleta('fiesta-22', f, 'aaaaaaaabbbb', 'application/pdf', 'x.pdf');
  const b = claveBoleta('fiesta-22', f, 'ccccccccdddd', 'application/pdf', 'y.pdf');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('baul/fiesta-22/2026-08-27_2000_primer-amor_mata_'));
});

test('la doble función del mismo día no colisiona consigo misma', () => {
  const base = { fecha: '2026-08-27', obra: 'La vida es un cilindro', salaSlug: 'ocs' };
  const tarde = claveBoleta('f', { ...base, hora_min: 1020 }, 'abcdefgh1', 'application/pdf', 'a.pdf');
  const noche = claveBoleta('f', { ...base, hora_min: 1200 }, 'abcdefgh2', 'application/pdf', 'b.pdf');
  assert.ok(tarde.includes('_1700_'));
  assert.ok(noche.includes('_2000_'));
  assert.notEqual(tarde, noche);
});

test('la hora corta va en 24 horas para que ordene bien', () => {
  assert.equal(horaCorta(1020), '1700');
  assert.equal(horaCorta(630), '1030');
  assert.equal(horaCorta(1320), '2200');
});

test('la extensión sale del mime y cae al nombre si hace falta', () => {
  assert.equal(extension('application/pdf'), 'pdf');
  assert.equal(extension('image/jpeg'), 'jpg');
  assert.equal(extension('desconocido', 'foto.HEIC'), 'heic');
});
