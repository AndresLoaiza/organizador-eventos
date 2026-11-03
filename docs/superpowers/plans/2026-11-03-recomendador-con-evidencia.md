# Recomendador con evidencia — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada resaltado del ojeo diga de dónde sale y cuánta evidencia tiene, que el recomendador aprenda del ojeo del propio festival, y que su acierto se pueda medir contra obras que no vio.

**Architecture:** Subproyecto 2 de `docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md`, sección 2. Lógica pura en `lib/`: `evidencia.mjs` aprende del ojeo y emite señales, `medida.mjs` mide con validación cruzada, `interes.mjs` junta las tres fuentes de razón (`dicho`, `ojeo`, `claude`). Las pantallas solo calculan la evidencia con `useMemo` y se la pasan a `razonesDe`. El fixture con tu ojeo va fuera de git porque el repo es público.

**Tech Stack:** Node 22 ESM, `node:test`, React 19 (cliente), Postgres/Supabase (`eventos`).

**Lo medido antes de escribir el plan** (validación cruzada de 5 pliegues sobre las 751 obras ojeadas de la Fiesta del Libro, con el módulo de la Task 2): resalta 101 obras con **53% de aciertos contra 25% de base**, recall 29%; las 359 que baja de prioridad tienen 12% de «sí». La regla `oficio` declarada, por contraste, acertaba 30%. **Cautela:** esas marcas incluyen descartes en lote («Descartar las N sin resaltar») cuyo origen no se guardó, así que la cifra no es una certificación. La Task 1 registra el origen desde ahora.

**Diferencias con el spec (decididas al bajar a los datos):**
- La evidencia de `ojeo` se aprende solo del festival en curso. Pasarla entre festivales no se justifica: San Ignacio tiene 17 obras ojeadas y Artes Escénicas ninguna.
- Las razones de `claude` van por obra, no por función: el ojeo es por obra y una obra repetida en 5 fechas tendría 5 copias del mismo texto. Tabla `eventos.razones (festival_id, obra, texto)`.
- Se agrega `funciones.interes_origen` (`manual` | `lote` | null = desconocido) para poder medir sin contaminar.
- La compuerta que hace fallar el test solo se activa con marcas **conocidas como manuales** (≥ 20 sí y ≥ 20 no). Hoy no hay ninguna, así que la medición se imprime y no se exige todavía. Es la consecuencia honesta de no haber guardado el origen antes.
- Las migraciones se numeran por orden de creación: aquí `013` y `014`; las del spec para bitácora y Calendar pasan a `015` y `016`.

**Antes de empezar:** rama `recomendador` desde `master`. `npm test` pasa completo. Comandos para Git Bash en Windows. Trailer de commits: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `supabase/013_interes_origen.sql` | Crear. Columna `interes_origen` |
| `supabase/014_razones.sql` | Crear. Tabla `razones` con RLS |
| `lib/evidencia.mjs` + `.test.mjs` | Crear. `aprender`, `senalesDe`, `rasgosDe`, `companiaReal`, agrupar por obra |
| `lib/medida.mjs` | Crear. `medir`, validación cruzada |
| `lib/recomendador.test.mjs` | Crear. Tests de `medir` y medición contra el fixture |
| `lib/razones.mjs` + `.test.mjs` | Crear. Validador de las razones escritas por Claude |
| `lib/interes.mjs` + `.test.mjs` | Modificar. `razonesDe(f, ev)`, `aprenderOjeo`, `textoRazon`, `filaInteres` |
| `lib/cliente.mjs`, `lib/datos.mjs`, `lib/panorama.mjs` | Modificar. Origen del interés y razones de Claude |
| `app/ojear/Ojeo.js`, `app/decidir/Decisor.js` | Modificar. Pasar la evidencia |
| `scripts/fixture-ojeo.mjs` | Crear. Base → `lib/fixtures/ojeo.json` |
| `scripts/razones.mjs` | Crear. `festivales/<slug>.razones.json` → base |
| `.gitignore`, `package.json`, `README.md`, skill `festival-agenda` | Modificar |

---

### Task 1: Origen de cada marca de interés

**Files:**
- Create: `supabase/013_interes_origen.sql`
- Modify: `lib/interes.mjs` (agregar `filaInteres`), `lib/interes.test.mjs`, `lib/cliente.mjs`, `app/ojear/Ojeo.js`

- [ ] **Step 1: Rama**

La rama `recomendador` ya existe y trae este plan. Solo confirmar:

```bash
cd "D:/ANDRES/Claude_Projects/Organizador_Eventos"
git branch --show-current
```

Expected: `recomendador`. Si no, `git checkout recomendador`.

- [ ] **Step 2: Escribir el test que falla**

Agregar al final de `lib/interes.test.mjs`:

```js
import { filaInteres } from './interes.mjs';

test('filaInteres guarda de dónde viene la marca', () => {
  assert.deepEqual(filaInteres('si'), { interes: 'si', interes_origen: 'manual' });
  assert.deepEqual(filaInteres('no', true), { interes: 'no', interes_origen: 'lote' });
});

test('filaInteres: deshacer una marca borra también su origen', () => {
  assert.deepEqual(filaInteres(null), { interes: null, interes_origen: null });
  assert.deepEqual(filaInteres(undefined, true), { interes: null, interes_origen: null });
});
```

Run: `node --test lib/interes.test.mjs` — Expected: FAIL (`filaInteres` no existe).

- [ ] **Step 3: Implementar `filaInteres`**

En `lib/interes.mjs`, justo antes de `export function contarOjeo`, agregar:

```js
/**
 * Columnas que se escriben al marcar interés. El origen importa para medir:
 * un «no» de «Descartar las N sin resaltar» no es un juicio sobre cada obra,
 * y mezclado con los juicios de verdad hace pasar por error lo que el
 * recomendador acierta o falla.
 */
export function filaInteres(interes, lote = false) {
  return {
    interes: interes ?? null,
    interes_origen: interes ? (lote ? 'lote' : 'manual') : null,
  };
}
```

Run: `node --test lib/interes.test.mjs` — Expected: todos pasan.

- [ ] **Step 4: Migración**

`supabase/013_interes_origen.sql`:

