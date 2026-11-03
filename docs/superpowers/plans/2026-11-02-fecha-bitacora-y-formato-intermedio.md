# Fecha de la bitácora y formato intermedio — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la fecha UTC de la bitácora y reemplazar los cinco cargadores por festival con un JSON por festival, validado, que se carga con un solo comando sin cambiar nada de la base actual.

**Architecture:** Subproyectos 0 y 1 de `docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md`. La lógica pura vive en `lib/` con tests `node --test` (`legado.mjs` separa y recompone las columnas heredadas, `formato.mjs` valida, `carga.mjs` calcula el diff). Los scripts en `scripts/` solo hablan con la base: `exportar-festival.mjs` (base → JSON), `cargar.mjs` (JSON → base, en una transacción, con `--seco`), `archivar-fuente.mjs` (markdown → bucket).

**Tech Stack:** Node 22 ESM, `node:test`, `pg` por `scripts/_pg.mjs` (`conectar()`), `@supabase/supabase-js` para Storage por `almacen()` de `lib/db.mjs`. Postgres de Supabase, schema `eventos`.

**Antes de empezar:**
- Rama `reescritura-profunda` (ya existe, con el spec).
- `.env.local` tiene `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `npm test` da 96 pass. Debe seguir dando eso más los tests nuevos al final de cada tarea.
- Los comandos son para Git Bash en Windows.

---

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `supabase/011_bitacora_bogota.sql` | Crear. Default de `fecha` en hora de Bogotá y corrección de filas |
| `supabase/012_campos_ficha.sql` | Crear. Columnas `descripcion`, `franjas`, `publico` |
| `lib/legado.mjs` + `.test.mjs` | Crear. `separar(tipo, fila)` y `recomponer(f)` para `compania` y `nota_boleteria` |
| `lib/formato.mjs` + `.test.mjs` | Crear. `validar(json)`, `llaveFuncion(f)`, `aMinutos`, `aHora` |
| `lib/carga.mjs` + `.test.mjs` | Crear. `aFila`, `planificar`, `cambiosCatalogo` |
| `scripts/exportar-festival.mjs` | Crear. Base → `festivales/{slug}.json`, aborta si la separación pierde algo |
| `scripts/archivar-fuente.mjs` | Crear. Sube un `.md` al bucket y lo anota en `fuentes` del JSON |
| `scripts/cargar.mjs` | Crear. JSON → base, `--seco` imprime el diff y no escribe |
| `festivales/*.json` | Crear (generados). Los tres festivales |
| `package.json` | Modificar. Scripts `exportar`, `cargar`, `fuente`; quitar `programacion`, `fiesta-libro`, `san-ignacio` |
| `scripts/cargar-*.mjs`, `scripts/datos-*.mjs`, `scripts/tipos-san-ignacio.mjs` | Borrar, después de la equivalencia |
| `scripts/seed.mjs` | Modificar. Solo la nota de histórico arriba |
| `README.md`, `scripts/extraccion/LEEME.md` | Modificar |
| `~/.claude/skills/festival-agenda/SKILL.md` | Modificar, con copia de respaldo |

---

### Task 1: Fecha de la bitácora en hora de Bogotá

**Files:**
- Create: `supabase/011_bitacora_bogota.sql`

- [ ] **Step 1: Comprobar el bug antes de tocar nada**

```bash
cd "D:/ANDRES/Claude_Projects/Organizador_Eventos"
node --env-file=.env.local --input-type=module -e "
import { sql, poolPg } from './scripts/_cliente.mjs';
console.log(await sql(\`select count(*) as malas from eventos.bitacora
  where fecha <> (creado at time zone 'America/Bogota')::date\`));
await poolPg().end();"
```

Expected: `[ { malas: '2' } ]` (Mohammed y Winnipeg).

- [ ] **Step 2: Escribir la migración**

`supabase/011_bitacora_bogota.sql`:

```sql
-- La fecha de un juicio es el día en Medellín, no en UTC. Con current_date el
-- servidor (UTC) fechaba como "mañana" todo juicio guardado después de las 7 p.m.
-- Pasó el 2 nov 2026: Mohammed y Winnipeg quedaron con fecha 3 nov.

alter table eventos.bitacora
  alter column fecha set default ((now() at time zone 'America/Bogota')::date);

-- Idempotente: solo toca filas cuya fecha no coincide con su día en Bogotá.
update eventos.bitacora
   set fecha = (creado at time zone 'America/Bogota')::date
 where fecha <> (creado at time zone 'America/Bogota')::date;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: Aplicar**

Run: `npm run migrar`
Expected: lista de `001_…` a `011_bitacora_bogota.sql` y `Migraciones aplicadas.`

- [ ] **Step 4: Verificar el default y las filas**

```bash
node --env-file=.env.local --input-type=module -e "
import { sql, poolPg } from './scripts/_cliente.mjs';
console.log(await sql(\`select count(*) as malas from eventos.bitacora
  where fecha <> (creado at time zone 'America/Bogota')::date\`));
console.log(await sql(\`select column_default from information_schema.columns
  where table_schema='eventos' and table_name='bitacora' and column_name='fecha'\`));
console.log(await sql(\`select ((timestamptz '2026-11-03T02:00:00Z') at time zone 'America/Bogota')::date::text as nueve_pm\`));
await poolPg().end();"
```

Expected: `malas: '0'`; `column_default` contiene `America/Bogota`; `nueve_pm: '2026-11-02'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/011_bitacora_bogota.sql
git commit -m "fix: la fecha de la bitácora es el día en Medellín, no en UTC"
```

---

### Task 2: Skill festival-agenda produce el formato 1

La skill vive fuera del repo y sin git: primero la copia.

**Files:**
- Modify: `~/.claude/skills/festival-agenda/SKILL.md` (sección «Paso 2 — Estructura de datos»)

- [ ] **Step 1: Respaldo**

```bash
cp -r ~/.claude/skills/festival-agenda ~/.claude/skills/festival-agenda.bak-2026-11-02
ls ~/.claude/skills/festival-agenda.bak-2026-11-02
```

Expected: `SKILL.md  assets  references`.

- [ ] **Step 2: Agregar la salida al Organizador**

En `~/.claude/skills/festival-agenda/SKILL.md`, justo antes de la línea `### Duración: el dato que nunca está`, insertar:

````markdown
### Si el festival va al Organizador de Eventos

Cuando el usuario es Andrés y el festival se va a cargar en la app
(`D:\ANDRES\Claude_Projects\Organizador_Eventos`), la salida del paso 2 no es el
objeto de arriba sino `festivales/{slug}.json` en **formato 1**. El esquema y
sus reglas están en `docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md`,
sección «1. Formato intermedio». Lo esencial:

- Solo lo que publica el organizador. Nada de interés, agenda ni boletas.
- `hora` como `"HH:MM"` en 24 h. `duracion: { min, confirmada }`.
- `precio: { pleno, dcto, libre }`: `pleno: null` es «no publicado»;
  `libre: true` es entrada libre. Nunca `pleno: 0` sin `libre: true`.
- `descripcion`, `franjas` (lista), `publico` y `nota` van separados; no se
  pegan a `compania`.
- `fuentes`: el markdown de la fuente se archiva con
  `npm run fuente -- <slug> <archivo.md> <metodo> <url> <AAAA-MM-DD>`, que lo
  sube al bucket y lo anota en el JSON. `metodo` es `markitdown`, `defuddle` o
  `imagen` (cuando el texto extraído se contamina por columnas y la
  transcripción se hizo leyendo las páginas como imagen).

Después:

```bash
npm run cargar -- <slug> --seco   # valida y muestra el diff, no escribe
npm run cargar -- <slug>          # escribe
```

Si el validador rechaza el archivo, se corrige el JSON, no el validador.
````

- [ ] **Step 3: Verificar que quedó en su sitio**

Run: `grep -n "Si el festival va al Organizador\|### Duración: el dato" ~/.claude/skills/festival-agenda/SKILL.md`
Expected: dos líneas, la del Organizador antes que la de Duración.

No hay commit: la skill no está en git. El respaldo es la copia del Step 1.

---

### Task 3: `lib/legado.mjs` — separar y recomponer las columnas heredadas

Hoy `funciones.compania` lleva «compañía · descripción» (San Ignacio) o solo la descripción (Fiesta del Libro), y `nota_boleteria` lleva franjas y público pegados. Este módulo separa y recompone con **una sola regla de recomposición** para los tres festivales.

**Files:**
- Create: `lib/legado.mjs`
- Test: `lib/legado.test.mjs`

- [ ] **Step 1: Escribir los tests**

`lib/legado.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separar, recomponer } from './legado.mjs';

const ida = (tipo, fila) => recomponer(separar(tipo, fila));

test('artes: no se separa nada, aunque la compañía traiga " · "', () => {
  const fila = { compania: 'Evento especial · INCOLBALLET (Cali)', nota_boleteria: 'Entrada libre con Eticketa Blanca.' };
  const s = separar('artes', fila);
  assert.equal(s.compania, 'Evento especial · INCOLBALLET (Cali)');
  assert.equal(s.descripcion, null);
  assert.deepEqual(s.franjas, []);
  assert.equal(s.publico, null);
  assert.deepEqual(ida('artes', fila), fila);
});

test('artes: nulos se quedan nulos', () => {
  const fila = { compania: null, nota_boleteria: null };
  assert.deepEqual(ida('artes', fila), fila);
});

test('san ignacio: compañía y descripción se parten en el primer " · "', () => {
  const fila = {
    compania: 'Comfama (Colombia) · Inspirada en el clásico de Lyman Frank Baum, esta es una historia.',
    nota_boleteria: '+ 5 años · Boletería por confirmar (tarifas Comfama)',
  };
  const s = separar('san-ignacio', fila);
  assert.equal(s.compania, 'Comfama (Colombia)');
  assert.equal(s.descripcion, 'Inspirada en el clásico de Lyman Frank Baum, esta es una historia.');
  assert.equal(s.publico, '+ 5 años');
  assert.equal(s.nota, 'Boletería por confirmar (tarifas Comfama)');
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('san ignacio: la académica no trae público ni descripción', () => {
  const fila = { compania: 'Dirigido a actores y directores', nota_boleteria: 'Entrada libre con inscripción previa' };
  const s = separar('san-ignacio', fila);
  assert.equal(s.publico, null);
  assert.equal(s.descripcion, null);
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('san ignacio: "Familiar" también es público', () => {
  const fila = { compania: 'X (Chile)', nota_boleteria: 'Familiar · Entrada libre' };
  assert.equal(separar('san-ignacio', fila).publico, 'Familiar');
  assert.deepEqual(ida('san-ignacio', fila), fila);
});

test('libro: compania es la descripción y la nota trae franjas antes de los sufijos', () => {
  const fila = {
    compania: 'Cómo la ficción contemporánea narra el desplazamiento.',
    nota_boleteria: 'El Quijote · Universidad de Antioquia · Con intérprete de Lengua de Señas Colombiana · Entrada libre',
  };
  const s = separar('libro', fila);
  assert.equal(s.compania, null);
  assert.equal(s.descripcion, 'Cómo la ficción contemporánea narra el desplazamiento.');
  assert.deepEqual(s.franjas, ['El Quijote', 'Universidad de Antioquia']);
  assert.equal(s.nota, 'Con intérprete de Lengua de Señas Colombiana · Entrada libre');
  assert.deepEqual(ida('libro', fila), fila);
});

test('libro: una franja con coma adentro es una sola franja', () => {
  const fila = { compania: null, nota_boleteria: 'El Quijote,Universidad de Antioquia · Entrada libre' };
  assert.deepEqual(separar('libro', fila).franjas, ['El Quijote,Universidad de Antioquia']);
  assert.deepEqual(ida('libro', fila), fila);
});

test('recomponer recorta compania a 900 como el cargador viejo', () => {
  const r = recomponer({ compania: 'A', descripcion: 'x'.repeat(1000), franjas: [], publico: null, nota: null });
  assert.equal(r.compania.length, 900);
});

test('tipo desconocido es un error, no un silencio', () => {
  assert.throws(() => separar('otro', { compania: null, nota_boleteria: null }), /tipo de legado/);
});
```

- [ ] **Step 2: Ver que fallan**

Run: `node --test lib/legado.test.mjs`
Expected: FAIL, `Cannot find module` … `legado.mjs`.

- [ ] **Step 3: Implementar**

`lib/legado.mjs`:

```js
// Columnas heredadas de los cargadores viejos.
//
// Antes del formato 1 cada cargador pegaba campos distintos en las mismas dos
// columnas: San Ignacio guardaba «compañía · descripción» en `compania`, la
// Fiesta del Libro guardaba solo la descripción ahí, y las franjas y el público
// iban dentro de `nota_boleteria`. Separar depende del festival; recomponer
// es una sola regla para todos.
//
// shortcut: las pantallas todavía leen `compania` y `nota_boleteria`, por eso
// el cargador las recompone. En el subproyecto 2 pasan a leer las columnas
// nuevas y este módulo se borra.

const SEP = ' · ';
const PUBLICO = /^(\+ ?\d+ años|Familiar)$/;
const SUFIJO_LIBRO = /^(Entrada libre|Con intérprete de Lengua de Señas Colombiana)$/;

export const TIPO_LEGADO = {
  'fiesta-artes-escenicas-22-2026': 'artes',
  'fiesta-libro-cultura-20-2026': 'libro',
  'festival-teatro-san-ignacio-2026': 'san-ignacio',
};

const partes = s => (s ? s.split(SEP) : []);
const unir = xs => xs.filter(Boolean).join(SEP) || null;

/** Columnas heredadas a partir de los campos del formato 1. */
export function recomponer(f) {
  return {
    compania: unir([f.compania, f.descripcion])?.slice(0, 900) ?? null,
    nota_boleteria: unir([...(f.franjas ?? []), f.publico, f.nota]),
  };
}

