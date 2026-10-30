// The cassette is clean when the model is sure and wobbles when it doubts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tape } from '../lib/lofi.js';

const SR = 48000;

function pitchSpreadCents(doubt) {
  const n = SR * 3;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = R[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / SR);
  tape(L, R, SR, () => doubt);
  const cents = [];
  let last = null;
  for (let i = SR; i < n; i++) {
    if (L[i - 1] < 0 && L[i] >= 0) {
      const t = i - L[i] / (L[i] - L[i - 1]);
      if (last !== null) cents.push(1200 * Math.log2(SR / (t - last) / 440));
      last = t;
    }
  }
  cents.sort((a, b) => a - b);
  return cents[Math.floor(cents.length * 0.98)] - cents[Math.floor(cents.length * 0.02)];
}

test('doubt 0 leaves the pitch alone, doubt 1 makes the tape cry', () => {
  assert.ok(pitchSpreadCents(0) < 10);
  assert.ok(pitchSpreadCents(1) > 100);
});