```sql
-- De dónde viene cada marca de interés: manual (una obra a la vez), lote
-- («Descartar las N sin resaltar») o NULL = desconocido (marcas anteriores a
-- esta columna, que mezclan las dos cosas sin forma de separarlas).

alter table eventos.funciones add column if not exists interes_origen text
  check (interes_origen in ('manual', 'lote'));

comment on column eventos.funciones.interes_origen is
  'manual | lote | NULL desconocido. Solo cuenta como juicio de la obra el manual.';

notify pgrst, 'reload schema';
```

Run: `npm run migrar` — Expected: termina en `013_interes_origen.sql` y `Migraciones aplicadas.`; `funciones` pasa a 25 columnas.

- [ ] **Step 5: Escribir el origen desde la app**

En `lib/cliente.mjs`: agregar al bloque de imports `import { filaInteres } from './interes.mjs';`, y reemplazar las dos funciones de interés por:

```js
export async function marcarInteres(id, interes, codigo = leerCodigo()) {
  const { error } = await db(codigo).from('funciones')
    .update(filaInteres(interes)).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Marca varias funciones de golpe. `lote: true` solo para el descarte masivo
 * de una franja; marcar todas las fechas de UNA obra es una marca manual.
 */
export async function marcarInteresVarias(ids, interes, { lote = false } = {}, codigo = leerCodigo()) {
  if (!ids.length) return;
  const { error } = await db(codigo).from('funciones')
    .update(filaInteres(interes, lote)).in('id', ids);
  if (error) throw new Error(error.message);
}
```

(Se conservan los comentarios existentes encima de cada función.)

En `app/ojear/Ojeo.js`, dentro de `descartarLote`, cambiar `await marcarInteresVarias(ids, 'no');` por `await marcarInteresVarias(ids, 'no', { lote: true });`. La otra llamada (`marcar`, línea ~127) no cambia.

- [ ] **Step 6: Verificar**

```bash
grep -rn "marcarInteresVarias" app lib scripts
npm test 2>&1 | grep -E "^# (pass|fail)"
npm run build 2>&1 | tail -3
```

Expected: dos llamadas (`marcar` sin opciones, `descartarLote` con `{ lote: true }`); 0 fallos; build exitoso.

- [ ] **Step 7: Commit**

```bash
git add supabase/013_interes_origen.sql lib/interes.mjs lib/interes.test.mjs lib/cliente.mjs app/ojear/Ojeo.js
git commit -m "feat: guardar si una marca de interés vino a mano o del descarte en lote

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/evidencia.mjs` — aprender del ojeo

**Files:**
- Create: `lib/evidencia.mjs`, `lib/evidencia.test.mjs`

- [ ] **Step 1: Escribir los tests**

`lib/evidencia.test.mjs`:

```js
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
```

Run: `node --test lib/evidencia.test.mjs` — Expected: FAIL (módulo no existe).

- [ ] **Step 2: Implementar**

`lib/evidencia.mjs`:

```js
// Qué enseña el ojeo de un festival sobre qué te interesa.
//
// Cada marca de «sí» o «no» es una observación sobre una obra. Esta pieza
// cuenta, para cada rasgo de la ficha (franja, técnica, sala, compañía), en
// cuántas obras ojeadas hubo un sí. Cuando un rasgo tiene suficientes casos y
// su tasa de sí se aparta de la base, emite una señal con sus cifras a la
// vista: «El Quijote: 8 de 9». Nada de pesos escondidos; cada señal se puede
// contradecir porque dice de qué números sale.
//
// Los umbrales no se afinaron sobre tu ojeo: se fijaron antes de medir y con
// otras cuatro combinaciones la precisión cae entre 47% y 56%, no se mueve.

export const MIN_CASOS = 5;     // menos obras que esto y no se dice nada
export const MIN_TASA = 0.5;    // un rasgo positivo acierta al menos la mitad
export const MIN_LIFT = 1.5;    // y al menos una vez y media la base
const MAX_LARGO_COMPANIA = 80;  // más largo que esto es una descripción, no un nombre

/** Todas las funciones de una misma obra juntas. */
export function agruparPorObra(funciones) {
  const m = new Map();
  for (const f of funciones) {
    if (!m.has(f.obra)) m.set(f.obra, []);
    m.get(f.obra).push(f);
  }
  return [...m.values()];
}

/**
 * El interés de una obra: 'si' o 'no' solo si todas sus funciones coinciden.
 * Si falta ojear alguna, o quedaron mezcladas (herencia de cuando se marcaba
 * función por función), null: no es un juicio sobre la obra.
 */
export function interesDeGrupo(ocurrencias) {
  if (ocurrencias.every(o => o.interes === 'si')) return 'si';
  if (ocurrencias.every(o => o.interes === 'no')) return 'no';
  return null;
}

/**
 * La compañía de verdad. Las columnas heredadas la pegan con la descripción:
 * San Ignacio guarda «compañía · descripción» y la Fiesta del Libro guarda
 * solo la descripción en `compania`. Con las columnas nuevas se deshace.
 */
export function companiaReal(f) {
  const c = f.compania || null;
  if (!c) return null;
  if (!f.descripcion) return c;
  if (c === f.descripcion) return null;
  const sufijo = ` · ${f.descripcion}`;
  return c.endsWith(sufijo) ? c.slice(0, -sufijo.length) : c;
}

/** Los rasgos de una ficha que pueden predecir el interés. */
export function rasgosDe(f) {
  const out = [];
  for (const v of f.franjas ?? []) out.push({ tipo: 'franja', valor: v });
  for (const v of f.tipos ?? []) out.push({ tipo: 'tipo', valor: v });
  if (f.sala?.nombre) out.push({ tipo: 'sala', valor: f.sala.nombre });
  const c = companiaReal(f);
  if (c && c.length <= MAX_LARGO_COMPANIA) out.push({ tipo: 'compañía', valor: c });
  return out;
}

export const claveDe = r => `${r.tipo}\u0000${r.valor}`;

/**
 * Cuenta sobre las obras ojeadas de un festival.
 *
 * @param funciones     funciones del festival con `interes`
 * @param idsDeReglas   f => ids de las reglas declaradas que casan con la ficha;
 *                      sirve para anotar cuánto acierta cada regla que Andrés dictó
 * @returns { n, si, base, rasgos: Map, reglas: Map }
 */
export function aprender(funciones, idsDeReglas = () => []) {
  const rasgos = new Map(), reglas = new Map();
  let n = 0, si = 0;
  for (const grupo of agruparPorObra(funciones)) {
    const estado = interesDeGrupo(grupo);
    if (!estado) continue;
    const y = estado === 'si' ? 1 : 0;
    n++; si += y;
    const ref = grupo[0];
    const vistos = new Set();
    for (const r of rasgosDe(ref)) {
      const k = claveDe(r);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const s = rasgos.get(k) ?? { tipo: r.tipo, valor: r.valor, n: 0, si: 0 };
      s.n++; s.si += y;
      rasgos.set(k, s);
    }
    for (const id of new Set(idsDeReglas(ref))) {
      const s = reglas.get(id) ?? { n: 0, si: 0 };
      s.n++; s.si += y;
      reglas.set(id, s);
    }
  }
  return { n, si, base: n ? si / n : 0, rasgos, reglas };
}

/**
 * Señales de una ficha según lo aprendido.
 *   '+' el rasgo acierta mucho más que la base: resaltar.
 *   '-' el rasgo acierta la mitad de la base o menos: mandar al final.
 * Una señal negativa ordena, no esconde: descartar es decisión de Andrés.
 */
export function senalesDe(f, ev) {
  if (!ev || ev.n < MIN_CASOS) return [];
  const out = [];
  for (const r of rasgosDe(f)) {
    const s = ev.rasgos.get(claveDe(r));
    if (!s || s.n < MIN_CASOS) continue;
    const tasa = s.si / s.n;
    if (tasa >= MIN_TASA && tasa >= ev.base * MIN_LIFT) out.push({ ...s, tasa, signo: '+' });
    else if (ev.base > 0 && tasa <= ev.base / 2) out.push({ ...s, tasa, signo: '-' });
  }
  return out;
}
```