/** Campos del formato 1 a partir de las columnas heredadas de una fila. */
export function separar(tipo, fila) {
  const base = { compania: fila.compania ?? null, descripcion: null, franjas: [], publico: null, nota: fila.nota_boleteria ?? null };

  if (tipo === 'artes') return base;

  if (tipo === 'san-ignacio') {
    const c = fila.compania ?? '';
    const i = c.indexOf(SEP);
    const p = partes(fila.nota_boleteria);
    const publico = PUBLICO.test(p[0] ?? '') ? p.shift() : null;
    return {
      ...base,
      compania: i < 0 ? (fila.compania ?? null) : c.slice(0, i),
      descripcion: i < 0 ? null : c.slice(i + SEP.length),
      publico,
      nota: unir(p),
    };
  }

  if (tipo === 'libro') {
    const p = partes(fila.nota_boleteria);
    return {
      ...base,
      compania: null,
      descripcion: fila.compania ?? null,
      franjas: p.filter(x => !SUFIJO_LIBRO.test(x)),
      nota: unir(p.filter(x => SUFIJO_LIBRO.test(x))),
    };
  }

  throw new Error(`tipo de legado desconocido: ${tipo}`);
}
```

- [ ] **Step 4: Ver que pasan**

Run: `node --test lib/legado.test.mjs`
Expected: 9 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/legado.mjs lib/legado.test.mjs
git commit -m "feat: separar y recomponer las columnas heredadas de compania y nota"
```

---

### Task 4: `lib/formato.mjs` — validador del formato 1

**Files:**
- Create: `lib/formato.mjs`
- Test: `lib/formato.test.mjs`

- [ ] **Step 1: Escribir los tests**

