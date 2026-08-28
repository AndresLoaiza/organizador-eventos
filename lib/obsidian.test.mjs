import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirBloque, insertarBloque, tituloSeccion } from './obsidian.mjs';

// Lo que se prueba aquí es la única parte del sistema que escribe en un archivo
// personal de Andrés. Si la sustitución se pasa de larga, se come su nota.

const FESTIVAL = {
  nombre: '22.ª Fiesta de las Artes Escénicas',
  ciudad: 'Medellín',
  fecha_inicio: '2026-08-20',
};

const FUNCIONES = [
  { id: 'a', fecha: '2026-08-24', obra: 'KRAPP, la última cinta', compania: 'Actores en Escena (Manizales)' },
  { id: 'b', fecha: '2026-08-25', obra: 'Petra', compania: 'AmbidiestroLab (Bogotá)' },
];

test('el título de sección sale del nombre y la fecha del festival', () => {
  assert.equal(tituloSeccion(FESTIVAL), '### 22.ª Fiesta de las Artes Escénicas — Medellín, ago 2026');
});

test('una función sin juicio se marca pendiente, no se inventa', () => {
  const b = construirBloque(FESTIVAL, FUNCIONES, [
    { funcion_id: 'a', texto: 'Beckett puro. La primera media hora se hace larga.', estrellas: 4 },
  ]);
  assert.match(b, /1 de 2 funciones juzgadas/);
  assert.match(b, /★★★★/);
  assert.match(b, /Beckett puro/);
  assert.match(b, /\| Petra \| AmbidiestroLab \(Bogotá\) \|  \| _\(sin registrar\)_ \|/);
});

test('el salto de línea y las barras del texto no rompen la tabla', () => {
  const b = construirBloque(FESTIVAL, [FUNCIONES[0]], [
    { funcion_id: 'a', texto: 'Dos cosas:\n  una | y otra', estrellas: null },
  ]);
  const fila = b.split('\n').find(l => l.includes('KRAPP'));
  // La barra del texto queda escapada, así que no parte la celda: separando por
  // barras NO precedidas de contrabarra siguen siendo cuatro columnas.
  assert.equal(fila.split(/(?<!\\)\|/).length - 1, 5);
  assert.match(fila, /Dos cosas: una \\\| y otra/);
});

test('reemplazar la sección no se come lo que viene después', () => {
  const nota = [
    '# Gustos',
    '',
    '## Bitácora',
    '',
    '### 22.ª Fiesta de las Artes Escénicas — Medellín, ago 2026',
    '',
    'Plan armado, aún sin ver.',
    '',
    '| Obra | Grupo |',
    '|---|---|',
    '| KRAAP | viejo |',
    '',
    '## Vacíos — preguntar, no asumir',
    '',
    '- Presupuesto del festival concreto',
  ].join('\n');

  const nuevo = insertarBloque(nota, FESTIVAL, construirBloque(FESTIVAL, FUNCIONES, []));

  assert.match(nuevo, /## Vacíos — preguntar, no asumir/);
  assert.match(nuevo, /- Presupuesto del festival concreto/);
  assert.doesNotMatch(nuevo, /KRAAP/);                   // la tabla vieja se fue
  assert.equal(nuevo.match(/### 22\.ª Fiesta/g).length, 1);
});

test('si la sección no existe, entra al principio de la bitácora', () => {
  const nota = '# Gustos\n\n## Bitácora\n\n### Otro festival — Medellín, may 2026\n\nAlgo.\n';
  const nuevo = insertarBloque(nota, FESTIVAL, construirBloque(FESTIVAL, FUNCIONES, []));
  const iNuevo = nuevo.indexOf('### 22.ª Fiesta');
  const iViejo = nuevo.indexOf('### Otro festival');
  assert.ok(iNuevo > 0 && iNuevo < iViejo, 'lo reciente va arriba');
  assert.match(nuevo, /### Otro festival/);
});

test('sin sección de bitácora la crea al final', () => {
  const nuevo = insertarBloque('# Gustos\n\nAlgo.\n', FESTIVAL, construirBloque(FESTIVAL, FUNCIONES, []));
  assert.match(nuevo, /## Bitácora/);
  assert.match(nuevo, /### 22\.ª Fiesta/);
});

test('correr dos veces deja el archivo igual', () => {
  const nota = '# Gustos\n\n## Bitácora\n\n## Vacíos\n\n- algo\n';
  const bloque = construirBloque(FESTIVAL, FUNCIONES, []);
  const una = insertarBloque(nota, FESTIVAL, bloque);
  const dos = insertarBloque(una, FESTIVAL, bloque);
  assert.equal(una, dos);
});