- [ ] **Step 3: Ver que pasan**

Run: `node --test lib/evidencia.test.mjs` — Expected: 13 pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add lib/evidencia.mjs lib/evidencia.test.mjs
git commit -m "feat: aprender del ojeo qué rasgos predicen el interés

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/medida.mjs` y la medición

**Files:**
- Create: `lib/medida.mjs`, `lib/recomendador.test.mjs`

- [ ] **Step 1: Escribir los tests de `medir`**

`lib/recomendador.test.mjs`:

```js
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
```

Run: `node --test lib/recomendador.test.mjs` — Expected: FAIL (`medida.mjs` no existe).

- [ ] **Step 2: Implementar**

`lib/medida.mjs`:

```js
import { aprender, senalesDe, agruparPorObra, interesDeGrupo } from './evidencia.mjs';

/**
 * Qué tan bien predice el recomendador tu ojeo, medido sobre obras que no vio.
 *
 * Validación cruzada de k pliegues, por obra y dentro de UN festival: se aprende
 * de k-1 partes y se evalúa en la que quedó afuera. Medir sobre lo mismo que se
 * usó para aprender daría números inflados.
 *
 * `test` decide qué obras cuentan al evaluar (se entrena siempre con todas).
 *
 *   precision: de lo resaltado, cuánto marcaste sí
 *   recall:    de lo que marcaste sí, cuánto se resaltó
 *   tasaEnBajadas: de lo que se mandó al final de la lista, cuánto marcaste sí
 *                  (tiene que ser menor que la base, o esa señal miente)
 */
export function medir(funciones, { k = 5, test = () => true } = {}) {
  const grupos = agruparPorObra(funciones)
    .filter(g => interesDeGrupo(g))
    .sort((a, b) => a[0].obra.localeCompare(b[0].obra));
  const m = { obras: 0, si: 0, resaltadas: 0, aciertos: 0, bajadas: 0, siEnBajadas: 0 };
  for (let i = 0; i < k; i++) {
    const ev = aprender(grupos.filter((_, j) => j % k !== i).flat());
    for (const g of grupos.filter((_, j) => j % k === i)) {
      if (!test(g)) continue;
      const y = interesDeGrupo(g) === 'si' ? 1 : 0;
      m.obras++; m.si += y;
      const s = senalesDe(g[0], ev);
      if (s.some(x => x.signo === '+')) { m.resaltadas++; m.aciertos += y; }
      else if (s.some(x => x.signo === '-')) { m.bajadas++; m.siEnBajadas += y; }
    }
  }
  return {
    ...m,
    base: m.obras ? m.si / m.obras : 0,
    precision: m.resaltadas ? m.aciertos / m.resaltadas : null,
    recall: m.si ? m.aciertos / m.si : null,
    tasaEnBajadas: m.bajadas ? m.siEnBajadas / m.bajadas : null,
  };
}
```

- [ ] **Step 3: Ver que pasan**

Run: `node --test lib/recomendador.test.mjs` — Expected: 4 pass y 1 skipped (aún no hay fixture).

- [ ] **Step 4: Commit**

```bash
git add lib/medida.mjs lib/recomendador.test.mjs
git commit -m "feat: medir el recomendador por validación cruzada contra el ojeo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fixture del ojeo, fuera de git

**Files:**
- Create: `scripts/fixture-ojeo.mjs`
- Modify: `.gitignore`, `package.json`

- [ ] **Step 1: Ignorar el fixture y las razones**

Agregar al final de `.gitignore`:

```
# Tu gusto: el repositorio es público. Se regenera con npm run fixture.
lib/fixtures/
# Razones que Claude escribe a partir de tu perfil.
festivales/*.razones.json
```

- [ ] **Step 2: Script**

`scripts/fixture-ojeo.mjs`:

