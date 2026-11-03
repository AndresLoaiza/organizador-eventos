import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  companiaReal, rasgosDe, aprender, senalesDe, agruparPorObra, interesDeGrupo,
  MIN_CASOS,
} from './evidencia.mjs';

const F = x => ({ obra: 'O', compania: null, descripcion: null, franjas: [], tipos: null, sala: null, interes: null, ...x });

test('companiaReal: la Fiesta del Libro guarda la descripción en compania, no hay compañía', () => {
  assert.equal(companiaReal(F({ compania: 'Una charla sobre…', descripcion: 'Una charla sobre…' })), null);
});

test('companiaReal: San Ignacio trae "compañía · descripción"', () => {
  assert.equal(companiaReal(F({ compania: 'Comfama (Colombia) · Inspirada en el clásico.', descripcion: 'Inspirada en el clásico.' })),
    'Comfama (Colombia)');
});

test('companiaReal: sin descripción, compania es la compañía (Artes Escénicas)', () => {
  assert.equal(companiaReal(F({ compania: 'Evento especial · INCOLBALLET (Cali)' })), 'Evento especial · INCOLBALLET (Cali)');
  assert.equal(companiaReal(F({ compania: '' })), null);
});

test('rasgosDe: franjas, tipos, sala y compañía corta; una compañía larga no es rasgo', () => {
  const r = rasgosDe(F({ franjas: ['El Quijote'], tipos: ['Clown'], sala: { nombre: 'Matacandelas' }, compania: 'Casa Clown' }));
  assert.deepEqual(r.map(x => `${x.tipo}:${x.valor}`), ['franja:El Quijote', 'tipo:Clown', 'sala:Matacandelas', 'compañía:Casa Clown']);
  assert.equal(rasgosDe(F({ compania: 'x'.repeat(200) })).length, 0);
});

test('agrupar y estado de grupo: solo si/no cuando todas las fechas coinciden', () => {
  assert.equal(agruparPorObra([F({ obra: 'A' }), F({ obra: 'A' }), F({ obra: 'B' })]).length, 2);
  assert.equal(interesDeGrupo([F({ interes: 'si' }), F({ interes: 'si' })]), 'si');
  assert.equal(interesDeGrupo([F({ interes: 'si' }), F({ interes: null })]), null);
});

function festival({ franja, obras, sis }) {
  return Array.from({ length: obras }, (_, i) =>
    F({ obra: `${franja}-${i}`, franjas: [franja], interes: i < sis ? 'si' : 'no' }));
}

test('aprender cuenta obras, no funciones: una obra con tres fechas pesa una vez', () => {
  const fs = [
    F({ obra: 'A', franjas: ['Q'], interes: 'si' }), F({ obra: 'A', franjas: ['Q'], interes: 'si' }),
    F({ obra: 'A', franjas: ['Q'], interes: 'si' }), F({ obra: 'B', franjas: ['Q'], interes: 'no' }),
  ];
  const ev = aprender(fs);
  assert.equal(ev.n, 2);
  assert.equal(ev.base, 0.5);
  assert.deepEqual(ev.rasgos.get('franja\u0000Q'), { tipo: 'franja', valor: 'Q', n: 2, si: 1 });
});

test('aprender ignora las obras sin ojear o con fechas mezcladas', () => {
  const fs = [F({ obra: 'A', interes: 'si' }), F({ obra: 'A', interes: 'no' }), F({ obra: 'B' })];
  assert.equal(aprender(fs).n, 0);
});

test('aprender anota la evidencia de las reglas declaradas', () => {
  const fs = [F({ obra: 'Clown 1', interes: 'si' }), F({ obra: 'Clown 2', interes: 'no' }), F({ obra: 'Otra', interes: 'no' })];
  const ev = aprender(fs, f => (f.obra.startsWith('Clown') ? ['oficio'] : []));
  assert.deepEqual(ev.reglas.get('oficio'), { n: 2, si: 1 });
});

test('con menos de MIN_CASOS obras de un rasgo no se dice nada', () => {
  const ev = aprender([...festival({ franja: 'Q', obras: MIN_CASOS - 1, sis: MIN_CASOS - 1 }), ...festival({ franja: 'R', obras: 40, sis: 0 })]);
  assert.deepEqual(senalesDe(F({ franjas: ['Q'] }), ev), []);
});

test('señal positiva: tasa alta y bien por encima de la base', () => {
  const ev = aprender([...festival({ franja: 'Q', obras: 10, sis: 9 }), ...festival({ franja: 'R', obras: 90, sis: 10 })]);
  const s = senalesDe(F({ franjas: ['Q'] }), ev);
  assert.equal(s.length, 1);
  assert.equal(s[0].signo, '+');
  assert.deepEqual([s[0].si, s[0].n], [9, 10]);
});

test('una tasa algo por debajo de la base no es señal en ningún sentido', () => {
  // R: 10 de 90 (11%) contra una base de 19%: baja, pero no a la mitad.
  const ev = aprender([...festival({ franja: 'Q', obras: 10, sis: 9 }), ...festival({ franja: 'R', obras: 90, sis: 10 })]);
  assert.deepEqual(senalesDe(F({ franjas: ['R'] }), ev), []);
});

test('señal negativa cuando la tasa cae a la mitad de la base o menos', () => {
  const ev = aprender([...festival({ franja: 'Q', obras: 20, sis: 18 }), ...festival({ franja: 'R', obras: 80, sis: 2 })]);
  const s = senalesDe(F({ franjas: ['R'] }), ev);
  assert.equal(s[0].signo, '-');
});

test('sin evidencia no hay señales', () => {
  assert.deepEqual(senalesDe(F({ franjas: ['Q'] }), null), []);
});

test('un descarte en lote no se aprende como un «no»: la app no aprende de su propio filtro', () => {
  // 40 obras de la sala X barridas con «Descartar las N sin resaltar». Si
  // contaran, la sala X quedaría 0 de 40, bajaría al final y el siguiente
  // descarte en lote se llevaría lo que quede de ella.
  const lote = Array.from({ length: 40 }, (_, i) =>
    F({ obra: `X${i}`, sala: { nombre: 'Sala X' }, interes: 'no', interes_origen: 'lote' }));
  const manual = Array.from({ length: 10 }, (_, i) =>
    F({ obra: `M${i}`, interes: i < 5 ? 'si' : 'no', interes_origen: 'manual' }));
  const ev = aprender([...lote, ...manual]);
  assert.equal(ev.n, 10);
  assert.equal(ev.base, 0.5);
  assert.equal(ev.rasgos.has('sala\u0000Sala X'), false);
});

test('las marcas anteriores a interes_origen (null) siguen contando', () => {
  const ev = aprender([F({ obra: 'A', interes: 'si' }), F({ obra: 'B', interes: 'no' })]);
  assert.equal(ev.n, 2);
});
