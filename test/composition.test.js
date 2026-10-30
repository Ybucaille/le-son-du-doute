// The promise of the project: the composed part never depends on what the model answers.
// Same questions with every doubt wiped out must give the same bars, chords and melody notes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrange, EIGHTH, BAR } from '../compositions/nocturne.js';
import { arrange as arrangeLofi } from '../sonify.mjs';

const story = JSON.parse(readFileSync('stories/neptune.json', 'utf8'));
const captures = story.items.map((it) => JSON.parse(readFileSync(it.capture, 'utf8')));
const certain = captures.map((c) => ({ ...c, tokens: c.tokens.map((t) => ({ ...t, p: 1, h: 0, alts: [] })) }));

test('nocturne: the score is the same whatever the doubt', () => {
  const a = arrange(story, captures), b = arrange(story, certain);
  assert.deepEqual(a.bars.map((x) => [x.t, x.chord, x.role]), b.bars.map((x) => [x.t, x.chord, x.role]));
  assert.deepEqual(a.tokens.map((x) => [x.t, x.midi]), b.tokens.map((x) => [x.t, x.midi]));
  assert.ok(a.tokens.some((x) => x.d > 0.5) && b.tokens.every((x) => x.d === 0));
});

test('nocturne: one token per eighth, every answer starts on a bar', () => {
  const { tokens, items } = arrange(story, captures);
  for (const it of items) {
    assert.ok(Math.abs(it.t0 / BAR - Math.round(it.t0 / BAR)) < 1e-9);
    const own = tokens.filter((x) => x.cap === it.cap);
    own.forEach((x, i) => assert.ok(Math.abs(x.t - (it.t0 + i * EIGHTH)) < 1e-9));
  }
});

test('lo-fi: the groove is the same whatever the doubt', () => {
  const a = arrangeLofi(captures.slice(0, 2)), b = arrangeLofi(certain.slice(0, 2));
  assert.deepEqual(a.tokens.map((x) => x.t), b.tokens.map((x) => x.t));
  assert.equal(a.duration, b.duration);
});