```js
import { writeFile, mkdir } from 'node:fs/promises';
import { sql, poolPg } from './_cliente.mjs';

// Base -> lib/fixtures/ojeo.json: solo las funciones que ya ojeaste, con los
// rasgos que usa el recomendador. Va fuera de git (ver .gitignore) porque es tu
// gusto y el repositorio es público. lib/recomendador.test.mjs lo mide.

const filas = await sql(`
  select fe.slug as festival, f.obra, f.compania, f.descripcion, f.franjas, f.tipos,
         s.nombre as sala, f.interes, f.interes_origen
    from eventos.funciones f
    join eventos.festivales fe on fe.id = f.festival_id
    left join eventos.salas s on s.id = f.sala_id
   where f.interes is not null
   order by fe.slug, f.obra, f.fecha, f.hora_min`);

const dir = new URL('../lib/fixtures/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('ojeo.json', dir),
  JSON.stringify({ generado: new Date().toISOString(), funciones: filas }));

const origen = { manual: 0, lote: 0, desconocido: 0 };
for (const f of filas) origen[f.interes_origen ?? 'desconocido']++;
console.log(`${filas.length} funciones ojeadas -> lib/fixtures/ojeo.json`);
console.log(`Origen de las marcas: ${origen.manual} manuales, ${origen.lote} en lote, ${origen.desconocido} desconocidas.`);
await poolPg().end();
```

- [ ] **Step 3: Scripts npm**

En `package.json`, dentro de `"scripts"`, agregar después de `"cargar"`:

```json
    "fixture": "node --env-file=.env.local scripts/fixture-ojeo.mjs",
    "recomendador": "node --test lib/recomendador.test.mjs",
```

- [ ] **Step 4: Generar y medir**

```bash
npm run fixture
git status --short lib/fixtures .gitignore
npm run recomendador 2>&1 | grep -E "^# |^ok|^not ok"
```

Expected: `lib/fixtures/ojeo.json` **no** aparece en `git status` (ignorado). Origen: 0 manuales, 0 en lote, todas desconocidas (~800). La salida muestra tres líneas por festival, y para la Fiesta del Libro «todas las marcas» ronda **53% de aciertos contra una base de 25%** (puede variar un punto: aquí el orden de los pliegues es por nombre de obra). Para «solo las manuales» dice `0 obras` y que la compuerta todavía no se exige. El test termina en pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/fixture-ojeo.mjs .gitignore package.json
git commit -m "feat: fixture del ojeo fuera de git para medir el recomendador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `lib/interes.mjs` junta las fuentes de razón

**Files:**
- Modify: `lib/interes.mjs`, `lib/interes.test.mjs`

- [ ] **Step 1: Tests que fallan**

Agregar al final de `lib/interes.test.mjs`:

```js
import { aprenderOjeo, textoRazon, bajaPrioridad, reglasDe } from './interes.mjs';

// Un festival con tres tipos de franja: una que casi siempre es sí, una que casi
// nunca, y obras sin rasgos. Base = 7 de 42.
function ojeado() {
  return [
    ...Array.from({ length: 6 }, (_, i) => F({ obra: `Q${i}`, franjas: ['El Quijote'], interes: i < 5 ? 'si' : 'no' })),
    ...Array.from({ length: 30 }, (_, i) => F({ obra: `L${i}`, franjas: ['Lanzamientos'], interes: i < 1 ? 'si' : 'no' })),
    ...Array.from({ length: 6 }, (_, i) => F({ obra: `Libre${i}`, interes: i < 1 ? 'si' : 'no' })),
  ];
}

test('razonesDe sin evidencia es lo de siempre: solo las reglas declaradas', () => {
  assert.deepEqual(razonesDe(F({ franjas: ['El Quijote'] })), []);
  assert.equal(razonesDe(F({ obra: 'Gala de clown' }))[0].origen, 'dicho');
});

test('razonesDe suma lo que aprendió del ojeo, con sus cifras', () => {
  const ev = aprenderOjeo(ojeado());
  const rs = razonesDe(F({ obra: 'Una charla', franjas: ['El Quijote'] }), ev);
  assert.equal(rs.length, 1);
  assert.equal(rs[0].origen, 'ojeo');
  assert.equal(rs[0].etiqueta, 'El Quijote: 5 de 6');
  assert.match(rs[0].fuente, /tu ojeo de este festival/);
  assert.deepEqual(rs[0].evidencia, { si: 5, n: 6 });
});

test('una regla declarada muestra cuánto acierta en tu ojeo, aunque acierte poco', () => {
  const fs = [
    ...ojeado(),
    ...Array.from({ length: 4 }, (_, i) => F({ obra: `Clown ${i}`, interes: i < 1 ? 'si' : 'no' })),
  ];
  const ev = aprenderOjeo(fs);
  const r = razonesDe(F({ obra: 'Otro clown' }), ev)[0];
  assert.equal(r.origen, 'dicho');
  assert.deepEqual(r.evidencia, { si: 1, n: 4 });
  assert.match(textoRazon(r), /en tu ojeo de este festival: 1 de 4 \(pocos casos\)/);
});

test('textoRazon de una razón sin evidencia es solo su fuente', () => {
  assert.equal(textoRazon(razonesDe(F({ obra: 'Gala de clown' }))[0]), REGLAS.find(r => r.id === 'oficio').fuente);
});

test('lo que sube por el ojeo cuenta como resaltado, lo que baja no', () => {
  const ev = aprenderOjeo(ojeado());
  assert.equal(razonesDe(F({ franjas: ['El Quijote'] }), ev).length, 1);
  assert.equal(razonesDe(F({ franjas: ['Lanzamientos'] }), ev).length, 0);
  assert.equal(bajaPrioridad(F({ franjas: ['Lanzamientos'] }), ev), true);
  assert.equal(bajaPrioridad(F({ franjas: ['El Quijote'] }), ev), false);
});

test('al ojear: lo que sube va primero, lo que baja va al final, no desaparece', () => {
  const ev = aprenderOjeo(ojeado());
  const a = F({ obra: 'Lanzamiento nuevo', franjas: ['Lanzamientos'], hora_min: 500 });
  const b = F({ obra: 'Sin rasgos', hora_min: 600 });
  const c = F({ obra: 'Quijote nuevo', franjas: ['El Quijote'], hora_min: 700 });
  assert.deepEqual(ordenarParaOjear([a, b, c], ev).map(f => f.obra),
    ['Quijote nuevo', 'Sin rasgos', 'Lanzamiento nuevo']);
});

test('reglasDe expone las reglas declaradas sin evidencia', () => {
  assert.deepEqual(reglasDe(F({ obra: 'Gala de clown' })).map(r => r.id), ['oficio']);
});
```

Run: `node --test lib/interes.test.mjs` — Expected: FAIL (`aprenderOjeo` etc. no existen).

