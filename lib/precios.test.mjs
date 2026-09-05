import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioDe, costoPendiente, textoPrecio } from './precios.mjs';

const F = x => ({ necesarias: 1, boletas: [], pagado: 0, precio_pleno: null, precio_dcto: null, ...x });

test('gratis y "no lo sé" no se dicen igual', () => {
  assert.equal(textoPrecio(F({ precio_pleno: 0 })).etiqueta, 'Entrada libre');
  assert.equal(textoPrecio(F({ precio_pleno: null })).etiqueta, 'Precio sin publicar');
});

test('lo pagado manda sobre la tarifa', () => {
  const t = textoPrecio(F({ pagado: 45000, precio_pleno: 60000 }));
  assert.equal(t.etiqueta, 'Pagado');
  assert.equal(t.valor, '$45.000');
});

test('el descuento se muestra además de la plena, no en vez de ella', () => {
  const t = textoPrecio(F({ precio_pleno: 60000, precio_dcto: 40000 }));
  assert.equal(t.valor, '$60.000');
  assert.equal(t.descuento, '$40.000');
});

test('para pagar cuenta el descuento cuando lo hay', () => {
  assert.equal(precioDe(F({ precio_pleno: 60000, precio_dcto: 40000 })), 40000);
  assert.equal(precioDe(F({ precio_pleno: 60000 })), 60000);
  assert.equal(precioDe(F({})), null);
});

test('una función sin tarifa publicada no suma cero al total: se cuenta aparte', () => {
  // Sumar cero daria un total con pinta de completo que ignora media agenda.
  const c = costoPendiente([
    F({ precio_pleno: 30000 }),
    F({ precio_pleno: null }),
    F({ precio_pleno: null }),
  ]);
  assert.deepEqual(c, { total: 30000, sinPrecio: 2, conPrecio: 1 });
});

test('la entrada libre sí suma cero, porque cero es su precio', () => {
  const c = costoPendiente([F({ precio_pleno: 0 }), F({ precio_pleno: 20000 })]);
  assert.deepEqual(c, { total: 20000, sinPrecio: 0, conPrecio: 2 });
});

test('lo que ya tiene sus boletas no cuenta como pendiente', () => {
  const c = costoPendiente([F({ precio_pleno: 30000, necesarias: 2, boletas: [{}, {}] })]);
  assert.deepEqual(c, { total: 0, sinPrecio: 0, conPrecio: 0 });
});

test('con dos acompañantes el pendiente se multiplica por lo que falta', () => {
  const c = costoPendiente([F({ precio_pleno: 30000, necesarias: 3, boletas: [{}] })]);
  assert.equal(c.total, 60000);
});
