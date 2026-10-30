// "Morceau": a test for the curious, on your own music, kept on your machine. The track plays
// untouched; each token takes 1/3 s and the measured doubt acts only through the cassette
// (same tape() as everywhere). No analysis, no extra notes: you hear your song cry when the
// model doubts.

import { spawnSync } from 'node:child_process';
import { master } from '../lib/synth.js';
import { tape } from '../lib/lofi.js';
import { isMarkup, doubtOf, doubtCurve } from '../lib/doubt.js';

const SR = 48000;
const STEP = 1 / 3, FADE_OUT = 3;

// opts: { file, start (seconds into the file) }
export function arrange(story, captures, opts) {
  const tokens = [], items = [];
  let t = 5.5;                                    // the song alone under the title cards
  const intro = { t0: 0, t1: t };
  captures.forEach((capture, cap) => {
    const q0 = t, t0 = (t += 2);
    let s = 0, lead = '';
    for (const tok of capture.tokens) {
      if (isMarkup(tok.tok)) { lead += tok.tok.replace(/\S/g, ''); continue; }
      tokens.push({ t: t0 + s * STEP, until: t0 + (s + 1.2) * STEP, s, tok, d: doubtOf(tok), cap, lead });
      lead = '';
      s++;
    }
    const v0 = (t = t0 + s * STEP + 0.4);
    t += 4;
    items.push({ cap, ...story.items[cap], q0, t0, t1: v0, v0, v1: t });
  });
  const outro = { t0: t, t1: t + 13.5 };
  const answers = items.map((it) => ({ cap: it.cap, q0: it.q0, t0: it.t0, t1: it.v1 }));
  return { tokens, items, answers, intro, outro, duration: outro.t1 + FADE_OUT, pulse: () => 0, music: opts };
}

export function render(tl) {
  const { file, start = 0 } = tl.music;
  const out = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 30 });
  if (out.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${out.stderr}`);
  const pcm = new Float32Array(out.stdout.buffer, out.stdout.byteOffset, out.stdout.byteLength / 4);
  const n = Math.ceil(tl.duration * SR);
  // Ignore the silence many files end with: the song stops where its last audible half second is.
  const win = SR / 2;
  let frames = pcm.length / 2;
  while (frames > win) {
    let e = 0;
    for (let i = frames - win; i < frames; i++) e += pcm[2 * i] ** 2 + pcm[2 * i + 1] ** 2;
    if (Math.sqrt(e / (2 * win)) > 0.005) break;  // about −46 dBFS
    frames -= win;
  }
  // The song must cover the whole story: start earlier rather than run past its end.
  const from = Math.max(0, Math.min(Math.round(start * SR), frames - n));
  if (from !== Math.round(start * SR)) {
    console.warn(frames < n
      ? `morceau plus court que l'histoire (${(frames / SR).toFixed(0)} s pour ${tl.duration.toFixed(0)} s) : il boucle`
      : `--start ${start} dépasserait la fin du morceau : départ avancé à ${(from / SR).toFixed(1)} s`);
  }
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = (from + i) % frames;                // loops only if the whole song is shorter than the story
    const g = Math.min(1, i / (0.3 * SR), (n - i) / (FADE_OUT * SR));
    L[i] = pcm[2 * j] * g;
    R[i] = pcm[2 * j + 1] * g;
  }
  tape(L, R, SR, doubtCurve(tl.tokens));
  master(L, R);
  return { left: L, right: R, sampleRate: SR };
}
