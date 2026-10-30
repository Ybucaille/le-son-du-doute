// Chamber instruments for the nocturne. Additive synthesis with rotating phasors (one complex
// multiply per partial per sample) so a hundred-second piece renders in seconds.

import { TAU, hz, noiseGen } from './synth.js';

const pan2 = (p) => {
  const c = Math.max(-1, Math.min(1, p));
  return [Math.cos(((c + 1) * Math.PI) / 4), Math.sin(((c + 1) * Math.PI) / 4)];
};

// Piano: two slightly detuned strings, stretched (inharmonic) partials that die faster the
// higher they are, a short hammer thump, and a damper when the pedal lifts (after `dur`).
// vel 0…1 shapes the brightness, gain the level.
export function piano(L, R, sr, { t, midi, vel = 0.6, gain = 1, dur = 1.5, pan = 0, detune = 0, seed = 1 }) {
  const start = Math.round(t * sr);
  const hold = Math.round(dur * sr), damp = Math.round(0.18 * sr);
  const len = Math.min(L.length - start, hold + damp);
  if (len <= 0 || gain <= 0) return;
  const f0 = hz(midi) * 2 ** (detune / 1200);
  const B = 0.0004;
  const tau1 = Math.max(0.7, Math.min(7, 4.5 * (130 / f0) ** 0.6));
  const [pl, pr] = pan2(pan + (midi - 62) / 50);
  const parts = [];
  for (let n = 1; n <= 12; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > 10000) break;
    const amp = (1 / n ** 1.15) * Math.exp(-(n - 1) * (1 - vel) * 0.55);
    const k = Math.exp(-1 / ((tau1 / (1 + 0.38 * (n - 1))) * sr));
    for (const [s, beat] of [[0, 1], [1, 1.00035]]) {
      const w = (TAU * fn * beat) / sr;
      const ph = s ? 0.3 : 0;
      parts.push({ c: Math.cos(w), s: Math.sin(w), x: Math.cos(ph), y: Math.sin(ph), amp: amp * 0.5, env: 1, k });
    }
  }
  const rand = noiseGen(seed);
  let hn = 0;
  const hammerLen = 0.006 * sr, dampK = Math.exp(-1 / (0.05 * sr));
  let dampEnv = 1;
  const g = gain * (0.35 + 0.65 * vel);
  for (let i = 0; i < len; i++) {
    let v = 0;
    for (const p of parts) {
      const nx = p.x * p.c - p.y * p.s;
      p.y = p.x * p.s + p.y * p.c;
      p.x = nx;
      v += p.y * p.amp * p.env;
      p.env *= p.k;
    }
    if (i < hammerLen) { hn += (rand() - hn) * 0.3; v += hn * 0.25 * vel * (1 - i / hammerLen); }
    if (i >= hold) dampEnv *= dampK;
    const a = v * g * dampEnv * Math.min(1, i / 24);
    L[start + i] += a * pl;
    R[start + i] += a * pr;
  }
}

// Bowed strings: band-limited saw-like additive tone, a few detuned players, slow bow attack,
// optional vibrato. Used for the string pad (several notes) and the cello counter-melody.
export function bowed(L, R, sr, { t, dur, midi, gain = 1, attack = 0.5, release = 0.9, players = 3, vibrato = 0, pan = 0, bright = 6 }) {
  const start = Math.round(t * sr);
  const len = Math.min(L.length - start, Math.round((dur + release) * sr));
  if (len <= 0 || gain <= 0) return;
  const f0 = hz(midi);
  const voices = [];
  for (let v = 0; v < players; v++) {
    const cents = players === 1 ? 0 : (v / (players - 1) - 0.5) * 14;
    const [pl, pr] = pan2(pan + (players === 1 ? 0 : (v / (players - 1) - 0.5) * 0.8));
    const parts = [];
    for (let n = 1; n <= 14 && n * f0 < 7000; n++) parts.push({ n, x: 1, y: 0, amp: Math.exp(-n / bright) / n });
    voices.push({ f: f0 * 2 ** (cents / 1200), pl, pr, parts, vph: v * 1.7 });
  }
  const atk = attack * sr, rel = release * sr, hold = dur * sr;
  for (let i = 0; i < len; i += 32) {
    const x = i / sr;
    for (const vo of voices) {
      const fv = vo.f * (1 + vibrato * 0.007 * Math.sin(TAU * 5.2 * x + vo.vph) * Math.min(1, x / 0.6));
      for (const p of vo.parts) { const w = (TAU * fv * p.n) / sr; p.c = Math.cos(w); p.s = Math.sin(w); }
      for (let j = i; j < Math.min(len, i + 32); j++) {
        let v = 0;
        for (const p of vo.parts) {
          const nx = p.x * p.c - p.y * p.s;
          p.y = p.x * p.s + p.y * p.c;
          p.x = nx;
          v += p.y * p.amp;
        }
        const env = Math.min(1, j / atk) * (j > hold ? Math.max(0, 1 - (j - hold) / rel) : 1);
        const a = v * env * gain / players;
        L[start + j] += a * vo.pl;
        R[start + j] += a * vo.pr;
      }
    }
  }
}
