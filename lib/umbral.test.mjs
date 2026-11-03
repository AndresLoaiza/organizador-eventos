import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearDecisor, crearTraslado, rel, textoUmbral } from './decisor.mjs';

// Desde qué duración se rompe un veredicto. Las duraciones del volante casi
// nunca están: el motor decide con 80 minutos inventados. Cuando el veredicto
// depende de ese número, decir el umbral convierte «depende de una estimación»
// en algo que se puede confirmar con una llamada a la sala.

const VENUES = {
  mata: { n: 'Teatro Matacandelas', z: 'centro' },
  ocs: { n: 'Teatro Oficina Central de los Sueños', z: 'centro' },
};
const travel = crearTraslado(VENUES, { centro: { centro: 12 } });
const S = x => ({ day: '2026-08-27', dur: 80, durEstimada: true, v: 'mata', ...x });

// KRAPP a las 8:00 en la Oficina Central; cruzar a Matacandelas son 12 min.
const krapp = S({ id: 'krapp', title: 'KRAPP', t: 1200, v: 'ocs' });
const justo = S({ id: 'amor', title: 'Primer Amor', t: 1300 });    // 9:40: 20 min de margen
const choca = S({ id: 'amor', title: 'Primer Amor', t: 1285 });    // 9:25: 5 min de margen

test('par justo con duración estimada: dice hasta cuánto puede durar la primera', () => {
  const r = rel(krapp, justo, travel);
  assert.equal(r.kind, 'tight');
  assert.equal(textoUmbral(r), 'cabe mientras «KRAPP» dure hasta 88 min (estimado: 80)');
});

test('choque que depende de la estimación: dice desde cuánto cabría', () => {
  const r = rel(krapp, choca, travel);
  assert.equal(r.kind, 'conflict');
  assert.equal(textoUmbral(r), 'cabría si «KRAPP» dura hasta 73 min (estimado: 80; nadie lo ha confirmado)');
});

test('con la duración confirmada no hay umbral que decir', () => {
  assert.equal(textoUmbral(rel({ ...krapp, durEstimada: false }, justo, travel)), null);
});

test('si se pisan aunque la primera durara un minuto, no hay umbral', () => {
  assert.equal(textoUmbral(rel(krapp, S({ id: 'x', title: 'X', t: 1205 }), travel)), null);
});

test('el umbral es de la que empieza primero, sin importar el orden de los argumentos', () => {
  assert.equal(textoUmbral(rel(justo, krapp, travel)), textoUmbral(rel(krapp, justo, travel)));
});

const nombreSala = v => VENUES[v]?.n ?? null;

test('los renglones del veredicto llevan el umbral: choques, pierdes y justos', () => {
  const conChoque = crearDecisor([krapp, choca], travel, {}, nombreSala);
  // Elegida KRAPP, Primer Amor queda bloqueada.
  assert.match(conChoque.verdictFor(choca, new Set(['krapp'])).choques[0].umbral, /hasta 73 min/);
  // Sin nada elegido, elegir KRAPP haría perder Primer Amor.
  assert.match(conChoque.verdictFor(krapp, new Set()).pierde[0].umbral, /hasta 73 min/);

  const conJusto = crearDecisor([krapp, justo], travel, {}, nombreSala);
  assert.match(conJusto.verdictFor(justo, new Set(['krapp'])).justos[0].umbral, /hasta 88 min/);
});
