import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternativasDe } from './datos.mjs';
import { crearDecisor, crearTraslado } from './decisor.mjs';

// Regresión del bug que apareció al correr con datos reales de la 22.ª Fiesta:
// al listar lo que había cada noche, se le pasaba al motor solo lo elegido de
// ESA fecha. Con eso, IXAQUENE del sábado salía "vuelve el viernes" y la del
// viernes "vuelve el sábado" — cada una rescatada por la otra, las dos
// bloqueadas en realidad. El veredicto correcto es Perdida.

const FUNCIONES = [
  { id: 'habitar',  fecha: '2026-08-28', hora_min: 1200, duracion_min: 80, duracion_confirmada: true, obra: 'Habitar',  sala_slug: 'pobla', agendada: true },
  { id: 'ixa28',    fecha: '2026-08-28', hora_min: 1200, duracion_min: 80, duracion_confirmada: true, obra: 'IXAQUENE', sala_slug: 'mata',  agendada: false },
  { id: 'ixa29',    fecha: '2026-08-29', hora_min: 1200, duracion_min: 80, duracion_confirmada: true, obra: 'IXAQUENE', sala_slug: 'mata',  agendada: false },
  { id: 'clown29',  fecha: '2026-08-29', hora_min: 1200, duracion_min: 70, duracion_confirmada: true, obra: 'Fiesta Clown', sala_slug: 'clown', agendada: true },
];

const travel = crearTraslado(
  { mata: { z: 'centro' }, clown: { z: 'centro' }, pobla: { z: 'sur' } },
  { centro: { centro: 12, sur: 30 }, sur: { centro: 30, sur: 12 } },
);

const panorama = {
  funciones: FUNCIONES,
  travel,
  decisor: crearDecisor(
    FUNCIONES.map(f => ({
      id: f.id, day: f.fecha, t: f.hora_min, dur: f.duracion_min,
      durEstimada: false, title: f.obra, v: f.sala_slug,
    })),
    travel,
    { '2026-08-28': 'viernes', '2026-08-29': 'sábado' },
  ),
};

test('IXAQUENE del sábado se perdió: el viernes ya está ocupado por Habitar', () => {
  const otras = alternativasDe(panorama, '2026-08-29');
  const ixa = otras.find(o => o.id === 'ixa29');
  assert.equal(ixa.veredicto.cls, 'v-lost');
  assert.match(ixa.veredicto.txt, /Perdida/);
});

test('IXAQUENE del viernes tampoco se rescata en el sábado', () => {
  const otras = alternativasDe(panorama, '2026-08-28');
  const ixa = otras.find(o => o.id === 'ixa28');
  assert.equal(ixa.veredicto.cls, 'v-lost');
});
