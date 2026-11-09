import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarCartelera, escogerImdb, idiomasOriginales, mismaPelicula, sumarDias, unirSalas } from './cartelera.mjs';

const d = JSON.parse(readFileSync(new URL('../cartelera/cartelera.json', import.meta.url)));

test('el JSON publicado: slug, dónde verla con enlace https, nunca doblada, IMDb válido si está', () => {
  assert.ok(d.peliculas.length > 0);
  for (const f of d.peliculas) {
    assert.match(f.slug, /^[a-z0-9-]+$/);
    assert.ok(f.donde.length > 0, f.titulo);
    for (const x of f.donde) {
      assert.match(x.url, /^https:\/\//, f.titulo);
      assert.doesNotMatch(x.idioma, /dobl/i, f.titulo);
    }
    if (f.imdb) {
      assert.match(f.imdb.id, /^tt\d+$/, f.titulo);
      assert.ok(f.imdb.nota >= 1 && f.imdb.nota <= 10 && f.imdb.votos > 0, f.titulo);
    }
  }
});

// Forma recortada de la API real de Cine Colombia (9 nov 2026).
const ATRIBUTOS = [
  { id: '0000000004', name: '2D', kind: 'format' },
  { id: '0000000008', name: 'Subtitulado', kind: 'language' },
  { id: '0000000007', name: 'Doblada', kind: 'language' },
  { id: '0000000006', name: 'Español', kind: 'language' },
];
const SEDES = [{ id: '6690', name: 'MOLINOS' }, { id: '6365', name: 'VIVA ENVIGADO' }];
const PELIS = [
  { id: 'A', slug: 'clayface', title: 'Clayface', title_es: 'Clayface', release_date: '2026-10-22' },
  { id: 'B', slug: 'el-gato', title: 'The Cat in the Hat', title_es: 'El Gato con Sombrero', release_date: '2026-10-31' },
  { id: 'C', slug: 'pacifico', title: 'Pacífico', title_es: 'Pacífico', release_date: '2026-10-01' },
  { id: 'D', slug: 'dune', title: 'Dune: Part Three', title_es: 'Dune: Parte 3', release_date: '2026-12-17' },
];
const dia = (fecha, ...filas) => ({ business_date: fecha, film_screenings: filas });
const peli = (id, ...sites) => ({ film_id: id, sites: sites.map(([site_id, ...attrs]) => ({ site_id, showtime_attribute_ids: attrs })) });

test('armarCartelera: subtitulada y español entran, doblada no, preventa fuera de la ventana no', () => {
  const fechas = [
    dia('2026-11-09',
      peli('A', ['6690', '0000000004', '0000000007'], ['6365', '0000000004', '0000000008']),
      peli('B', ['6690', '0000000007']),
      peli('C', ['6690', '0000000006'])),
    dia('2026-11-10', peli('A', ['6365', '0000000008'])),
    dia('2026-12-17', peli('D', ['6690', '0000000008'])),
  ];
  const r = armarCartelera({ sedes: SEDES, peliculas: PELIS, atributos: ATRIBUTOS, fechas, hoy: '2026-11-09' });
  assert.deepEqual(r.map(f => f.slug).sort(), ['clayface', 'pacifico']);
  const clay = r.find(f => f.slug === 'clayface');
  assert.deepEqual(clay.salas, ['Viva Envigado']);   // en Molinos solo va doblada
  assert.deepEqual(clay.fechas, ['2026-11-09', '2026-11-10']);
  assert.equal(clay.idioma, 'Subtitulada');
  assert.equal(r.find(f => f.slug === 'pacifico').idioma, 'Español (original)');
});

test('armarCartelera: lo de ayer no cuenta', () => {
  const fechas = [dia('2026-11-08', peli('A', ['6365', '0000000008']))];
  assert.deepEqual(armarCartelera({ sedes: SEDES, peliculas: PELIS, atributos: ATRIBUTOS, fechas, hoy: '2026-11-09' }), []);
});

test('idiomasOriginales y sumarDias', () => {
  assert.deepEqual(idiomasOriginales(ATRIBUTOS), { '0000000008': 'Subtitulada', '0000000006': 'Español (original)' });
  assert.equal(sumarDias('2026-11-28', 6), '2026-12-04');
});

test('escogerImdb: título igual gana aunque el año sea de reestreno', () => {
  const s = [
    { id: 'tt0232500', l: 'The Fast and the Furious', y: 2001, qid: 'movie' },
    { id: 'tt999', l: 'The Fast and the Furious', y: 1954, qid: 'movie' },
  ];
  assert.deepEqual(escogerImdb(s, 'The Fast and the Furious (25th Anniversary)', 2026), { id: 'tt0232500', dudoso: false });
});

test('escogerImdb: sin título igual, solo con año cercano y marcada dudosa; si no, nada', () => {
  const s = [{ id: 'tt1', l: 'Pacific', y: 2026, qid: 'movie' }, { id: 'tt2', l: 'Pacífico', y: 2026, qid: 'tvSeries' }];
  assert.deepEqual(escogerImdb(s, 'Pacífico', 2026), { id: 'tt1', dudoso: true });
  assert.equal(escogerImdb(s, 'Pacífico', 2019), null);
  assert.equal(escogerImdb([], 'X', 2026), null);
});

test('escogerImdb: sin año desempata la más votada (Akira de 1988, no su homónima)', () => {
  const s = [{ id: 'tt0094625', l: 'Akira', y: 1988, qid: 'movie' }, { id: 'tt2', l: 'Akira', y: 2025, qid: 'movie' }];
  const votos = { tt0094625: 233873, tt2: 4716 };
  assert.deepEqual(escogerImdb(s, 'Akira', null, id => votos[id]), { id: 'tt0094625', dudoso: false });
  assert.equal(escogerImdb([{ id: 'tt3', l: 'Marie Antoinette', y: 2006, qid: 'movie' }], 'María Antonieta', null), null);
});

test('mismaPelicula: traducción a una letra y subtítulo tras los dos puntos, pero no títulos cortos parecidos', () => {
  const k = (...t) => new Set(t.map(x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')));
  assert.ok(mismaPelicula(k('resurrection'), k('resurreccion')));
  assert.ok(mismaPelicula(k('wildwood', 'wildwood: el bosque salvaje'.split(':')[0]), k('wildwood')));
  assert.ok(!mismaPelicula(k('rocky'), k('rocka')));
});

test('unirSalas: la misma película en varias salas queda una vez con su lista de dónde', () => {
  const cc = [{ titulo: 'Caballo Salvaje Nueve', original: 'Wild Horse Nine', slug: 'wild-horse-nine', salas: ['Molinos'], idioma: 'Subtitulada', fechas: ['2026-11-09'] }];
  const cadenas = [
    { nombre: 'Colombo Americano', peliculas: [{ titulo: 'Wild Horse Nine', original: 'Wild Horse Nine', sede: 'Colombo Americano, sala 1', idioma: 'el Colombo no lo publica', idioma_confirmado: false, url: 'https://colombo/x', funciones: ['2026-11-13 18:30'], anio: 2026 }] },
    { nombre: 'MAMM (cine)', peliculas: [
      { titulo: 'Caballo salvaje nueve', original: 'Caballo salvaje nueve', sede: 'MAMM', idioma: 'Subtitulada', idioma_confirmado: true, url: 'https://mamm/x', funciones: ['2026-11-12 19:00', '2026-11-12 21:00'], anio: 2026 },
      { titulo: 'Babystar', original: 'Babystar', sede: 'MAMM', idioma: 'Subtitulada', idioma_confirmado: true, url: 'https://mamm/b', funciones: ['2026-11-11 16:00'], anio: 2025 },
    ] },
  ];
  const r = unirSalas(cc, cadenas);
  assert.equal(r.length, 2);
  const whn = r.find(f => f.slug === 'wild-horse-nine');
  assert.deepEqual(whn.donde.map(x => x.cadena), ['Cine Colombia', 'Colombo Americano', 'MAMM (cine)']);
  assert.equal(whn.donde[0].url, 'https://www.cinecolombia.com/peliculas/wild-horse-nine');
  assert.deepEqual(whn.donde[2].fechas, ['2026-11-12']);
  assert.equal(r.find(f => f.titulo === 'Babystar').anio, 2025);
});
