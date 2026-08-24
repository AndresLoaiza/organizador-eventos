import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarAvisos, estadoDerivado, vincular } from './alarmas.mjs';
import { crearTraslado } from './decisor.mjs';

const VENUES = {
  mata: { z: 'centro' }, ocs: { z: 'centro' }, ptu: { z: 'centro' },
  clown: { z: 'centro' }, pobla: { z: 'sur' },
};
const MATRIZ = { centro: { centro: 12, sur: 30 }, sur: { centro: 30, sur: 12 } };
const travel = crearTraslado(VENUES, MATRIZ);

// Estado real de la 22.ª Fiesta al 24 de agosto de 2026.
const FUNCIONES = [
  { id: 'krapp',  fecha: '2026-08-24', hora_min: 1200, duracion_min: 80,  duracion_confirmada: false, obra: 'KRAPP, la última cinta', sala_slug: 'ocs',   agendada: true, acompanantes: 0, fuente_horario: 'volante' },
  { id: 'petra',  fecha: '2026-08-25', hora_min: 1200, duracion_min: 80,  duracion_confirmada: false, obra: 'Petra',                  sala_slug: 'mata',  agendada: true, acompanantes: 0, fuente_horario: 'volante' },
  { id: 'molien', fecha: '2026-08-26', hora_min: 1200, duracion_min: 180, duracion_confirmada: false, obra: 'Molienda de Danza',      sala_slug: 'ptu',   agendada: true, acompanantes: 1, fuente_horario: 'volante' },
  { id: 'amor',   fecha: '2026-08-27', hora_min: 1200, duracion_min: 80,  duracion_confirmada: false, obra: 'Primer Amor',            sala_slug: 'mata',  agendada: true, acompanantes: 1, fuente_horario: 'volante' },
  { id: 'cocina', fecha: '2026-08-27', hora_min: 1320, duracion_min: 120, duracion_confirmada: true,  obra: 'Teatro y Cocina',        sala_slug: 'mata',  agendada: true, acompanantes: 1, fuente_horario: 'fe-de-erratas' },
  { id: 'habit',  fecha: '2026-08-28', hora_min: 1200, duracion_min: 80,  duracion_confirmada: false, obra: 'Habitar',                sala_slug: 'pobla', agendada: true, acompanantes: 1, fuente_horario: 'volante' },
];

const BOLETAS = [
  { id: 'b1', funcion_id: 'krapp',  hora_boleta: 1200, valor_ticket: 10300 },
  { id: 'b2', funcion_id: 'petra',  hora_boleta: 1200, valor_ticket: 10900 },
  { id: 'b3', funcion_id: 'molien', hora_boleta: 1200, valor_ticket: 0 },
  { id: 'b4', funcion_id: 'molien', hora_boleta: 1200, valor_ticket: 0 },
  { id: 'b5', funcion_id: 'amor',   hora_boleta: 1200, valor_ticket: 11900 },
  { id: 'b6', funcion_id: 'amor',   hora_boleta: 1200, valor_ticket: 45000 },
  { id: 'b7', funcion_id: 'habit',  hora_boleta: 1200, valor_ticket: 10900 },
];

const correr = (extra = {}) => detectarAvisos({
  funciones: FUNCIONES, boletas: BOLETAS, hoy: '2026-08-24', travel, ...extra,
});

test('dos boletas de la misma función no son un cruce: va acompañado', () => {
  const cruces = correr().filter(a => a.tipo === 'cruce_franja');
  assert.equal(cruces.length, 0);
});

test('Habitar tiene acompañante y una sola boleta: lo dice', () => {
  const a = correr().filter(x => x.tipo === 'boletas_insuficientes');
  assert.equal(a.length, 1);
  assert.equal(a[0].funcion_id, 'habit');
  assert.match(a[0].mensaje, /necesitas 2 boletas y solo hay 1/);
});

test('Molienda con sus dos cortesías no aparece como incompleta', () => {
  const a = correr().filter(x => x.tipo === 'boletas_insuficientes' && x.funcion_id === 'molien');
  assert.equal(a.length, 0);
});

test('Teatro y Cocina sin boleta y con acompañante: falta todo', () => {
  const conCocina = [...FUNCIONES];
  const avisos = detectarAvisos({
    funciones: conCocina, boletas: BOLETAS, hoy: '2026-08-27', travel,
  });
  const vencida = avisos.filter(x => x.tipo === 'agendada_vencida' && x.funcion_id === 'cocina');
  assert.equal(vencida.length, 1);
  assert.equal(vencida[0].severidad, 'alto');
  assert.match(vencida[0].mensaje, /es HOY a las 10:00 pm/);
});

test('la hora de la boleta que no coincide con la programación se marca alto', () => {
  const boletaVieja = [...BOLETAS, { id: 'b8', funcion_id: 'cocina', hora_boleta: 1290 }];
  const a = detectarAvisos({ funciones: FUNCIONES, boletas: boletaVieja, hoy: '2026-08-24', travel })
    .filter(x => x.tipo === 'hora_discordante');
  assert.equal(a.length, 1);
  assert.equal(a[0].severidad, 'alto');
  assert.match(a[0].mensaje, /boleta dice 9:30 pm/);
  assert.match(a[0].mensaje, /programación 10:00 pm/);
  assert.match(a[0].mensaje, /fe-de-erratas/);
});