`lib/formato.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, llaveFuncion, aMinutos, aHora } from './formato.mjs';

function valido() {
  return {
    formato: 1,
    festival: { slug: 'f-2026', nombre: 'F', ciudad: 'Medellín', fecha_inicio: '2026-11-01', fecha_fin: '2026-11-03' },
    fuentes: [{ key: 'fuentes/f-2026/2026-10-20_a1b2c3d4.md', url: 'https://x.co', bajada: '2026-10-20', metodo: 'defuddle' }],
    salas: [
      { slug: 'sala-a', nombre: 'Sala A', direccion: null, telefono: null, zona: 'centro' },
      { slug: 'sala-b', nombre: 'Sala B', direccion: null, telefono: null, zona: 'norte' },
    ],
    traslados: [
      { zona_a: 'centro', zona_b: 'centro', minutos: 12 }, { zona_a: 'centro', zona_b: 'norte', minutos: 25 },
      { zona_a: 'norte', zona_b: 'centro', minutos: 25 }, { zona_a: 'norte', zona_b: 'norte', minutos: 15 },
    ],
    funciones: [{
      obra: 'Petra', compania: 'Ambidiestro', descripcion: null, franjas: [], tipos: null,
      publico: null, nota: null, fuente_horario: 'volante',
      fecha: '2026-11-01', hora: '20:00', sala: 'sala-a',
      duracion: { min: 80, confirmada: false },
      precio: { pleno: 35000, dcto: null, libre: false },
      url_compra: null, imagen: null,
    }],
  };
}
const errores = j => validar(j).join('\n');

test('un archivo válido no tiene errores', () => assert.deepEqual(validar(valido()), []));

test('formato distinto de 1', () => {
  const j = valido(); j.formato = 2;
  assert.match(errores(j), /formato/);
});

test('falta un campo del festival', () => {
  const j = valido(); delete j.festival.nombre;
  assert.match(errores(j), /festival\.nombre/);
});

test('sin fuentes o con método desconocido', () => {
  const j = valido(); j.fuentes = [];
  assert.match(errores(j), /fuentes/);
  const k = valido(); k.fuentes[0].metodo = 'ocr';
  assert.match(errores(k), /metodo/);
});

test('fecha fuera del festival', () => {
  const j = valido(); j.funciones[0].fecha = '2026-11-04';
  assert.match(errores(j), /fuera del festival/);
});

test('hora mal escrita', () => {
  const j = valido(); j.funciones[0].hora = '8:00';
  assert.match(errores(j), /hora/);
});

test('sala no declarada', () => {
  const j = valido(); j.funciones[0].sala = 'sala-z';
  assert.match(errores(j), /sala-z/);
});

test('par de zonas sin traslado', () => {
  const j = valido(); j.traslados = j.traslados.filter(t => !(t.zona_a === 'norte' && t.zona_b === 'centro'));
  assert.match(errores(j), /traslado norte → centro/);
});

test('dos títulos que solo difieren en mayúsculas o tildes', () => {
  const j = valido();
  j.funciones.push({ ...j.funciones[0], obra: 'PETRA', fecha: '2026-11-02' });
  assert.match(errores(j), /Petra.*PETRA|PETRA.*Petra/);
});

test('precio 0 sin libre', () => {
  const j = valido(); j.funciones[0].precio = { pleno: 0, dcto: null, libre: false };
  assert.match(errores(j), /libre/);
});

test('libre con pleno distinto de 0 o null', () => {
  const j = valido(); j.funciones[0].precio = { pleno: 35000, dcto: null, libre: true };
  assert.match(errores(j), /libre/);
});

test('duración no positiva', () => {
  const j = valido(); j.funciones[0].duracion.min = 0;
  assert.match(errores(j), /duracion/);
});

test('llave repetida', () => {
  const j = valido(); j.funciones.push({ ...j.funciones[0] });
  assert.match(errores(j), /repetida/);
});

test('llave: ignora mayúsculas, tildes y compañía entre paréntesis al final', () => {
  const a = { fecha: '2026-11-01', hora: '20:00', sala: 'sala-a', obra: 'Petrá (Bogotá)' };
  const b = { ...a, obra: 'petra' };
  assert.equal(llaveFuncion(a), llaveFuncion(b));
});

test('horas: ida y vuelta', () => {
  assert.equal(aMinutos('19:30'), 1170);
  assert.equal(aHora(1170), '19:30');
  assert.equal(aHora(630), '10:30');
});
```

- [ ] **Step 2: Ver que fallan**

Run: `node --test lib/formato.test.mjs`
Expected: FAIL, `Cannot find module` … `formato.mjs`.

- [ ] **Step 3: Implementar**

`lib/formato.mjs`:

```js
import { tituloNormalizado } from './nombres.mjs';

// Formato 1: un festival tal como lo publica el organizador. Esquema y razones
// en docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md.
//
// validar() devuelve la lista completa de errores, no el primero: al corregir
// un JSON de 776 funciones, arreglar de a un error por corrida es un castigo.

export const FORMATO = 1;
export const METODOS = ['markitdown', 'defuddle', 'imagen'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const aMinutos = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const aHora = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Identidad de una función entre recargas: no cambia si cambia el precio o la nota. */
export function llaveFuncion(f) {
  return `${f.fecha}|${f.hora}|${f.sala}|${tituloNormalizado(f.obra)}`;
}

export function validar(j) {
  const e = [];
  if (j?.formato !== FORMATO) e.push(`formato debe ser ${FORMATO}`);

  const fe = j?.festival ?? {};
  for (const k of ['slug', 'nombre', 'ciudad', 'fecha_inicio', 'fecha_fin']) {
    if (!fe[k]) e.push(`festival.${k} falta`);
  }
  for (const k of ['fecha_inicio', 'fecha_fin']) {
    if (fe[k] && !FECHA.test(fe[k])) e.push(`festival.${k} no es AAAA-MM-DD`);
  }

  if (!Array.isArray(j?.fuentes) || !j.fuentes.length) e.push('fuentes: hace falta al menos una');
  for (const [i, f] of (j?.fuentes ?? []).entries()) {
    if (!f.key) e.push(`fuentes[${i}].key falta`);
    if (!METODOS.includes(f.metodo)) e.push(`fuentes[${i}].metodo debe ser uno de ${METODOS.join(', ')}`);
  }

  const salas = new Map((j?.salas ?? []).map(s => [s.slug, s]));
  for (const s of j?.salas ?? []) {
    if (!s.slug || !s.nombre || !s.zona) e.push(`sala ${s.slug ?? '?'}: slug, nombre y zona son obligatorios`);
  }

  const zonas = [...new Set([...salas.values()].map(s => s.zona))];
  const hay = new Set((j?.traslados ?? []).map(t => `${t.zona_a}|${t.zona_b}`));
  for (const a of zonas) for (const b of zonas) {
    if (!hay.has(`${a}|${b}`)) e.push(`falta traslado ${a} → ${b}`);
  }

  const llaves = new Set();
  const titulos = new Map();
  for (const [i, f] of (j?.funciones ?? []).entries()) {
    const donde = `funciones[${i}] «${f.obra ?? '?'}»`;
    if (!f.obra) e.push(`${donde}: obra falta`);
    if (!FECHA.test(f.fecha ?? '')) e.push(`${donde}: fecha no es AAAA-MM-DD`);
    else if (fe.fecha_inicio && (f.fecha < fe.fecha_inicio || f.fecha > fe.fecha_fin)) {
      e.push(`${donde}: ${f.fecha} queda fuera del festival`);
    }
    if (!HORA.test(f.hora ?? '')) e.push(`${donde}: hora debe ser HH:MM en 24 h`);
    if (!salas.has(f.sala)) e.push(`${donde}: sala ${f.sala} no está declarada`);
    if (!Number.isInteger(f.duracion?.min) || f.duracion.min <= 0) e.push(`${donde}: duracion.min debe ser entero positivo`);
    if (typeof f.duracion?.confirmada !== 'boolean') e.push(`${donde}: duracion.confirmada debe ser booleano`);
    if (!f.fuente_horario) e.push(`${donde}: fuente_horario falta`);

    const p = f.precio ?? {};
    if (p.pleno === 0 && p.libre !== true) e.push(`${donde}: pleno 0 exige libre: true`);
    if (p.libre === true && p.pleno != null && p.pleno !== 0) e.push(`${donde}: libre con pleno ${p.pleno}`);

    const k = llaveFuncion(f);
    if (llaves.has(k)) e.push(`${donde}: llave repetida ${k}`);
    llaves.add(k);

    if (f.obra) {
      const n = tituloNormalizado(f.obra);
      if (!titulos.has(n)) titulos.set(n, new Set());
      titulos.get(n).add(f.obra);
    }
  }
  for (const formas of titulos.values()) {
    if (formas.size > 1) e.push(`mismo título escrito distinto: ${[...formas].join(' / ')}`);
  }
  return e;
}
```

