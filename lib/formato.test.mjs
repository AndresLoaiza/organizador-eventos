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