- [ ] **Step 2: Implementar**

En `lib/interes.mjs`:

1. Después del comentario de cabecera y de `const norm = ...`, agregar los imports (ESM los iza, pueden ir ahí):

```js
import { aprender, senalesDe, MIN_CASOS } from './evidencia.mjs';

// agruparPorObra e interesDeGrupo viven en evidencia.mjs; se re-exportan para
// que quien las importaba de aquí no cambie.
export { agruparPorObra, interesDeGrupo } from './evidencia.mjs';
```

2. Borrar las definiciones de `agruparPorObra` e `interesDeGrupo` (con sus comentarios) al final del archivo.

3. Reemplazar la función `razonesDe` (con su comentario) por:

```js
/** Reglas declaradas que casan con la ficha. Sin evidencia: eso lo agrega razonesDe. */
export function reglasDe(f) {
  const texto = norm(`${f.obra} ${f.compania}`);
  return REGLAS
    .filter(r => r.claves.some(k => texto.includes(k)))
    .map(({ id, etiqueta, fuente }) => ({ id, etiqueta, fuente }));
}

/** Lo que el ojeo del festival en curso ya enseñó. Puro: se recalcula al ojear. */
export const aprenderOjeo = funciones => aprender(funciones, f => reglasDe(f).map(r => r.id));

/**
 * Razones por las que una función merece una segunda mirada. Vacío = ninguna,
 * que no significa mala: significa que nada de lo dicho ni de lo ojeado apunta ahí.
 *
 * Cada razón dice su origen:
 *   dicho  una regla que Andrés dictó; se queda aunque acierte poco, pero
 *          muestra cuánto acierta en este festival
 *   ojeo   un rasgo (franja, técnica, sala, compañía) que en este festival
 *          marcaste sí mucho más que el resto
 *
 * La franja no entra en la búsqueda de las reglas dichas a propósito:
 * «Lanzamientos de libros» son 317 de 776 funciones, y buscar esa palabra
 * resaltaría media Fiesta. Como rasgo aprendido sí cuenta, porque ahí lo que
 * pesa es cuántas veces dijiste sí dentro de ella, no que exista.
 */
export function razonesDe(f, ev = null) {
  const dicho = reglasDe(f).map(r => {
    const e = ev?.reglas.get(r.id);
    return { ...r, origen: 'dicho', evidencia: e ? { si: e.si, n: e.n } : null };
  });
  const ojeo = senalesDe(f, ev).filter(s => s.signo === '+').map(s => ({
    id: `ojeo:${s.tipo}:${s.valor}`,
    etiqueta: `${s.valor}: ${s.si} de ${s.n}`,
    fuente: `tu ojeo de este festival: marcaste sí ${s.si} de ${s.n} obras de ${s.tipo} «${s.valor}»`,
    origen: 'ojeo',
    evidencia: { si: s.si, n: s.n },
  }));
  return [...dicho, ...ojeo];
}

/** El texto largo de una razón, para el title del chip. */
export function textoRazon(r) {
  if (r.origen !== 'dicho' || !r.evidencia) return r.fuente;
  const { si, n } = r.evidencia;
  return `${r.fuente} · en tu ojeo de este festival: ${si} de ${n}${n < MIN_CASOS ? ' (pocos casos)' : ''}`;
}

/** ¿Algún rasgo de esta ficha suele ser «no» para ti? Ordena al final; no esconde. */
export const bajaPrioridad = (f, ev) => senalesDe(f, ev).some(s => s.signo === '-');
```

4. Reemplazar `ordenarParaOjear` (con su comentario) por:

```js
/**
 * Orden de ojeo: primero lo que coincide con algo tuyo (dicho u ojeado), al
 * final lo que suele ser «no» en este festival, en medio el resto. Dentro de
 * cada peso, por hora. Lo que baja sigue en la lista: solo tú descartas.
 */
export function ordenarParaOjear(funciones, ev = null) {
  const pesos = new Map(funciones.map(f =>
    [f, razonesDe(f, ev).length ? 0 : bajaPrioridad(f, ev) ? 2 : 1]));
  return [...funciones].sort((a, b) =>
    pesos.get(a) - pesos.get(b) || a.hora_min - b.hora_min || a.obra.localeCompare(b.obra));
}
```

- [ ] **Step 3: Ver que pasan**

```bash
node --test lib/interes.test.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"
npm test 2>&1 | grep -E "^# (pass|fail)"
```

Expected: 0 fallos. Los tests anteriores de `razonesDe(f)` sin segundo argumento pasan sin tocarse.

- [ ] **Step 4: Commit**

```bash
git add lib/interes.mjs lib/interes.test.mjs
git commit -m "feat: las razones del ojeo dicen su origen y sus cifras

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Las pantallas pasan la evidencia

**Files:**
- Modify: `app/ojear/Ojeo.js`, `app/decidir/Decisor.js`

- [ ] **Step 1: `app/ojear/Ojeo.js`**

1. En el import de `lib/interes.mjs` (líneas ~6-9), agregar `aprenderOjeo, textoRazon` a la lista.
2. Justo después de `const cuenta = useMemo(() => contarOjeo(p.funciones), [p.funciones]);` agregar:

```js
  // Lo que este ojeo ya enseñó: franjas, técnicas, salas y compañías donde
  // vienes diciendo que sí. Se recalcula al marcar, y por eso el orden cambia.
  const ev = useMemo(() => aprenderOjeo(p.funciones), [p.funciones]);