- [ ] **Step 4: Ver que pasan**

Run: `node --test lib/formato.test.mjs`
Expected: 15 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/formato.mjs lib/formato.test.mjs
git commit -m "feat: validador del formato 1 de festival"
```

---

### Task 5: `lib/carga.mjs` — de JSON a filas y diff contra la base

**Files:**
- Create: `lib/carga.mjs`
- Test: `lib/carga.test.mjs`

- [ ] **Step 1: Escribir los tests**

`lib/carga.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aFila, planificar, cambiosCatalogo } from './carga.mjs';

const salaId = { 'sala-a': 'uuid-a' };
const fn = (extra = {}) => ({
  obra: 'Petra', compania: 'Ambidiestro', descripcion: 'Gesto y danza', franjas: [], tipos: ['Danza-teatro'],
  publico: '+14 años', nota: 'Descuentos Comfama', fuente_horario: 'volante',
  fecha: '2026-11-01', hora: '20:00', sala: 'sala-a',
  duracion: { min: 80, confirmada: false },
  precio: { pleno: 35000, dcto: 10900, libre: false },
  url_compra: null, imagen: null, ...extra,
});
const json = funciones => ({ funciones });
// Una fila de la base tal como la devuelve la consulta de cargar.mjs.
const fila = (extra = {}) => ({ id: 'f1', sala_slug: 'sala-a', ...aFila(fn(), salaId), ...extra });

test('aFila recompone las columnas heredadas y llena las nuevas', () => {
  const r = aFila(fn(), salaId);
  assert.equal(r.compania, 'Ambidiestro · Gesto y danza');
  assert.equal(r.nota_boleteria, '+14 años · Descuentos Comfama');
  assert.equal(r.descripcion, 'Gesto y danza');
  assert.equal(r.publico, '+14 años');
  assert.equal(r.hora_min, 1200);
  assert.equal(r.sala_id, 'uuid-a');
});

test('aFila: libre es precio 0, franjas vacías son null', () => {
  const r = aFila(fn({ precio: { pleno: 0, dcto: null, libre: true } }), salaId);
  assert.equal(r.precio_pleno, 0);
  assert.equal(r.franjas, null);
});

test('sin cambios no hay nada que hacer', () => {
  const p = planificar(json([fn()]), [fila()], salaId);
  assert.deepEqual(p, { insertar: [], actualizar: [], retirar: [], avisar: [] });
});

test('un cambio de precio se reporta campo por campo', () => {
  const p = planificar(json([fn({ precio: { pleno: 40000, dcto: 10900, libre: false } })]), [fila()], salaId);
  assert.equal(p.actualizar.length, 1);
  assert.deepEqual(p.actualizar[0].cambios, { precio_pleno: { antes: 35000, despues: 40000 } });
});

test('la misma obra con otra mayúscula es la misma función', () => {
  const p = planificar(json([fn({ obra: 'PETRA' })]), [fila()], salaId);
  assert.equal(p.insertar.length, 0);
  assert.deepEqual(Object.keys(p.actualizar[0].cambios), ['obra']);
});

test('función nueva se inserta', () => {
  const p = planificar(json([fn(), fn({ hora: '22:00' })]), [fila()], salaId);
  assert.equal(p.insertar.length, 1);
  assert.equal(p.insertar[0].hora_min, 1320);
});

test('retirada sin datos del usuario se borra; con datos, se avisa', () => {
  const otra = fila({ id: 'f2', hora_min: 1320 });
  const usada = fila({ id: 'f3', hora_min: 900 });
  const p = planificar(json([fn()]), [fila(), otra, usada], salaId, new Set(['f3']));
  assert.deepEqual(p.retirar.map(r => r.id), ['f2']);
  assert.deepEqual(p.avisar.map(r => r.id), ['f3']);
});

test('dos filas de la base con la misma llave es un error', () => {
  assert.throws(() => planificar(json([fn()]), [fila(), fila({ id: 'f9', obra: 'PETRA' })], salaId), /misma llave/);
});

test('arreglos y nulos se comparan por valor', () => {
  const p = planificar(json([fn({ tipos: ['Danza-teatro'] })]), [fila({ tipos: ['Danza-teatro'] })], salaId);
  assert.equal(p.actualizar.length, 0);
});

test('cambiosCatalogo detecta sala y traslado distintos', () => {
  const j = {
    salas: [{ slug: 'sala-a', nombre: 'Sala A', direccion: 'Cra 1', telefono: null, zona: 'centro' }],
    traslados: [{ zona_a: 'centro', zona_b: 'centro', minutos: 12 }],
  };
  const c = cambiosCatalogo(j,
    [{ slug: 'sala-a', nombre: 'Sala A', direccion: 'Cra 2', telefono: null, zona: 'centro' }],
    [{ zona_a: 'centro', zona_b: 'centro', minutos: 10 }]);
  assert.deepEqual(c, ['sala sala-a: direccion "Cra 2" → "Cra 1"', 'traslado centro → centro: 10 → 12']);
});
```

- [ ] **Step 2: Ver que fallan**

Run: `node --test lib/carga.test.mjs`
Expected: FAIL, `Cannot find module` … `carga.mjs`.

- [ ] **Step 3: Implementar**

`lib/carga.mjs`:

```js
import { recomponer } from './legado.mjs';
import { aMinutos, aHora, llaveFuncion } from './formato.mjs';

// Del formato 1 a filas de eventos.funciones, y qué cambiaría al cargar.
// Puro: cargar.mjs pone la base, aquí solo se compara.

/** Columnas de catálogo: lo que publica el organizador. Lo del usuario no está. */
export const COLUMNAS = [
  'sala_id', 'fecha', 'hora_min', 'duracion_min', 'duracion_confirmada', 'obra',
  'compania', 'descripcion', 'franjas', 'publico', 'precio_pleno', 'precio_dcto',
  'nota_boleteria', 'fuente_horario', 'imagen_key', 'imagen_credito', 'tipos', 'url_compra',
];

