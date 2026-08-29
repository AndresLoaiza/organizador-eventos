import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearDecisor, crearTraslado, rel, fmtHora } from './decisor.mjs';

// Los fixtures son funciones reales de la 22.ª Fiesta de las Artes Escénicas,
// no datos inventados. Un test con "Obra 1" y "Sala A" no detecta que "KRAPP" y
// "KRAAP" son la misma obra mal escrita, ni que la fe de erratas del teatro
// cambia un veredicto.

const VENUES = {
  mata:  { n: 'Teatro Matacandelas', z: 'centro' },
  ocs:   { n: 'Teatro Oficina Central de los Sueños', z: 'centro' },
  clown: { n: 'Teatro Casa Clown', z: 'centro' },
  ptu:   { n: 'Teatro Pablo Tobón Uribe', z: 'centro' },
  pobla: { n: 'CasaTeatro El Poblado', z: 'sur' },
};

const MATRIZ = {
  centro: { centro: 12, norte: 25, occidente: 25, sur: 30, corregimiento: 50 },
  sur:    { centro: 30, norte: 40, occidente: 30, sur: 12, corregimiento: 45 },
};

const travel = crearTraslado(VENUES, MATRIZ);

const DIAS = {
  '2026-08-24': 'Lunes',
  '2026-08-25': 'Martes',
  '2026-08-26': 'Miércoles',
  '2026-08-27': 'Jueves',
  '2026-08-28': 'Viernes',
  '2026-08-29': 'Sábado',
};

const FIESTA = [
  { id: 'krapp',      day: '2026-08-24', t: 1200, dur: 80,  title: 'KRAPP, la última cinta', v: 'ocs',   p: 35000 },
  { id: 'petra25',    day: '2026-08-25', t: 1200, dur: 80,  title: 'Petra',                  v: 'mata',  p: 35000 },
  { id: 'petra26',    day: '2026-08-26', t: 1200, dur: 80,  title: 'Petra',                  v: 'mata',  p: 35000 },
  { id: 'molienda',   day: '2026-08-26', t: 1200, dur: 180, title: 'Molienda de Danza',      v: 'ptu',   p: 0 },
  { id: 'primeramor', day: '2026-08-27', t: 1200, dur: 80,  title: 'Primer Amor',            v: 'mata',  p: 45000 },
  // Fe de erratas de Matacandelas del 20 de agosto: 10:00 p.m., no 9:30.
  { id: 'cocina',     day: '2026-08-27', t: 1320, dur: 120, title: 'Teatro y Cocina',        v: 'mata',  p: 40000 },
  { id: 'habitar',    day: '2026-08-28', t: 1200, dur: 80,  title: 'Habitar',                v: 'pobla', p: 35000 },
  { id: 'ixaque28',   day: '2026-08-28', t: 1200, dur: 80,  title: 'IXAQUENE',               v: 'mata',  p: 35000 },
  { id: 'ixaque29',   day: '2026-08-29', t: 1200, dur: 80,  title: 'IXAQUENE',               v: 'mata',  p: 35000 },
  { id: 'clown29',    day: '2026-08-29', t: 1200, dur: 70,  title: 'Fiesta Clown',           v: 'clown', p: 30000 },
  { id: 'gatos29',    day: '2026-08-29', t: 990,  dur: 70,  title: 'GalactiGatos',           v: 'mata',  p: 30000 },
];

const d = crearDecisor(FIESTA, travel, DIAS);
const elegir = (...ids) => new Set(ids);

test('traslado: misma sala cuesta cero, zonas distintas cuestan la matriz', () => {
  assert.equal(travel('mata', 'mata'), 0);
  assert.equal(travel('mata', 'ocs'), 12);
  assert.equal(travel('mata', 'pobla'), 30);
});

test('jueves: con la hora corregida el encadenamiento es cómodo, no justo', () => {
  const r = rel(
    FIESTA.find(s => s.id === 'primeramor'),
    FIESTA.find(s => s.id === 'cocina'),
    travel,
  );
  assert.equal(r.kind, 'ok');
  assert.equal(r.gap, 40);   // Primer Amor termina 21:20, Teatro y Cocina abre 22:00
  assert.equal(r.need, 0);   // misma sala
});

test('jueves: con la hora vieja del volante el mismo par salía justo', () => {
  const cocinaVolante = { ...FIESTA.find(s => s.id === 'cocina'), t: 1290 }; // 9:30 p.m.
  const r = rel(FIESTA.find(s => s.id === 'primeramor'), cocinaVolante, travel);
  assert.equal(r.kind, 'tight');
  assert.equal(r.gap, 10);
});

test('jueves: teniendo Primer Amor, Teatro y Cocina sale compatible', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'cocina'), elegir('primeramor'));
  assert.equal(v.cls, 'v-free');
  assert.match(v.txt, /Compatible/);
});

test('miércoles: Molienda desplaza Petra, pero Petra vuelve el martes', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'petra26'), elegir('molienda'));
  assert.equal(v.cls, 'v-keep');
  assert.match(v.txt, /vuelve el martes/);
});