```

3. En `visibles`: cambiar `ordenarParaOjear(p.funciones` por `ordenarParaOjear(p.funciones` (sin cambio) pero cerrar con `, ev)`; es decir, el useMemo pasa a:

```js
  const visibles = useMemo(() => ordenarParaOjear(p.funciones
    .filter(f => !dia || f.fecha === dia)
    .filter(f => !lugar || f.sala?.nombre === lugar)
    .filter(f => !franja || franjaDe(f) === franja)
    .filter(f => !tipo || (tipo === SIN_TIPO ? !f.tipos?.length : f.tipos?.includes(tipo)))
    .filter(f => ver === 'todas'
      || (ver === 'sinVer' && !f.interes)
      || (ver === 'destacadas' && razonesDe(f, ev).length && f.interes !== 'no')
      || f.interes === ver)
    .filter(f => !busca || norm(`${f.obra} ${f.compania}`).includes(norm(busca))), ev),
  [p.funciones, dia, franja, lugar, tipo, ver, busca, ev]);
```

4. En `gruposParaDescartar`: `!razonesDe(g.ref).length` → `!razonesDe(g.ref, ev).length`.
5. En el render de cada tarjeta: `const razones = razonesDe(g.ref);` → `const razones = razonesDe(g.ref, ev);`.
6. En el chip: `<b className="razon" key={r.id} title={r.fuente}>{r.etiqueta}</b>` → `<b className="razon" key={r.id} data-origen={r.origen} title={textoRazon(r)}>{r.etiqueta}</b>`.

- [ ] **Step 2: `app/decidir/Decisor.js`**

1. Cambiar `import { razonesDe } from '../../lib/interes.mjs';` por `import { razonesDe, aprenderOjeo, textoRazon } from '../../lib/interes.mjs';`.
2. Dentro del componente, justo después del `useMemo` de `candidatas`, agregar `const ev = useMemo(() => aprenderOjeo(p.funciones), [p.funciones]);`.
3. En el chip: `{razonesDe(f).map(r => (<b className="razon" key={r.id} title={r.fuente}> {r.etiqueta}</b>))}` → `{razonesDe(f, ev).map(r => (<b className="razon" key={r.id} data-origen={r.origen} title={textoRazon(r)}> {r.etiqueta}</b>))}`.

- [ ] **Step 3: Verificar**

```bash
grep -n "razonesDe(" app/ojear/Ojeo.js app/decidir/Decisor.js
npm test 2>&1 | grep -E "^# (pass|fail)"
npm run build 2>&1 | tail -4
```

Expected: toda llamada a `razonesDe` pasa `ev`; 0 fallos; build exitoso. Si el build falla por `ev` usado antes de definirse dentro de un `useMemo`, mover la línea de `ev` por encima del primer uso.

- [ ] **Step 4: Probar en el navegador**

Con `npm run dev` y la pestaña Ojear de la Fiesta del Libro, comprobar que: (a) las obras de «El Quijote» y «Clases maestras» aparecen primero con chips tipo «El Quijote: 8 de 9»; (b) los «Lanzamientos de libros» van al final pero siguen ahí; (c) el chip de una regla dictada (por ejemplo «Oficio transferible») sigue apareciendo aunque acierte poco; (d) «Descartar las N sin resaltar» ya no incluye las que subieron por el ojeo. **Esto no se puede probar con tests;** si no hay forma de abrir la app, reportarlo como no verificado.

- [ ] **Step 5: Commit**

```bash
git add app/ojear/Ojeo.js app/decidir/Decisor.js
git commit -m "feat: Ojear y Decidir muestran las razones aprendidas con sus cifras

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Razones escritas por Claude, por obra

**Files:**
- Create: `supabase/014_razones.sql`, `lib/razones.mjs`, `lib/razones.test.mjs`, `scripts/razones.mjs`
- Modify: `lib/panorama.mjs`, `lib/cliente.mjs`, `lib/datos.mjs`, `lib/interes.mjs`, `lib/interes.test.mjs`, `app/ojear/Ojeo.js`, `package.json`

- [ ] **Step 1: Tests del validador**

`lib/razones.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarRazones, canonicas, MAX_TEXTO } from './razones.mjs';

const obras = ['Petra, versión libre', 'Ixaquene'];
const ok = { obra: 'Petra, versión libre', texto: 'Teatro gestual con hilo narrativo: tu punto medio.' };

test('una lista bien formada no tiene errores', () => {
  assert.deepEqual(validarRazones([ok], obras), []);
});

test('la obra se reconoce sin importar mayúsculas ni tildes, y se devuelve con el nombre de la base', () => {
  const lista = [{ obra: 'IXAQUENE', texto: 'Acrobacia aérea.' }];
  assert.deepEqual(validarRazones(lista, obras), []);
  assert.deepEqual(canonicas(lista, obras), [{ obra: 'Ixaquene', texto: 'Acrobacia aérea.' }]);
});

test('obra que no está en el festival', () => {
  assert.match(validarRazones([{ obra: 'Hamlet', texto: 'x' }], obras).join(), /Hamlet.*no está/);
});

test('obra repetida, texto vacío o demasiado largo', () => {
  assert.match(validarRazones([ok, ok], obras).join(), /repetida/);
  assert.match(validarRazones([{ ...ok, texto: '  ' }], obras).join(), /vacío/);
  assert.match(validarRazones([{ ...ok, texto: 'x'.repeat(MAX_TEXTO + 1) }], obras).join(), /máximo/);
});

test('algo que no es una lista', () => {
  assert.match(validarRazones({}, obras).join(), /lista/);
});
```

Run: `node --test lib/razones.test.mjs` — Expected: FAIL (módulo no existe).

- [ ] **Step 2: Validador**

`lib/razones.mjs`:

```js
import { tituloNormalizado } from './nombres.mjs';

// Las razones que Claude escribe al cargar un festival, por obra: dónde ninguna
// regla ni el ojeo alcanzan, una frase que dice por qué podría interesarte y de
// qué parte del perfil sale. Se guardan en festivales/<slug>.razones.json, que
// no va a git (es tu gusto y el repositorio es público).

export const MAX_TEXTO = 280;

/** Errores de una lista [{ obra, texto }] frente a las obras del festival. */
export function validarRazones(lista, obras) {
  if (!Array.isArray(lista)) return ['el archivo debe ser una lista de { obra, texto }'];
  const e = [];
  const existentes = new Set(obras.map(tituloNormalizado));
  const vistas = new Set();
  for (const [i, r] of lista.entries()) {
    const donde = `razones[${i}]`;
    if (!r || typeof r.obra !== 'string' || typeof r.texto !== 'string') {
      e.push(`${donde}: faltan obra o texto`);
      continue;
    }
    const n = tituloNormalizado(r.obra);
    if (!existentes.has(n)) e.push(`${donde}: la obra «${r.obra}» no está en el festival`);
    if (vistas.has(n)) e.push(`${donde}: «${r.obra}» repetida`);
    vistas.add(n);
    if (!r.texto.trim()) e.push(`${donde}: texto vacío`);
    if (r.texto.length > MAX_TEXTO) e.push(`${donde}: texto de ${r.texto.length} caracteres, máximo ${MAX_TEXTO}`);
  }
  return e;
}

/** La misma lista con cada obra escrita como está en la base. */
export function canonicas(lista, obras) {
  const porNorm = new Map(obras.map(o => [tituloNormalizado(o), o]));
  return lista.map(r => ({ obra: porNorm.get(tituloNormalizado(r.obra)), texto: r.texto.trim() }));
}
```

Run: `node --test lib/razones.test.mjs` — Expected: 5 pass.

- [ ] **Step 3: Migración**

`supabase/014_razones.sql`:

```sql
-- Razones escritas por Claude al cargar un festival, una por obra (el ojeo es
-- por obra: una obra repetida en cinco fechas no necesita cinco copias).

create table if not exists eventos.razones (
  id           uuid primary key default gen_random_uuid(),
  festival_id  uuid not null references eventos.festivales(id) on delete cascade,
  obra         text not null,
  texto        text not null check (char_length(texto) <= 280),
  creado       timestamptz not null default now(),
  unique (festival_id, obra)
);

alter table eventos.razones enable row level security;

drop policy if exists acceso_codigo on eventos.razones;
create policy acceso_codigo on eventos.razones for all to anon, authenticated
  using (eventos.acceso_ok()) with check (eventos.acceso_ok());

notify pgrst, 'reload schema';
```

Los permisos de tabla vienen de `alter default privileges` en la migración 004; solo hacen falta RLS y la política.

Run: `npm run migrar` — Expected: termina en `014_razones.sql`; aparece `razones (5 columnas)`.

- [ ] **Step 4: Cargar las razones al panorama**

En `lib/panorama.mjs`:
- La firma de `armarPanorama` pasa a `({ festival, festivales = [], salas, funciones: filas, boletas, estados: estadosFilas, bitacora, traslados, razones = [] })`.
- Justo antes de `const funciones = filas.map(f => ({`, agregar:

```js
  const razonPorObra = Object.fromEntries(
    razones.filter(r => r.festival_id === festival.id).map(r => [r.obra, r.texto]));
```

- Dentro de ese `filas.map`, después de `sala_slug: ...,` agregar `razon_claude: razonPorObra[f.obra] ?? null,`.

En `lib/cliente.mjs`: agregar `traer(c, 'razones')` al final del `Promise.all` (y `razones` al final del array desestructurado), y pasar `razones` en la llamada a `armarPanorama({ ... })`.

En `lib/datos.mjs`: agregar `sql('select * from eventos.razones')` al `Promise.all`, `razones` al desestructurado, y pasarlo a `armarPanorama`.

- [ ] **Step 5: `razonesDe` incluye la razón de Claude**

Agregar a `lib/interes.test.mjs`:

```js
test('la razón de Claude aparece con su origen y su texto', () => {
  const f = F({ obra: 'Pura carreta', razon_claude: 'Quijote con percusión: teatro físico con hilo narrativo, tu punto medio.' });
  const r = razonesDe(f).find(x => x.origen === 'claude');
  assert.equal(r.etiqueta, 'Nota de Claude');
  assert.match(textoRazon(r), /Claude.*Quijote con percusión/);
});

test('sin razón de Claude no hay chip de Claude', () => {
  assert.equal(razonesDe(F({ obra: 'Gala de clown' })).some(r => r.origen === 'claude'), false);
});
```

En `lib/interes.mjs`, en `razonesDe`, cambiar el `return` por:

```js
  const claude = f.razon_claude ? [{
    id: 'claude',
    etiqueta: 'Nota de Claude',
    fuente: 'escrita por Claude al cargar el festival, a partir de tu perfil',
    origen: 'claude',
    texto: f.razon_claude,
    evidencia: null,
  }] : [];
  return [...dicho, ...ojeo, ...claude];
```

y en `textoRazon`, como primera línea: `if (r.origen === 'claude') return `${r.fuente}: ${r.texto}`;`.

Run: `node --test lib/interes.test.mjs` — Expected: todos pasan.

- [ ] **Step 6: Mostrar la nota en la ficha**

En `app/ojear/Ojeo.js`, reemplazar el bloque `{g.ref.compania && ( <details className="ficha"> ... </details> )}` por:

```jsx
                  {(g.ref.compania || g.ref.razon_claude) && (
                    <details className="ficha">
                      <summary>De qué se trata</summary>
                      {g.ref.razon_claude && <p><b>Nota de Claude:</b> {g.ref.razon_claude}</p>}
                      {g.ref.compania && <p>{g.ref.compania}</p>}
                    </details>
                  )}
```

(El chip tiene `title`, que no se ve en el celular; la nota queda además dentro de la ficha.)

- [ ] **Step 7: Script para escribirlas**

`scripts/razones.mjs`:

```js
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { validarRazones, canonicas } from '../lib/razones.mjs';

// festivales/<slug>.razones.json -> eventos.razones. Se corre después de cargar
// el festival: las razones se escriben contra las obras ya cargadas.

const slug = process.argv[2];
if (!slug) { console.error('Uso: npm run razones -- <slug>'); process.exit(1); }

const lista = JSON.parse(await readFile(new URL(`../festivales/${slug}.razones.json`, import.meta.url), 'utf8'));
const festival = await unaFila('select id from eventos.festivales where slug = $1', [slug]);
if (!festival) { console.error(`No existe el festival ${slug}. Cárgalo primero con npm run cargar.`); process.exit(1); }

const obras = (await sql('select distinct obra from eventos.funciones where festival_id = $1', [festival.id])).map(r => r.obra);
const errores = validarRazones(lista, obras);
if (errores.length) {
  console.error(`festivales/${slug}.razones.json no es válido:`);
  for (const e of errores) console.error('  ' + e);
  process.exit(1);
}

for (const r of canonicas(lista, obras)) {
  await sql(
    `insert into eventos.razones (festival_id, obra, texto) values ($1, $2, $3)
     on conflict (festival_id, obra) do update set texto = excluded.texto, creado = now()`,
    [festival.id, r.obra, r.texto]);
}
console.log(`${lista.length} razones escritas para ${slug}.`);
await poolPg().end();
```

En `package.json` agregar `"razones": "node --env-file=.env.local scripts/razones.mjs",` después de `"fixture"`.

- [ ] **Step 8: Verificar**

```bash
node --check scripts/razones.mjs
npm test 2>&1 | grep -E "^# (pass|fail)"
npm run build 2>&1 | tail -3
```

Expected: 0 fallos; build exitoso. El script no se corre contra la base todavía: no hay ningún `*.razones.json` y las razones se escriben festival por festival, en sesión.

- [ ] **Step 9: Commit**

```bash
git add supabase/014_razones.sql lib/razones.mjs lib/razones.test.mjs scripts/razones.mjs lib/panorama.mjs lib/cliente.mjs lib/datos.mjs lib/interes.mjs lib/interes.test.mjs app/ojear/Ojeo.js package.json
git commit -m "feat: razones por obra escritas por Claude, con su origen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentación y skill

**Files:**
- Modify: `README.md`, `~/.claude/skills/festival-agenda/SKILL.md`, `docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md`

- [ ] **Step 1: README**

En la tabla de «Scripts», agregar después de la fila de `npm run cargar`:

```markdown
| `npm run fixture` | Tu ojeo → `lib/fixtures/ojeo.json` (fuera de git: es tu gusto) |
| `npm run recomendador` | Mide el recomendador contra tu ojeo con validación cruzada y lo imprime |
| `npm run razones -- <slug>` | `festivales/<slug>.razones.json` → razones de Claude por obra |
```

Y, en «Decisiones que conviene no deshacer», debajo de la entrada «Ojear va antes que Decidir…», agregar:

```markdown
- **Cada resaltado dice de dónde sale y cuánto acierta.** Tres orígenes: `dicho` (una regla que Andrés dictó: se queda aunque acierte poco, mostrando su cifra en este festival), `ojeo` (un rasgo donde viene diciendo que sí, p. ej. «El Quijote: 8 de 9») y `claude` (una nota por obra escrita al cargar). Aprender de lo ojeado es `lib/evidencia.mjs`; los umbrales (≥ 5 obras, ≥ 50% de sí, ≥ 1,5 veces la base) se fijaron antes de medir.
- **La medición no se hace sobre lo mismo que se aprendió.** `lib/medida.mjs` hace validación cruzada por obra. En la Fiesta del Libro resalta con ~53% de aciertos contra una base de 25%. Esa cifra incluye descartes en lote de origen desconocido; `funciones.interes_origen` los separa desde ahora, y el test solo exige superar la base cuando hay ≥ 20 sí y ≥ 20 no marcados a mano.
- **Lo que baja de prioridad no desaparece.** Una franja donde casi siempre dices no pasa al final del ojeo; descartar sigue siendo cosa tuya. Esas obras tienen ~12% de sí, la mitad de la base.
- **El ojeo es privado, el repositorio no.** `lib/fixtures/` y `festivales/*.razones.json` están en `.gitignore`.
```

- [ ] **Step 2: Skill `festival-agenda`**

En `~/.claude/skills/festival-agenda/SKILL.md`, justo antes de la línea `### El perfil del usuario`, insertar:

````markdown
### Si el festival va al Organizador de Eventos (razones)

La app ya resalta por tres vías: las reglas que Andrés dictó, lo que aprende de su
ojeo (franjas, técnicas, salas donde dice que sí) y las notas que escribes tú.
Tu parte es la tercera, y solo donde las otras no alcanzan:

1. Tras `npm run cargar`, lee su perfil (`obsidian-andres`) y las obras del festival.
2. Para las obras que de verdad encajan y que ninguna regla va a resaltar, escribe
   `festivales/<slug>.razones.json`: `[{ "obra": "…", "texto": "…" }]`.
3. Cada texto: una frase (máx. 280 caracteres) que diga **qué parte del perfil** lo
   justifica. «Quijote con percusión: teatro físico con hilo narrativo, tu punto
   medio». Sin perfil que lo respalde, no se escribe: una razón sin fuente no se
   puede corregir.
4. `npm run razones -- <slug>`. El archivo no va a git (es su gusto y el repo es público).

Después de que Andrés ojee, `npm run recomendador` dice si acertaron.
````

(Si `### El perfil del usuario` no existe con ese texto exacto, ubicar el encabezado equivalente del paso 5 y avisar.)

- [ ] **Step 3: Nota en el spec**

Al final de la sección «## 2. Recomendador con evidencia» del spec, agregar:

```markdown
### Lo que cambió al implementarlo (3 nov 2026)

- La evidencia `ojeo` se aprende solo del festival en curso, no entre festivales.
- Las razones `claude` van por obra (`eventos.razones (festival_id, obra, texto)`), no por función.
- Se agregó `funciones.interes_origen` (`manual` | `lote` | NULL). El descarte en lote («Descartar las N sin resaltar») contaminaba la verdad con «no» que no eran juicios.
- La compuerta del test solo se exige con marcas manuales conocidas (≥ 20 sí y ≥ 20 no). Hoy no hay ninguna, así que la medición se imprime sin exigirse.
- Migraciones: `013_interes_origen`, `014_razones`. Bitácora y Calendar pasan a `015` y `016`.
```

- [ ] **Step 4: Verificar y commit**

```bash
npm test 2>&1 | grep -E "^# (pass|fail)"
grep -n "Si el festival va al Organizador de Eventos (razones)" ~/.claude/skills/festival-agenda/SKILL.md
git add README.md docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md
git commit -m "docs: el recomendador con evidencia y cómo se mide

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

La skill no está en git: el cambio queda en el archivo.

---

## Terminado cuando

- `npm test` pasa, con el test del recomendador saltándose en CI (sin fixture) y corriendo localmente.
- `npm run recomendador` imprime, por festival, base, precisión, recall y tasa de lo que baja, en tres vistas (todas las marcas, sin lote, solo manuales).
- Ojear muestra chips con origen y cifras («El Quijote: 8 de 9»), ordena lo que sube primero y lo que baja al final, y «Descartar las N sin resaltar» respeta lo aprendido.
- Las marcas nuevas guardan su origen; las anteriores quedan como desconocidas.
- `npm run build` funciona y `lib/fixtures/` no aparece en `git status`.