export function aFila(f, salaId) {
  const legado = recomponer(f);
  return {
    sala_id: salaId[f.sala] ?? null,
    fecha: f.fecha,
    hora_min: aMinutos(f.hora),
    duracion_min: f.duracion.min,
    duracion_confirmada: f.duracion.confirmada,
    obra: f.obra,
    compania: legado.compania,
    descripcion: f.descripcion ?? null,
    franjas: f.franjas?.length ? f.franjas : null,
    publico: f.publico ?? null,
    precio_pleno: f.precio.libre ? 0 : f.precio.pleno,
    precio_dcto: f.precio.dcto ?? null,
    nota_boleteria: legado.nota_boleteria,
    fuente_horario: f.fuente_horario,
    imagen_key: f.imagen?.key ?? null,
    imagen_credito: f.imagen?.credito ?? null,
    tipos: f.tipos ?? null,
    url_compra: f.url_compra ?? null,
  };
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const llaveDeFila = r => llaveFuncion({ fecha: r.fecha, hora: aHora(r.hora_min), sala: r.sala_slug, obra: r.obra });

/**
 * @param json        festival en formato 1, ya validado
 * @param actuales    filas de la base: columnas de COLUMNAS más id y sala_slug, fecha como texto
 * @param salaId      { slug: uuid }
 * @param conUsuario  ids con algo del usuario (agenda, interés, boleta, juicio, estado de compra)
 */
export function planificar(json, actuales, salaId, conUsuario = new Set()) {
  const porLlave = new Map();
  for (const a of actuales) {
    const k = llaveDeFila(a);
    if (porLlave.has(k)) throw new Error(`dos funciones de la base con la misma llave: ${k}`);
    porLlave.set(k, a);
  }

  const insertar = [], actualizar = [], retirar = [], avisar = [];
  const vistas = new Set();
  for (const f of json.funciones) {
    const k = llaveFuncion(f);
    vistas.add(k);
    const nueva = aFila(f, salaId);
    const previa = porLlave.get(k);
    if (!previa) { insertar.push(nueva); continue; }
    const cambios = {};
    for (const c of COLUMNAS) {
      if (!igual(previa[c], nueva[c])) cambios[c] = { antes: previa[c] ?? null, despues: nueva[c] };
    }
    if (Object.keys(cambios).length) actualizar.push({ id: previa.id, llave: k, cambios });
  }
  for (const [k, a] of porLlave) {
    if (!vistas.has(k)) (conUsuario.has(a.id) ? avisar : retirar).push({ id: a.id, llave: k });
  }
  return { insertar, actualizar, retirar, avisar };
}

/** Diferencias de salas y traslados, como frases. Vacío = nada cambia. */
export function cambiosCatalogo(json, salasActuales, trasladosActuales) {
  const out = [];
  const salas = new Map(salasActuales.map(s => [s.slug, s]));
  for (const s of json.salas) {
    const a = salas.get(s.slug);
    if (!a) { out.push(`sala ${s.slug}: nueva`); continue; }
    for (const c of ['nombre', 'direccion', 'telefono', 'zona']) {
      if (!igual(a[c], s[c])) out.push(`sala ${s.slug}: ${c} ${JSON.stringify(a[c] ?? null)} → ${JSON.stringify(s[c] ?? null)}`);
    }
  }
  const tras = new Map(trasladosActuales.map(t => [`${t.zona_a}|${t.zona_b}`, t.minutos]));
  for (const t of json.traslados) {
    const a = tras.get(`${t.zona_a}|${t.zona_b}`);
    if (a == null) out.push(`traslado ${t.zona_a} → ${t.zona_b}: nuevo`);
    else if (a !== t.minutos) out.push(`traslado ${t.zona_a} → ${t.zona_b}: ${a} → ${t.minutos}`);
  }
  return out;
}
```

- [ ] **Step 4: Ver que pasan**

Run: `node --test lib/carga.test.mjs`
Expected: 10 pass, 0 fail.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: 96 + 9 + 15 + 10 = 130 pass, 0 fail.

- [ ] **Step 6: Commit**

```bash
git add lib/carga.mjs lib/carga.test.mjs
git commit -m "feat: de formato 1 a filas y diff contra la base"
```

---

### Task 6: Columnas nuevas de la ficha

**Files:**
- Create: `supabase/012_campos_ficha.sql`

- [ ] **Step 1: Escribir la migración**

`supabase/012_campos_ficha.sql`:

```sql
-- Campos de la ficha que antes iban pegados dentro de compania y nota_boleteria.
-- Las columnas viejas se siguen llenando (recompuestas) hasta que las pantallas
-- lean estas; ver lib/legado.mjs.

alter table eventos.funciones add column if not exists descripcion text;
alter table eventos.funciones add column if not exists franjas text[];
alter table eventos.funciones add column if not exists publico text;

comment on column eventos.funciones.franjas is
  'Franjas de programación del organizador. Un evento puede estar en varias.';

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar**

Run: `npm run migrar`
Expected: termina en `012_campos_ficha.sql` y `Migraciones aplicadas.`; `funciones` sube de 21 a 24 columnas.

- [ ] **Step 3: Commit**

```bash
git add supabase/012_campos_ficha.sql
git commit -m "feat: columnas descripcion, franjas y publico en funciones"
```

---

### Task 7: Exportar un festival de la base al formato 1

**Files:**
- Create: `scripts/exportar-festival.mjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Escribir el script**

`scripts/exportar-festival.mjs`:

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import process from 'node:process';
import { sql, unaFila, poolPg } from './_cliente.mjs';
import { separar, recomponer, TIPO_LEGADO } from '../lib/legado.mjs';
import { aHora, validar } from '../lib/formato.mjs';

// Base -> festivales/{slug}.json.
//
// La prueba que importa está aquí: cada fila se separa en los campos nuevos y
// se vuelve a recomponer. Si una sola no da exactamente lo que había, se aborta
// sin escribir: la separación estaría perdiendo información.
//
// Las fuentes ya archivadas en el JSON anterior se conservan.

const slug = process.argv[2];
const tipo = TIPO_LEGADO[slug];
if (!tipo) {
  console.error(`Uso: npm run exportar -- <slug>. Slugs: ${Object.keys(TIPO_LEGADO).join(', ')}`);
  process.exit(1);
}

const festival = await unaFila(
  `select slug, nombre, ciudad, to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
          to_char(fecha_fin, 'YYYY-MM-DD') as fecha_fin
     from eventos.festivales where slug = $1`, [slug]);
if (!festival) { console.error(`No existe el festival ${slug}.`); process.exit(1); }

const filas = await sql(
  `select f.*, to_char(f.fecha, 'YYYY-MM-DD') as fecha, s.slug as sala_slug
     from eventos.funciones f
     join eventos.festivales fe on fe.id = f.festival_id
     left join eventos.salas s on s.id = f.sala_id
    where fe.slug = $1
    order by f.fecha, f.hora_min, f.obra`, [slug]);

const malas = [];
const funciones = filas.map(r => {
  const s = separar(tipo, r);
  const vuelta = recomponer(s);
  if (vuelta.compania !== (r.compania ?? null) || vuelta.nota_boleteria !== (r.nota_boleteria ?? null)) {
    malas.push({ obra: r.obra, fecha: r.fecha, antes: [r.compania, r.nota_boleteria], vuelta: [vuelta.compania, vuelta.nota_boleteria] });
  }
  return {
    obra: r.obra,
    compania: s.compania,
    descripcion: s.descripcion,
    franjas: s.franjas,
    tipos: r.tipos ?? null,
    publico: s.publico,
    nota: s.nota,
    fuente_horario: r.fuente_horario,
    fecha: r.fecha,
    hora: aHora(r.hora_min),
    sala: r.sala_slug,
    duracion: { min: r.duracion_min, confirmada: r.duracion_confirmada },
    precio: { pleno: r.precio_pleno, dcto: r.precio_dcto, libre: r.precio_pleno === 0 },
    url_compra: r.url_compra ?? null,
    imagen: r.imagen_key ? { key: r.imagen_key, credito: r.imagen_credito ?? null } : null,
  };
});

if (malas.length) {
  console.error(`${malas.length} filas no sobreviven a separar y recomponer. No se escribe nada:`);
  for (const m of malas.slice(0, 20)) console.error(JSON.stringify(m));
  await poolPg().end();
  process.exit(1);
}

const slugsSala = [...new Set(funciones.map(f => f.sala))];
const salas = await sql(
  `select slug, nombre, direccion, telefono, zona from eventos.salas
    where slug = any($1) order by slug`, [slugsSala]);
const zonas = [...new Set(salas.map(s => s.zona))];
const traslados = await sql(
  `select zona_a, zona_b, minutos from eventos.traslados
    where ciudad = $1 and zona_a = any($2) and zona_b = any($2) order by zona_a, zona_b`,
  [festival.ciudad, zonas]);

const ruta = new URL(`../festivales/${slug}.json`, import.meta.url);
const previo = await readFile(ruta, 'utf8').then(JSON.parse).catch(() => null);

const json = { formato: 1, festival, fuentes: previo?.fuentes ?? [], salas, traslados, funciones };

await mkdir(new URL('../festivales/', import.meta.url), { recursive: true });
await writeFile(ruta, JSON.stringify(json, null, 2) + '\n');

console.log(`${funciones.length} funciones, ${salas.length} salas, ${traslados.length} traslados -> festivales/${slug}.json`);
console.log(`Separar y recomponer: ${filas.length} de ${filas.length} filas idénticas.`);
const errores = validar(json);
if (errores.length) {
  console.log(`\nEl validador encuentra ${errores.length} problemas:`);
  for (const e of errores) console.log('  ' + e);
}
await poolPg().end();
```

- [ ] **Step 2: Agregar los scripts npm**

En `package.json`, dentro de `"scripts"`, agregar después de `"migrar"`:

```json
    "exportar": "node --env-file=.env.local scripts/exportar-festival.mjs",
    "cargar": "node --env-file=.env.local scripts/cargar.mjs",
    "fuente": "node --env-file=.env.local scripts/archivar-fuente.mjs",
```

- [ ] **Step 3: Exportar los tres festivales**

```bash
npm run exportar -- fiesta-artes-escenicas-22-2026
npm run exportar -- fiesta-libro-cultura-20-2026
npm run exportar -- festival-teatro-san-ignacio-2026
```

Expected en cada uno: `Separar y recomponer: N de N filas idénticas.` con N = 66, 776 y 54. El único problema del validador debe ser `fuentes: hace falta al menos una` (se resuelve en la Task 8).

Si el validador reporta otra cosa (por ejemplo `mismo título escrito distinto` o `falta traslado`), **es un dato de la base actual, no un error del script**. Hay que mostrárselo a Andrés y decidir con él antes de seguir. No ajustar el validador para que pase.

Si alguna fila no sobrevive a separar y recomponer, el script lo imprime y no escribe nada. Hay que corregir `lib/legado.mjs` con un test nuevo que reproduzca esa fila, y repetir el paso.

- [ ] **Step 4: Revisar a ojo una función de cada festival**

```bash
node -e "for (const s of ['fiesta-artes-escenicas-22-2026','fiesta-libro-cultura-20-2026','festival-teatro-san-ignacio-2026']) { const j = require('./festivales/'+s+'.json'); console.log(s, JSON.stringify(j.funciones.find(f => f.descripcion || f.franjas.length) ?? j.funciones[0], null, 1)); }"
```

Expected: San Ignacio con `compania` corta y `descripcion` larga separadas; Libro con `compania: null`, `descripcion` y `franjas` llenas; Artes sin cambios de forma.

- [ ] **Step 5: Commit**

```bash
git add scripts/exportar-festival.mjs package.json festivales/
git commit -m "feat: exportar festivales de la base al formato 1"
```

---

### Task 8: Archivar las fuentes en markdown

**Files:**
- Create: `scripts/archivar-fuente.mjs`

- [ ] **Step 1: Escribir el script**

`scripts/archivar-fuente.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { almacen, BUCKET, FALTA_LLAVE_STORAGE } from './_cliente.mjs';
import { hashContenido } from '../lib/hash.mjs';
import { METODOS } from '../lib/formato.mjs';

// Archiva el markdown de una fuente en el bucket y lo anota en el JSON.
//
//   fuentes/{festival}/{AAAA-MM-DD}_{hash8}.md
//
// Nunca sobrescribe: el hash va en la clave, así que la misma fuente bajada dos
// veces da la misma clave y la segunda subida se reconoce como repetida.

const [slug, archivo, metodo, url, bajada] = process.argv.slice(2);
if (!slug || !archivo || !METODOS.includes(metodo) || !/^\d{4}-\d{2}-\d{2}$/.test(bajada ?? '')) {
  console.error(`Uso: npm run fuente -- <slug> <archivo.md> <${METODOS.join('|')}> <url> <AAAA-MM-DD>`);
  process.exit(1);
}
const storage = almacen();
if (!storage) { console.error(FALTA_LLAVE_STORAGE); process.exit(1); }

const cuerpo = await readFile(archivo, 'utf8');
const texto = [
  '---', `festival: ${slug}`, `url: ${url}`, `bajada: ${bajada}`, `metodo: ${metodo}`, '---', '', cuerpo,
].join('\n');
const bytes = Buffer.from(texto, 'utf8');
const key = `fuentes/${slug}/${bajada}_${hashContenido(bytes).slice(0, 8)}.md`;

const { error } = await storage.storage.from(BUCKET)
  .upload(key, bytes, { contentType: 'text/markdown; charset=utf-8', upsert: false });
if (error && !/exists|Duplicate/i.test(error.message)) { console.error(error.message); process.exit(1); }
console.log(error ? `Ya estaba: ${key}` : `Subida: ${key} (${bytes.length} bytes)`);

const ruta = new URL(`../festivales/${slug}.json`, import.meta.url);
const json = JSON.parse(await readFile(ruta, 'utf8'));
if (!json.fuentes.some(f => f.key === key)) {
  json.fuentes.push({ key, url, bajada, metodo });
  await writeFile(ruta, JSON.stringify(json, null, 2) + '\n');
  console.log(`Anotada en festivales/${slug}.json`);
}
```

- [ ] **Step 2: Preparar los tres markdown**

```bash
mkdir -p trabajo/fuentes
# 22.ª Fiesta: la transcripción verificada leyendo el volante como imagen.
{ echo "# 22.ª Fiesta de las Artes Escénicas — transcripción del volante"; echo;
  echo "Leída como imagen; markitdown intercala las tres columnas. Las funciones agendadas del 21 al 24 están en scripts/seed.mjs."; echo;
  echo '```js'; cat scripts/datos-22-fiesta.mjs; echo '```'; } > trabajo/fuentes/artes-22.md
# Fiesta del Libro: el CSV del sitio, convertido.
python -m pip install "markitdown[all]" --quiet
python -m markitdown "D:/Download/fiesta_libro_medellin_2026.csv" -o trabajo/fuentes/libro-20.md
# San Ignacio: ya están en markdown (defuddle).
ls -la trabajo/fuentes/ trabajo/sanignacio/pagina.md trabajo/sanignacio/academica.md
```

Expected: cuatro archivos `.md` de más de 1 KB.

- [ ] **Step 3: Archivar**

```bash
npm run fuente -- fiesta-artes-escenicas-22-2026 trabajo/fuentes/artes-22.md imagen "https://fiestadelasartesescenicas.com" 2026-08-11
npm run fuente -- fiesta-libro-cultura-20-2026 trabajo/fuentes/libro-20.md markitdown "https://fiestadellibroylacultura.com" 2026-08-28
npm run fuente -- festival-teatro-san-ignacio-2026 trabajo/sanignacio/pagina.md defuddle "https://www.comfama.com/festivales/festival-teatro-san-ignacio/" 2026-10-20
npm run fuente -- festival-teatro-san-ignacio-2026 trabajo/sanignacio/academica.md defuddle "https://www.comfama.com/festivales/festival-teatro-san-ignacio/programacion-academica/" 2026-10-29
```

Las fechas de bajada son las de los archivos en disco (PDF 11 ago, CSV 28 ago, `pagina.md` 20 oct, `academica.md` 29 oct). Las URL de las dos Fiestas son de referencia: hay que confirmarlas con Andrés antes de este paso, y si no las sabe, usar `"desconocida"`.

Expected: cuatro líneas `Subida: fuentes/…` y `Anotada en festivales/…`.

- [ ] **Step 4: Validar los tres JSON**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { validar } from './lib/formato.mjs';
for (const s of ['fiesta-artes-escenicas-22-2026','fiesta-libro-cultura-20-2026','festival-teatro-san-ignacio-2026'])
  console.log(s, validar(JSON.parse(readFileSync('festivales/'+s+'.json','utf8'))));"
```

Expected: `[]` en los tres.

- [ ] **Step 5: Commit**

```bash
git add scripts/archivar-fuente.mjs festivales/
git commit -m "feat: archivar la fuente de cada festival en markdown"
```

---

### Task 9: Cargar un festival desde el formato 1

**Files:**
- Create: `scripts/cargar.mjs`

- [ ] **Step 1: Escribir el script**

`scripts/cargar.mjs`:

```js
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { conectar } from './_pg.mjs';
import { validar } from '../lib/formato.mjs';
import { planificar, cambiosCatalogo, COLUMNAS } from '../lib/carga.mjs';

// festivales/{slug}.json -> base, en una sola transacción.
//
//   npm run cargar -- <slug> --seco   imprime el diff y no escribe
//   npm run cargar -- <slug>          escribe
//
// Lo del usuario (agendada, interés, acompañantes, boletas, bitácora) no se
// toca. Una función que la fuente ya no trae se borra solo si no tiene nada del
// usuario; si tiene, queda un aviso y la función sigue.

const slug = process.argv.slice(2).find(a => !a.startsWith('--'));
const SECO = process.argv.includes('--seco');
if (!slug) { console.error('Uso: npm run cargar -- <slug> [--seco]'); process.exit(1); }

const json = JSON.parse(await readFile(new URL(`../festivales/${slug}.json`, import.meta.url), 'utf8'));
const errores = validar(json);
if (errores.length) {
  console.error(`festivales/${slug}.json no es válido:`);
  for (const e of errores) console.error('  ' + e);
  process.exit(1);
}

const c = await conectar();
const q = async (t, p) => (await c.query(t, p)).rows;

try {
  await c.query('begin');

  const fe = json.festival;
  const cambiosFestival = await q(
    `select 1 from eventos.festivales where slug = $1 and nombre = $2 and ciudad = $3
       and fecha_inicio = $4 and fecha_fin = $5`,
    [fe.slug, fe.nombre, fe.ciudad, fe.fecha_inicio, fe.fecha_fin]);
  const [{ id: festivalId }] = await q(
    `insert into eventos.festivales (slug, nombre, ciudad, fecha_inicio, fecha_fin)
     values ($1,$2,$3,$4,$5)
     on conflict (slug) do update set nombre = excluded.nombre, ciudad = excluded.ciudad,
       fecha_inicio = excluded.fecha_inicio, fecha_fin = excluded.fecha_fin
     returning id`,
    [fe.slug, fe.nombre, fe.ciudad, fe.fecha_inicio, fe.fecha_fin]);

  const catalogo = cambiosCatalogo(
    json,
    await q(`select slug, nombre, direccion, telefono, zona from eventos.salas where slug = any($1)`,
      [json.salas.map(s => s.slug)]),
    await q(`select zona_a, zona_b, minutos from eventos.traslados where ciudad = $1`, [fe.ciudad]));

  for (const s of json.salas) {
    await q(
      `insert into eventos.salas (slug, nombre, direccion, telefono, zona, ciudad)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (slug) do update set nombre = excluded.nombre, direccion = excluded.direccion,
         telefono = excluded.telefono, zona = excluded.zona`,
      [s.slug, s.nombre, s.direccion, s.telefono, s.zona, fe.ciudad]);
  }
  for (const t of json.traslados) {
    await q(
      `insert into eventos.traslados (ciudad, zona_a, zona_b, minutos) values ($1,$2,$3,$4)
       on conflict (ciudad, zona_a, zona_b) do update set minutos = excluded.minutos`,
      [fe.ciudad, t.zona_a, t.zona_b, t.minutos]);
  }

  const salaId = Object.fromEntries(
    (await q(`select id, slug from eventos.salas where slug = any($1)`, [json.salas.map(s => s.slug)]))
      .map(s => [s.slug, s.id]));

  const actuales = await q(
    `select f.id, ${COLUMNAS.filter(k => k !== 'fecha').map(k => 'f.' + k).join(', ')},
            to_char(f.fecha, 'YYYY-MM-DD') as fecha, s.slug as sala_slug
       from eventos.funciones f left join eventos.salas s on s.id = f.sala_id
      where f.festival_id = $1`, [festivalId]);

  const conUsuario = new Set((await q(
    `select f.id from eventos.funciones f
      where f.festival_id = $1 and (f.agendada or f.interes is not null
        or exists (select 1 from eventos.boletas b where b.funcion_id = f.id)
        or exists (select 1 from eventos.bitacora x where x.funcion_id = f.id)
        or exists (select 1 from eventos.estados_compra e where e.funcion_id = f.id))`,
    [festivalId])).map(r => r.id));

  const plan = planificar(json, actuales, salaId, conUsuario);

  console.log(`\n${slug}${SECO ? ' (en seco)' : ''}`);
  if (!cambiosFestival.length) console.log('  festival: cambia nombre, ciudad o fechas');
  for (const x of catalogo) console.log('  ' + x);
  console.log(`  funciones: ${plan.insertar.length} nuevas, ${plan.actualizar.length} cambian, ` +
    `${plan.retirar.length} se borran, ${plan.avisar.length} retiradas con datos tuyos (aviso)`);
  const porColumna = {};
  for (const a of plan.actualizar) for (const k of Object.keys(a.cambios)) porColumna[k] = (porColumna[k] ?? 0) + 1;
  for (const [k, n] of Object.entries(porColumna)) console.log(`    ${k}: ${n}`);
  for (const a of plan.actualizar.slice(0, 5)) console.log(`    ej. ${a.llave}: ${JSON.stringify(a.cambios)}`);
  for (const r of [...plan.retirar, ...plan.avisar]) console.log(`    retirada: ${r.llave}`);

  if (SECO) { await c.query('rollback'); console.log('  Nada escrito.'); }
  else {
    for (const n of plan.insertar) {
      const cols = ['festival_id', ...COLUMNAS, 'acompanantes', 'agendada'];
      const vals = [festivalId, ...COLUMNAS.map(k => n[k]), 0, false];
      await q(`insert into eventos.funciones (${cols.join(', ')})
               values (${cols.map((_, i) => '$' + (i + 1)).join(', ')})`, vals);
    }
    for (const a of plan.actualizar) {
      const ks = Object.keys(a.cambios);
      await q(`update eventos.funciones set ${ks.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`,
        [a.id, ...ks.map(k => a.cambios[k].despues)]);
    }
    for (const r of plan.retirar) await q('delete from eventos.funciones where id = $1', [r.id]);
    for (const r of plan.avisar) {
      await q(`insert into eventos.avisos (funcion_id, tipo, severidad, mensaje)
               values ($1, 'retirada_de_fuente', 'alto', $2)`,
        [r.id, `La fuente ya no trae esta función (${r.llave}) y tiene datos tuyos: no se borró.`]);
    }
    await c.query('commit');
    await c.query(`notify pgrst, 'reload schema'`);
    console.log('  Escrito.');
  }
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error(`Falló la carga: ${e.message}`);
  process.exitCode = 1;
} finally {
  await c.end();
}
```

- [ ] **Step 2: Correr en seco los tres festivales**

```bash
for s in fiesta-artes-escenicas-22-2026 fiesta-libro-cultura-20-2026 festival-teatro-san-ignacio-2026; do npm run cargar -- $s --seco; done
```

Expected en cada uno:
- ninguna línea de `festival:`, `sala` ni `traslado`;
- `0 nuevas, N cambian, 0 se borran, 0 retiradas`;
- en el desglose por columna solo aparecen `descripcion`, `franjas` o `publico`. Artes: `0 cambian`, porque no tiene esos campos.

Si aparece cualquier otra columna, o una función nueva o retirada, **no se carga**. Hay que leer el ejemplo impreso y encontrar por qué el JSON difiere de la base. La causa está en el exportador o en `aFila`, no en los datos.

- [ ] **Step 3: Commit del script**

```bash
git add scripts/cargar.mjs
git commit -m "feat: cargar un festival desde el formato 1, con modo en seco"
```

---

### Task 10: Prueba de equivalencia y carga real

- [ ] **Step 1: Copia de seguridad de las funciones antes de escribir**

```bash
node --env-file=.env.local --input-type=module -e "
import { writeFileSync } from 'node:fs';
import { sql, poolPg } from './scripts/_cliente.mjs';
writeFileSync('trabajo/funciones-antes-2026-11-02.json', JSON.stringify(await sql('select * from eventos.funciones')));
await poolPg().end();"
ls -la trabajo/funciones-antes-2026-11-02.json
```

Expected: un archivo de unos cientos de KB con 896 funciones.

- [ ] **Step 2: Cargar de verdad**

```bash
for s in fiesta-artes-escenicas-22-2026 fiesta-libro-cultura-20-2026 festival-teatro-san-ignacio-2026; do npm run cargar -- $s; done
```

Expected: los mismos números que en seco, terminando en `Escrito.`

- [ ] **Step 3: Segunda pasada en seco: diff vacío**

```bash
for s in fiesta-artes-escenicas-22-2026 fiesta-libro-cultura-20-2026 festival-teatro-san-ignacio-2026; do npm run cargar -- $s --seco; done
```

Expected en los tres: `funciones: 0 nuevas, 0 cambian, 0 se borran, 0 retiradas con datos tuyos (aviso)`.

- [ ] **Step 4: Las columnas heredadas no se movieron**

```bash
node --env-file=.env.local --input-type=module -e "
import { readFileSync } from 'node:fs';
import { sql, poolPg } from './scripts/_cliente.mjs';
const antes = new Map(JSON.parse(readFileSync('trabajo/funciones-antes-2026-11-02.json','utf8')).map(f => [f.id, f]));
const ahora = await sql('select * from eventos.funciones');
const cols = ['obra','compania','nota_boleteria','fecha','hora_min','duracion_min','precio_pleno','precio_dcto','sala_id','agendada','interes','tipos','url_compra','imagen_key'];
let distintas = 0;
for (const f of ahora) { const a = antes.get(f.id); if (!a) { distintas++; continue; }
  for (const c of cols) if (JSON.stringify(a[c]) !== JSON.stringify(f[c])) { distintas++; console.log(f.obra, c); break; } }
console.log({ antes: antes.size, ahora: ahora.length, distintas });
await poolPg().end();"
```

Expected: `{ antes: 896, ahora: 896, distintas: 0 }`.

- [ ] **Step 5: La app sigue igual**

Run: `npm test && npm run build`
Expected: 130 pass; build exitoso.

- [ ] **Step 6: Commit**

No hay archivos nuevos en git: la copia de seguridad vive en `trabajo/`, que está en `.gitignore`. Si `festivales/` cambió por la carga (no debería), revisar con `git diff festivales/` antes de seguir.

---

### Task 11: Borrar los cargadores viejos y actualizar la documentación

**Files:**
- Delete: `scripts/cargar-programacion.mjs`, `scripts/cargar-fiesta-libro.mjs`, `scripts/cargar-san-ignacio.mjs`, `scripts/cargar-academico-san-ignacio.mjs`, `scripts/datos-22-fiesta.mjs`, `scripts/datos-san-ignacio.mjs`, `scripts/tipos-san-ignacio.mjs`
- Modify: `package.json`, `scripts/seed.mjs:1`, `README.md`, `scripts/extraccion/LEEME.md`

- [ ] **Step 1: Confirmar que nada más los importa**

Run: `grep -rln "datos-22-fiesta\|datos-san-ignacio\|tipos-san-ignacio\|cargar-programacion\|cargar-fiesta-libro\|cargar-san-ignacio\|cargar-academico" --include=*.mjs --include=*.js --include=*.json lib app scripts package.json`
Expected: solo los propios archivos a borrar, `package.json` y `scripts/extraccion/generar-datos.py` (que escribe `datos-san-ignacio.mjs`). Si aparece un test de `lib/`, ese test usa datos reales: hay que moverlo a leer `festivales/{slug}.json` antes de borrar.

- [ ] **Step 2: Borrar**

```bash
git rm scripts/cargar-programacion.mjs scripts/cargar-fiesta-libro.mjs scripts/cargar-san-ignacio.mjs \
       scripts/cargar-academico-san-ignacio.mjs scripts/datos-22-fiesta.mjs scripts/datos-san-ignacio.mjs \
       scripts/tipos-san-ignacio.mjs
```

- [ ] **Step 3: `package.json`**

Quitar las líneas `"programacion"`, `"san-ignacio"` y `"fiesta-libro"` de `"scripts"`.

- [ ] **Step 4: `scripts/seed.mjs` queda como histórico**

Agregar al principio del archivo, antes de la primera línea `import`:

```js
// HISTÓRICO. Sembró la 22.ª Fiesta el 24 ago 2026 y sus datos ya están en la
// base. La programación ahora vive en festivales/*.json y se carga con
// `npm run cargar`. No correr sobre una base que ya tiene datos.
```

- [ ] **Step 5: `scripts/extraccion/LEEME.md`**

Reemplazar el bloque de comandos (las seis líneas dentro de ```bash … ```) por:

````markdown
```bash
defuddle parse https://www.comfama.com/festivales/festival-teatro-san-ignacio/   --md -o trabajo/sanignacio/pagina.md
python scripts/extraccion/parsear.py          # -> trabajo/sanignacio/funciones.json
python scripts/extraccion/bajar-imagenes.py   # -> trabajo/sanignacio/imagenes/
# funciones.json se pasa a festivales/festival-teatro-san-ignacio-2026.json (formato 1)
npm run fuente -- festival-teatro-san-ignacio-2026 trabajo/sanignacio/pagina.md defuddle <url> <fecha>
npm run cargar -- festival-teatro-san-ignacio-2026 --seco
```

`generar-datos.py` escribía `scripts/datos-san-ignacio.mjs`, que ya no existe:
la salida ahora es el JSON del formato 1.
````

- [ ] **Step 6: `README.md`**

1. En «Arranque», reemplazar la línea `npm run seed     # carga la 22.ª Fiesta y sube los archivos de D:\Download` por:
   `npm run cargar -- <slug>   # carga un festival desde festivales/<slug>.json`
2. Reemplazar la línea `Entra una sola vez con \`http://localhost:3000/entrar?k=TU_ACCESO_SECRETO\`. Queda una cookie \`httpOnly\` por 120 días.` por:
   `La primera vez en cada dispositivo la app pide el código de acceso (lo imprime \`npm run codigo\`) y lo guarda ahí.`
3. En la tabla de «Scripts», quitar las filas `npm run seed`, `npm run programacion`, `npm run fiesta-libro`, `npm run san-ignacio`, y agregar:

```markdown
| `npm run exportar -- <slug>` | Base → `festivales/<slug>.json`; aborta si separar los campos pierde algo |
| `npm run fuente -- <slug> <md> <metodo> <url> <fecha>` | Archiva la fuente en markdown en el bucket |
| `npm run cargar -- <slug> [--seco]` | `festivales/<slug>.json` → base; en seco solo muestra el diff |
```

4. En la tabla, cambiar `92 pruebas` por `130 pruebas`.
5. En «Decisiones que conviene no deshacer», la entrada «La extracción de una página web se congela en un módulo» pasa a decir:
   `**La extracción se congela en festivales/<slug>.json.** El cargador lee el JSON, no la red. La fuente cruda queda archivada en markdown en el bucket (\`fuentes/\`), y el JSON dice cuál y cómo se obtuvo.`

- [ ] **Step 7: Verificar**

Run: `npm test && npm run build && npm run cargar -- festival-teatro-san-ignacio-2026 --seco`
Expected: 130 pass; build exitoso; `0 nuevas, 0 cambian, 0 se borran`.

- [ ] **Step 8: Commit**

```bash
git add -A scripts package.json README.md
git commit -m "chore: borrar los cargadores por festival; la programación vive en festivales/*.json"
```

---

## Terminado cuando

- `bitacora.fecha` sale en hora de Bogotá (Task 1, Step 4).
- Los tres festivales: separar y recomponer idéntico en las 896 filas (Task 7), diff vacío en la segunda pasada (Task 10, Step 3) y 0 columnas heredadas cambiadas (Task 10, Step 4).
- `npm test` da 130 pass y `npm run build` funciona.
- Los siete archivos viejos están borrados y el README describe lo que existe.
