import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doubtOf, tokenAt, ghosts, H_MAX, CLASH } from '../lib/doubt.js';

test('doubt is the entropy scaled to 0…1', () => {
  assert.equal(doubtOf({ h: 0 }), 0);
  assert.equal(doubtOf({ h: H_MAX }), 1);
  assert.equal(doubtOf({ h: 10 }), 1);
});

test('a token holds its doubt until `until`, then nothing sounds', () => {
  const tokens = [{ t: 1, until: 1.5, d: 0.2 }, { t: 2, until: 2.5, d: 0.9 }];
  assert.equal(tokenAt(tokens, 0.5), null);
  assert.equal(tokenAt(tokens, 1.2).d, 0.2);
  assert.equal(tokenAt(tokens, 1.7), null);
  assert.equal(tokenAt(tokens, 2.49).d, 0.9);
});

test('ghost notes clash with the written note, as loud as the model believed in them', () => {
  const tok = { alts: [{ tok: 'a', p: 0.5 }, { tok: 'b', p: 0.1 }] };
  const g = ghosts(tok, 60, 0.5);
  assert.deepEqual(g.map((x) => x.midi), [60 + CLASH[0], 60 + CLASH[1]]);
  assert.ok(g[0].gain > g[1].gain);
  assert.equal(g[0].gain, 0.5 ** 0.7);
});