test('una boleta sin función pregunta en vez de inventar', () => {
  const huerfana = [...BOLETAS, { id: 'b9', funcion_id: null, obra_texto: 'OS CHORIZOS', fecha_texto: '2026-08-26' }];
  const a = detectarAvisos({ funciones: FUNCIONES, boletas: huerfana, hoy: '2026-08-24', travel })
    .filter(x => x.tipo === 'boleta_huerfana');
  assert.equal(a.length, 1);
  assert.match(a[0].mensaje, /¿A qué festival pertenece\?/);
});

test('con la hora corregida el jueves no depende de la estimación', () => {
  // Primer Amor termina ~21:20 y Teatro y Cocina abre a las 22:00, misma sala:
  // 40 minutos de margen aguantan que la duración estimada esté equivocada.
  const a = correr().filter(x => x.tipo === 'duracion_estimada' && x.funcion_id === 'amor');
  assert.equal(a.length, 0);
});

test('con la hora vieja del volante el jueves sí colgaba de un número inventado', () => {
  const conHoraVieja = FUNCIONES.map(f =>
    f.id === 'cocina' ? { ...f, hora_min: 1290, fuente_horario: 'volante' } : f);
  const a = detectarAvisos({ funciones: conHoraVieja, boletas: BOLETAS, hoy: '2026-08-24', travel })
    .filter(x => x.tipo === 'duracion_estimada' && x.funcion_id === 'amor');
  assert.equal(a.length, 1);
  assert.match(a[0].mensaje, /estimada en 80 min/);
});

test('un cruce real sí se detecta', () => {
  const funciones = [
    ...FUNCIONES,
    { id: 'ixa', fecha: '2026-08-28', hora_min: 1200, duracion_min: 80, duracion_confirmada: true, obra: 'IXAQUENE', sala_slug: 'mata', agendada: true, acompanantes: 0, fuente_horario: 'volante' },
  ];
  const boletas = [...BOLETAS, { id: 'b10', funcion_id: 'ixa', hora_boleta: 1200 }];
  const a = detectarAvisos({ funciones, boletas, hoy: '2026-08-24', travel })
    .filter(x => x.tipo === 'cruce_franja');
  assert.equal(a.length, 1);
  assert.match(a[0].mensaje, /Una de las dos se pierde/);
});

test('estado derivado: comprada solo cuando alcanzan las boletas', () => {
  assert.equal(estadoDerivado(FUNCIONES[5], BOLETAS, '2026-08-24'), 'agendada'); // Habitar, 1 de 2
  assert.equal(estadoDerivado(FUNCIONES[2], BOLETAS, '2026-08-24'), 'comprada'); // Molienda, 2 de 2
});

test('estado derivado: pasó la fecha sin boleta es no_alcanzada', () => {
  const cocina = FUNCIONES[4];
  assert.equal(estadoDerivado(cocina, BOLETAS, '2026-08-30'), 'no_alcanzada');
});

test('vincular desempata dobles funciones por la hora de la boleta', () => {
  const dobles = [
    { id: 'v5', fecha: '2026-08-27', hora_min: 1020, obra: 'La vida es un cilindro' },
    { id: 'v8', fecha: '2026-08-27', hora_min: 1200, obra: 'La vida es un cilindro' },
  ];
  const r = vincular({ obra_texto: 'LA VIDA ES UN CILINDRO', fecha_texto: '2026-08-27', hora_boleta: 1200 }, dobles);
  assert.equal(r.confianza, 'alta');
  assert.equal(r.funcion.id, 'v8');
});

test('vincular reconoce el título aunque la boleta lo escriba distinto', () => {
  const r = vincular(
    { obra_texto: 'KRAPP, LA ÚLTIMA CINTA', fecha_texto: '2026-08-24', hora_boleta: 1200 },
    FUNCIONES,
  );
  assert.equal(r.confianza, 'alta');
  assert.equal(r.funcion.id, 'krapp');
});

test('una función que solo está en el volante no genera alarmas', () => {
  const conAlternativa = [
    ...FUNCIONES,
    { id: 'ixa29', fecha: '2026-08-29', hora_min: 1200, duracion_min: 80, duracion_confirmada: false,
      obra: 'IXAQUENE', sala_slug: 'mata', agendada: false, acompanantes: 0, fuente_horario: 'volante' },
  ];
  const a = detectarAvisos({ funciones: conAlternativa, boletas: BOLETAS, hoy: '2026-08-30', travel })
    .filter(x => x.funcion_id === 'ixa29');
  assert.equal(a.length, 0);
});

test('comprada pero sin archivo en el baúl: lo dice sin inventar la boleta', () => {
  // Caso real: Petra se compró el 24 de agosto y el PDF quedó en el correo.
  const conPetraComprada = detectarAvisos({
    funciones: FUNCIONES,
    boletas: BOLETAS.filter(b => b.funcion_id !== 'petra'),
    estados: { petra: 'comprada' },
    hoy: '2026-08-24',
    travel,
  }).filter(x => x.tipo === 'sin_archivo');
  assert.equal(conPetraComprada.length, 1);
  assert.equal(conPetraComprada[0].funcion_id, 'petra');
  assert.match(conPetraComprada[0].mensaje, /Búscala en el correo/);
});
