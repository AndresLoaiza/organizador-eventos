import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { medir } from './medida.mjs';

const F = x => ({ obra: 'O', compania: null, descripcion: null, franjas: [], tipos: null, sala: null, interes: null, ...x });
const franja = (nombre, obras, sis, origen = 'manual') =>
  Array.from({ length: obras }, (_, i) =>
    F({ obra: `${nombre}-${String(i).padStart(3, '0')}`, franjas: [nombre], interes: i < sis ? 'si' : 'no', interes_origen: origen }));

// --- La medición misma ------------------------------------------------------

test('medir: una franja que de verdad predice se nota en la precisión y en las bajadas', () => {
  const fs = [...franja('A', 25, 22), ...franja('B', 25, 1), ...franja('C', 50, 2)];
  const r = medir(fs);
  assert.equal(r.obras, 100);
  assert.equal(r.base, 0.25);
  assert.ok(r.precision > 0.8, `precisión ${r.precision}`);
  assert.ok(r.recall > 0.5, `recall ${r.recall}`);
  assert.ok(r.tasaEnBajadas < 0.1, `bajadas ${r.tasaEnBajadas}`);
});

test('medir: sin señal en ningún rasgo no resalta nada', () => {
  const r = medir(franja('A', 100, 25));
  assert.equal(r.resaltadas, 0);
  assert.equal(r.precision, null);
});

test('medir: el filtro de prueba entrena con todo pero evalúa solo una parte', () => {
  const fs = [...franja('A', 25, 22), ...franja('B', 25, 1, 'lote'), ...franja('C', 50, 2, 'lote')];
  const solo = medir(fs, { test: g => g[0].interes_origen === 'manual' });
  assert.equal(solo.obras, 25);
});

test('medir: es determinista', () => {
  const fs = [...franja('A', 25, 22), ...franja('B', 75, 3)];
  assert.deepEqual(medir(fs), medir(fs));
});

// --- Contra tu ojeo ---------------------------------------------------------
// lib/fixtures/ojeo.json lo genera `npm run fixture` y no está en git: es tu
// gusto, y el repositorio es público. Sin él, estos tests se saltan.

const RUTA = new URL('./fixtures/ojeo.json', import.meta.url);
const MIN_POR_CLASE = 20;
const pct = x => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);

function porFestival() {
  const { funciones } = JSON.parse(readFileSync(RUTA, 'utf8'));
  const m = new Map();
  for (const f of funciones) {
    if (!m.has(f.festival)) m.set(f.festival, []);
    m.get(f.festival).push({ ...f, sala: f.sala ? { nombre: f.sala } : null });
  }
  return m;
}

// Una obra cuenta como manual solo si TODAS sus marcas lo son.
const origenDe = g => (g.every(f => f.interes_origen === 'manual') ? 'manual'
  : g.some(f => f.interes_origen === 'lote') ? 'lote' : 'desconocido');

test('el recomendador contra tu ojeo',
  { skip: !existsSync(RUTA) && 'no hay lib/fixtures/ojeo.json: corre npm run fixture' },
  t => {
    for (const [festival, fs] of porFestival()) {
      const vistas = {
        'todas las marcas': medir(fs),
        'sin las de lote': medir(fs, { test: g => origenDe(g) !== 'lote' }),
        'solo las manuales': medir(fs, { test: g => origenDe(g) === 'manual' }),
      };
      for (const [nombre, r] of Object.entries(vistas)) {
        t.diagnostic(`${festival} · ${nombre}: ${r.obras} obras, base ${pct(r.base)}; ` +
          `resalta ${r.resaltadas} con ${pct(r.precision)} de sí (recall ${pct(r.recall)}); ` +
          `baja ${r.bajadas} con ${pct(r.tasaEnBajadas)} de sí`);
      }

      // La compuerta solo se exige con marcas de origen conocido. Las anteriores
      // a la columna interes_origen mezclan juicios con descartes en lote.
      const r = vistas['solo las manuales'];
      const no = r.obras - r.si;
      if (r.si < MIN_POR_CLASE || no < MIN_POR_CLASE) {
        t.diagnostic(`${festival}: la compuerta pide ≥ ${MIN_POR_CLASE} sí y ≥ ${MIN_POR_CLASE} no marcados a mano ` +
          `(hay ${r.si} y ${no}); todavía no se exige`);
        continue;
      }
      assert.ok(r.resaltadas > 0, `${festival}: no resalta nada`);
      assert.ok(r.precision > r.base, `${festival}: resalta con ${pct(r.precision)}, la base es ${pct(r.base)}`);
      if (r.tasaEnBajadas != null) {
        assert.ok(r.tasaEnBajadas < r.base, `${festival}: lo que baja tiene ${pct(r.tasaEnBajadas)} de sí, no menos que la base ${pct(r.base)}`);
      }
    }
  });
