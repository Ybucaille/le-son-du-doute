// Lo-fi instruments and the cassette the whole mix plays through.
// Instruments never look at the data. Only tape() does, through a doubt curve d(t) in 0…1.

import { TAU, hz, noiseGen } from './synth.js';

const pan2 = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

// Electric piano: FM pair (ratio 1, index decaying) plus a short high tine, slow tremolo.
export function rhodes(L, R, sr, { t, midi, gain = 1, dur = 1.6, pan = 0, detune = 0 }) {
  const start = Math.round(t * sr);
  const len = Math.min(L.length - start, Math.round(dur * sr));
  if (len <= 0 || gain <= 0) return;
  const f = hz(midi) * 2 ** (detune / 1200);
  const [pl, pr] = pan2(pan);
  const ampK = Math.exp(-1 / (0.9 * sr)), idxK = Math.exp(-1 / (0.18 * sr)), tineK = Math.exp(-1 / (0.04 * sr));
  const rel = 0.05 * sr;
  let amp = 1, idx = 1, tine = 1;
  for (let i = 0; i < len; i++) {
    const ph = (TAU * f * i) / sr;
    const s = Math.sin(ph + (0.25 + 1.6 * idx) * Math.sin(ph)) + 0.12 * tine * Math.sin(ph * 14);
    const trem = 1 + 0.08 * Math.sin((TAU * 4.5 * i) / sr);
    const a = gain * amp * Math.min(1, i / (0.002 * sr), (len - i) / rel);
    amp *= ampK; idx *= idxK; tine *= tineK;
    L[start + i] += s * a * pl * trem;
    R[start + i] += s * a * pr * (2 - trem);
  }
}

// Round bass: sine with a touch of saturation and a soft pluck.
export function bass(L, R, sr, { t, midi, dur, gain = 1 }) {
  const start = Math.round(t * sr);
  const len = Math.min(L.length - start, Math.round(dur * sr));
  const f = hz(midi), k = Math.exp(-1 / (0.6 * sr)), rel = 0.03 * sr;
  let env = 1;
  for (let i = 0; i < len; i++) {
    const s = Math.tanh(1.8 * Math.sin((TAU * f * i) / sr)) * gain * (0.55 + 0.45 * env) * Math.min(1, i / (0.004 * sr), (len - i) / rel);
    env *= k;
    L[start + i] += s; R[start + i] += s;
  }
}

export function kick(L, R, sr, { t, gain = 1 }) {
  const start = Math.round(t * sr), len = Math.min(L.length - start, Math.round(0.4 * sr));
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / sr;
    ph += (TAU * (45 + 75 * Math.exp(-x / 0.03))) / sr;
    const s = Math.tanh(2 * Math.sin(ph)) * Math.exp(-x / 0.16) * gain;
    L[start + i] += s; R[start + i] += s;
  }
}

export function snare(L, R, sr, { t, gain = 1, seed = 3 }) {
  const start = Math.round(t * sr), len = Math.min(L.length - start, Math.round(0.3 * sr));
  const rand = noiseGen(seed), bp = 1 - Math.exp((-TAU * 1800) / sr);
  let lo = 0, prev = 0;
  for (let i = 0; i < len; i++) {
    const x = i / sr;
    lo += (rand() - lo) * bp;
    const band = lo - prev; prev = lo;            // crude band-pass: low-pass then differentiate
    const s = (band * 3.2 * Math.exp(-x / 0.09) + 0.4 * Math.sin(TAU * 185 * x) * Math.exp(-x / 0.05)) * gain;
    L[start + i] += s * 0.95; R[start + i] += s;
  }
}

export function hat(L, R, sr, { t, gain = 1, seed = 5 }) {
  const start = Math.round(t * sr), len = Math.min(L.length - start, Math.round(0.08 * sr));
  const rand = noiseGen(seed), hpR = Math.exp((-TAU * 7000) / sr);
  let hx = 0, hy = 0;
  for (let i = 0; i < len; i++) {
    const n = rand();
    hy = n - hx + hpR * hy; hx = n;
    const s = hy * Math.exp(-i / sr / 0.022) * gain;
    L[start + i] += s * 1.0; R[start + i] += s * 0.8;
  }
}

// Shared with the picture so the reels wobble exactly when and as much as the sound does.
// follow = seconds for the tape to react to a change of doubt.
export const TAPE = { wowHz: 0.8, flutterHz: 6.3, follow: 0.12 };

// The cassette. Wow/flutter is a modulated delay (pitch wobble), then saturation and a
// tape low-pass, then hiss and crackle. A small fixed hiss is always there; everything else
// is scaled by the doubt curve d(t), so when the model is sure the tape is clean.
export function tape(L, R, sr, d, { seed = 11 } = {}) {
  const n = L.length;
  const maxDelay = Math.ceil(0.03 * sr);
  const bufL = new Float32Array(n + maxDelay), bufR = new Float32Array(n + maxDelay);
  bufL.set(L, maxDelay); bufR.set(R, maxDelay);
  const rand = noiseGen(seed), crackRand = noiseGen(seed + 1);
  const base = 0.015 * sr;
  const wowDepth = 0.007 * sr, flutterDepth = 0.00012 * sr;  // ≈ 60 and 8 cents at d = 1
  let lpL1 = 0, lpL2 = 0, lpR1 = 0, lpR2 = 0, hissLp = 0, crack = 0, dd = 0, cut = 1;
  const follow = 1 - Math.exp(-1 / (TAPE.follow * sr));
  for (let i = 0; i < n; i++) {
    if (i % 32 === 0) var target = d(i / sr);
    dd += (target - dd) * follow;
    const x = i / sr;
    const delay = base + dd * (wowDepth * Math.sin(TAU * TAPE.wowHz * x) + flutterDepth * Math.sin(TAU * TAPE.flutterHz * x));
    const pos = i + maxDelay - delay;
    const j = Math.floor(pos), fr = pos - j;
    let l = bufL[j] + (bufL[j + 1] - bufL[j]) * fr;
    let r = bufR[j] + (bufR[j + 1] - bufR[j]) * fr;
    const drive = 1 + 2.5 * dd;
    l = Math.tanh(l * drive) / drive * (1 + 0.5 * dd);
    r = Math.tanh(r * drive) / drive * (1 + 0.5 * dd);
    if (i % 32 === 0) cut = 1 - Math.exp((-TAU * (9000 * (1 - dd) + 2200 * dd)) / sr);
    lpL1 += (l - lpL1) * cut; lpL2 += (lpL1 - lpL2) * cut;
    lpR1 += (r - lpR1) * cut; lpR2 += (lpR1 - lpR2) * cut;
    hissLp += (rand() - hissLp) * 0.35;
    const hiss = hissLp * (0.004 + 0.05 * dd ** 1.5);
    if (crackRand() > 1 - (0.00004 + 0.0008 * dd) * 2) crack = (crackRand() > 0 ? 1 : -1) * (0.05 + 0.25 * dd);
    crack *= 0.6;
    L[i] = lpL2 + hiss + crack;
    R[i] = lpR2 + hiss * 0.9 - crack * 0.7;
  }
}
