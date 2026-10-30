// Turns captures into a lo-fi track. What is composed never changes: D minor at 82 bpm,
// Dm7 – Gm7 – B♭maj7 – A7, Rhodes, round bass, soft swung drums, and a written melody where
// each generated token plays the next note. What is measured is the doubt of each token, and
// it acts in exactly two ways, identical for every answer:
//   1. the runner-up tokens the model almost said play ghost notes, one clashing interval away
//      from the written note and as loud as the model believed in them;
//   2. the cassette degrades: wow and flutter, muffled highs, saturation, hiss and crackle.
// Usage: node sonify.mjs captures/a.json [captures/b.json …] out.wav

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { reverb, master, encodeWav } from './lib/synth.js';
import { rhodes, bass, kick, snare, hat, tape } from './lib/lofi.js';
import { isMarkup, doubtOf, doubtCurve, ghosts } from './lib/doubt.js';

export { tokenAt } from './lib/doubt.js';

const SR = 48000;
export const BEAT = 60 / 82;
const SWING = 0.58;                               // off-beat eighths land late, like a lazy drummer

const CHORDS = [[50, 53, 57, 60], [53, 55, 58, 62], [53, 57, 58, 62], [52, 55, 57, 61]];
const ROOTS = [38, 43, 34, 33];
const FIFTHS = [45, 50, 41, 40];
const MELODY = [
  [69, 72, 74, 72, 69, 67, 65, 67],
  [70, 69, 67, 65, 67, 70, 74, 72],
  [69, 65, 62, 65, 69, 72, 69, 65],
  [67, 69, 73, 76, 73, 69, 67, 64],
];

export const eighth = (s) => (Math.floor(s / 2) + (s % 2 ? SWING : 0)) * BEAT;

export function arrange(captures) {
  const tokens = [];                              // { t, s, tok, d, cap }
  const answers = [];                             // { cap, t0, t1 } time span of each answer
  let s = 16;                                     // two bars of groove before the first answer
  captures.forEach((capture, cap) => {
    const t0 = eighth(s);
    let lead = '';                                // spaces of skipped markup tokens, kept for display
    for (const tok of capture.tokens) {
      if (isMarkup(tok.tok)) { lead += tok.tok.replace(/\S/g, ''); continue; }
      tokens.push({ t: eighth(s), until: eighth(s) + eighth(1) * 1.2, s: s++, tok, d: doubtOf(tok), cap, lead });
      lead = '';
    }
    s = Math.ceil(s / 8) * 8 + 8;                 // finish the bar, then one bar of groove alone
    answers.push({ cap, t0, t1: eighth(s) });
  });
  return { tokens, answers, bars: s / 8 + 1, duration: (s / 8 + 1) * 4 * BEAT + 2.5 };
}

export function render(captures) {
  const { tokens, bars, duration } = arrange(captures);
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n), R = new Float32Array(n);

  for (let b = 0; b < bars; b++) {
    const c = b % 4, t0 = b * 4 * BEAT;
    CHORDS[c].forEach((midi, k) => {
      rhodes(L, R, SR, { t: t0 + k * 0.012, midi, gain: 0.11, dur: 2.6 * BEAT, pan: -0.3 + k * 0.2 });
      rhodes(L, R, SR, { t: t0 + eighth(5) + k * 0.01, midi, gain: 0.07, dur: 1.2 * BEAT, pan: -0.3 + k * 0.2 });
    });
    bass(L, R, SR, { t: t0, midi: ROOTS[c], dur: 1.5 * BEAT, gain: 0.32 });
    bass(L, R, SR, { t: t0 + eighth(5), midi: ROOTS[c], dur: 0.4 * BEAT, gain: 0.26 });
    bass(L, R, SR, { t: t0 + 3 * BEAT, midi: FIFTHS[c], dur: 0.9 * BEAT, gain: 0.28 });
    kick(L, R, SR, { t: t0, gain: 0.55 });
    kick(L, R, SR, { t: t0 + eighth(5), gain: 0.42 });
    snare(L, R, SR, { t: t0 + BEAT, gain: 0.2, seed: 3 + b });
    snare(L, R, SR, { t: t0 + 3 * BEAT, gain: 0.2, seed: 41 + b });
    for (let e = 0; e < 8; e++) hat(L, R, SR, { t: t0 + eighth(e), gain: e % 2 ? 0.035 : 0.055, seed: 100 + b * 8 + e });
  }

  for (const { t, s, tok, d } of tokens) {
    const midi = MELODY[Math.floor(s / 8) % 4][s % 8];
    rhodes(L, R, SR, { t, midi, gain: 0.26, dur: 1.4 });
    for (const g of ghosts(tok, midi, d)) {
      rhodes(L, R, SR, { t: t + 0.006 * (g.k + 1), midi: g.midi, gain: 0.3 * g.gain, dur: 1.1, pan: g.pan, detune: g.detune });
    }
  }

  reverb(L, R, SR, 0.12);
  tape(L, R, SR, doubtCurve(tokens));
  master(L, R);
  return { left: L, right: R, sampleRate: SR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const out = args.pop();
  if (!args.length || !out?.endsWith('.wav')) {
    console.error('usage: node sonify.mjs <capture.json> [...] <out.wav>');
    process.exit(1);
  }
  const captures = args.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const audio = render(captures);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encodeWav(audio));
  console.log(`${(audio.left.length / SR).toFixed(1)} s → ${out}`);
}
