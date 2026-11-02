import test from 'node:test';
import assert from 'node:assert/strict';
import { urlSegura } from './url.mjs';

test('urlSegura solo deja pasar http(s)', () => {
  assert.equal(urlSegura('https://latiquetera.com/x'), 'https://latiquetera.com/x');
  assert.equal(urlSegura('javascript:alert(1)'), null);
  assert.equal(urlSegura('data:text/html,<b>'), null);
  assert.equal(urlSegura(null), null);
  assert.equal(urlSegura('no es url'), null);
});
