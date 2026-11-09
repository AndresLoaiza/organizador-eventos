import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(new URL('../cartelera/cartelera.json', import.meta.url)));

test('cada película trae slug, sala e idioma que no es doblado', () => {
  for (const f of d.peliculas) {
    assert.match(f.slug, /^[a-z0-9-]+$/);
    assert.ok(f.salas.length > 0, f.titulo);
    assert.match(f.imdb.id, /^tt\d+$/, f.titulo);
    assert.ok(f.imdb.nota >= 1 && f.imdb.nota <= 10 && f.imdb.votos > 0, f.titulo);
    assert.doesNotMatch(f.idioma, /dobl/i, f.titulo);
  }
});