test('miércoles: si ya tiene Petra el martes, el aviso lo dice en vez de alarmar', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'petra26'), elegir('molienda', 'petra25'));
  assert.equal(v.cls, 'v-keep');
  assert.match(v.txt, /ya la tienes agendada el martes/);
});

test('el choque real del sábado: Fiesta Clown deja IXAQUENE perdida', () => {
  // Habitar el viernes ocupa la única otra fecha de IXAQUENE: El Poblado y
  // Matacandelas están a 30 minutos y las dos funciones son a las 8:00 p.m.
  const elegidas = elegir('habitar', 'clown29');
  const v = d.verdictFor(FIESTA.find(s => s.id === 'ixaque29'), elegidas);
  assert.equal(v.cls, 'v-lost');
  assert.match(v.txt, /Perdida/);
  // Se repite el viernes, pero ese día está tomado por Habitar. Decir "no se
  // repite" sería falso y le escondería la salida: mover Habitar al sábado.
  assert.match(v.txt, /su otra fecha, el viernes, la tienes ocupada con Habitar/);
});

test('una obra de una sola fecha sí dice que no se repite', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'krapp'), elegir('krapp'));
  assert.equal(v.cls, 'v-pick');
  const solo = d.verdictFor(FIESTA.find(s => s.id === 'gatos29'), elegir('ixaque29'));
  assert.equal(solo.cls, 'v-free');
});

test('sin Habitar el viernes, IXAQUENE del sábado sí es recuperable', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'ixaque29'), elegir('clown29'));
  assert.equal(v.cls, 'v-keep');
  assert.match(v.txt, /vuelve el viernes/);
});

test('elegir Fiesta Clown avisa por adelantado qué pierde', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'clown29'), elegir('habitar'));
  assert.equal(v.cls, 'v-lost');
  assert.match(v.txt, /pierdes IXAQUENE definitivamente/);
});

test('sábado: GalactiGatos a las 4:30 encadena con la función de las 8:00', () => {
  const v = d.verdictFor(FIESTA.find(s => s.id === 'gatos29'), elegir('clown29'));
  assert.equal(v.cls, 'v-free');
  assert.match(v.txt, /Compatible/);
});

test('un veredicto que depende de una duración inventada queda marcado', () => {
  const conEstimacion = FIESTA.map(s =>
    s.id === 'primeramor' ? { ...s, durEstimada: true } : s);
  const dd = crearDecisor(conEstimacion, travel, DIAS);
  const v = dd.verdictFor(conEstimacion.find(s => s.id === 'cocina'), elegir('primeramor'));
  assert.equal(v.estimado, true);

  const confirmadas = FIESTA.map(s => ({ ...s, durEstimada: false }));
  const dc = crearDecisor(confirmadas, travel, DIAS);
  assert.equal(dc.verdictFor(confirmadas.find(s => s.id === 'cocina'), elegir('primeramor')).estimado, false);
});

test('el mismo título en dos fechas se reconoce como una sola obra', () => {
  const rescates = d.rescueDays(FIESTA.find(s => s.id === 'petra25'), new Set());
  assert.equal(rescates.length, 1);
  assert.equal(rescates[0].day, '2026-08-26');
});

test('formato de hora en el registro que usa el festival', () => {
  assert.equal(fmtHora(1200), '8:00 pm');
  assert.equal(fmtHora(1320), '10:00 pm');
  assert.equal(fmtHora(990), '4:30 pm');
});

// --- Por qué chocan, no solo que chocan ---
// "Choca" sobre un 4:00-5:00 contra un 5:00-6:00 se lee como error del
// programa: las horas son distintas. Lo que no cabe es el traslado.

import { motivoChoque } from './decisor.mjs';

const R = (a, b, need) => rel(a, b, () => need);
const S = (t, dur, v) => ({ t, dur, v, title: 'x' });

test('un solapamiento se dice como solapamiento', () => {
  const m = motivoChoque(R(S(600, 120, 'a'), S(630, 60, 'b'), 8));
  assert.match(m, /se cruzan/);
  assert.match(m, /va hasta las 12:00 pm/);
});

test('pegadas sin solaparse: la cuenta es el traslado, y se dice', () => {
  // 4:00-5:00 contra 5:00-6:00. No se pisan. Cruzar son 8 minutos.
  const m = motivoChoque(R(S(960, 60, 'a'), S(1020, 60, 'b'), 8),
    v => ({ a: 'Cuentódromo', b: 'Salón La Piloto' }[v]));
  assert.doesNotMatch(m, /se cruzan/);
  assert.match(m, /termina a las 5:00 pm, justo cuando la otra empieza/);
  assert.match(m, /cruzar de Cuentódromo a Salón La Piloto son 8 min/);
});

test('con hueco insuficiente dice cuántos minutos faltan', () => {
  const m = motivoChoque(R(S(960, 60, 'a'), S(1035, 60, 'b'), 25));
  assert.match(m, /quedan 15 min/);
  assert.match(m, /faltan 10 min/);
});

test('mismo sitio: no inventa un traslado entre salas', () => {
  const m = motivoChoque(R(S(960, 60, 'a'), S(1020, 60, 'a'), 0), () => 'Cuentódromo');
  assert.doesNotMatch(m, / de Cuentódromo a /);
});
