import { test } from 'node:test';
import assert from 'node:assert/strict';
import { razonesDe, avisoCuerpo, ordenarParaOjear, contarOjeo, paraDecidir, REGLAS } from './interes.mjs';

const F = x => ({ obra: '', compania: '', hora_min: 600, duracion_min: 60, ...x });

test('cada regla dice de dónde sale: sin fuente no se puede corregir', () => {
  for (const r of REGLAS) {
    assert.ok(r.fuente && r.fuente.length > 10, `${r.id} sin fuente`);
    assert.ok(r.claves.length, `${r.id} sin claves`);
  }
});

test('encuentra al historiador aunque su nombre esté enterrado en la descripción', () => {
  const f = F({
    obra: 'Biblioteca Pública Piloto: una historia excepcional',
    compania: 'Gloria Palomino y Roberto Luis Jaramillo (historiador y abogado) conversan…',
  });
  assert.deepEqual(razonesDe(f).map(r => r.id), ['pedido']);
});

test('las tildes y las mayúsculas no la esconden', () => {
  assert.deepEqual(razonesDe(F({ obra: 'Leer a José SARAMAGO' })).map(r => r.id), ['pedido']);
  assert.deepEqual(razonesDe(F({ compania: 'sobre el realismo mágico' })).map(r => r.id), ['pedido']);
});

test('un nombre propio no pesca a cualquier homónimo', () => {
  assert.deepEqual(razonesDe(F({ compania: 'Con Ana Jaramillo, editora' })).map(r => r.id), []);
});

test('una función puede tener varias razones a la vez', () => {
  const f = F({ obra: 'Clausura: gala de clown', compania: '' });
  assert.deepEqual(razonesDe(f).map(r => r.id).sort(), ['escena', 'oficio']);
});

test('la franja no entra en la búsqueda: 317 lanzamientos no son 317 destacados', () => {
  // nota_boleteria lleva la franja y NO se lee. Si se leyera, cualquier regla
  // que rozara un nombre de franja resaltaría media Fiesta.
  const f = F({ obra: 'Un libro cualquiera', nota_boleteria: 'Lanzamientos de libros · Entrada libre' });
  assert.deepEqual(razonesDe(f), []);
});

test('lo que no coincide no se marca: no destacado no es malo', () => {
  assert.deepEqual(razonesDe(F({ obra: 'Charla sobre botánica' })), []);
});

test('una función larga se menciona por las rodillas, no se descarta', () => {
  assert.match(avisoCuerpo(F({ duracion_min: 150 })), /rodillas/);
  assert.equal(avisoCuerpo(F({ duracion_min: 120 })), null);
  // Sigue siendo destacable pese al aviso: es dato, no veto.
  assert.equal(razonesDe(F({ obra: 'Cabaret', duracion_min: 150 })).length, 1);
});

test('al ojear, lo que coincide con algo suyo va primero', () => {
  const tarde = F({ obra: 'Clown de cierre', hora_min: 1200 });
  const temprano = F({ obra: 'Charla de botánica', hora_min: 600 });
  assert.deepEqual(ordenarParaOjear([temprano, tarde]).map(f => f.obra),
    ['Clown de cierre', 'Charla de botánica']);
});

test('dentro del mismo peso manda la hora', () => {
  const a = F({ obra: 'Charla A', hora_min: 1200 });
  const b = F({ obra: 'Charla B', hora_min: 600 });
  assert.deepEqual(ordenarParaOjear([a, b]).map(f => f.obra), ['Charla B', 'Charla A']);
});

test('sin ojear no es lo mismo que descartado', () => {
  const c = contarOjeo([F({ interes: 'si' }), F({ interes: 'no' }), F({}), F({ interes: null })]);
  assert.deepEqual(c, { si: 1, no: 1, sinVer: 2 });
});

test('un festival sin ojear pasa entero al decisor', () => {
  // La 22.ª Fiesta se cargó antes de que existiera el ojeo. Filtrarla dejaría
  // el decisor en blanco, que no se lee como "falta ojear" sino como "no cargó".
  const fs = [F({ obra: 'A' }), F({ obra: 'B', agendada: true })];
  const r = paraDecidir(fs);
  assert.equal(r.filtrado, false);
  assert.equal(r.funciones.length, 2);
});

test('ojeado, al decisor solo pasa lo que interesa', () => {
  const fs = [F({ obra: 'Sí', interes: 'si' }), F({ obra: 'No', interes: 'no' }), F({ obra: 'Sin ver' })];
  const r = paraDecidir(fs);
  assert.equal(r.filtrado, true);
  assert.deepEqual(r.funciones.map(f => f.obra), ['Sí']);
});

test('lo agendado nunca se cae del decisor aunque no esté marcado', () => {
  // Si desapareciera, el motor creería libre una noche tomada y prometería
  // rescates que no existen.
  const fs = [F({ obra: 'Sí', interes: 'si' }), F({ obra: 'Ya comprada', agendada: true })];
  assert.deepEqual(paraDecidir(fs).funciones.map(f => f.obra), ['Sí', 'Ya comprada']);
});

test('ni siquiera si la descartó despues de comprarla', () => {
  const fs = [F({ obra: 'X', interes: 'si' }), F({ obra: 'Comprada', interes: 'no', agendada: true })];
  assert.deepEqual(paraDecidir(fs).funciones.map(f => f.obra), ['X', 'Comprada']);
});
