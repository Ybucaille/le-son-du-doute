// "Nocturne de 1846": a romantic piano nocturne in 6/8, A♭ major / F minor, for the Neptune
// story. Everything here is composed in advance and identical whatever the model answers:
// the harmony of each section, the left-hand arpeggios, the layers (bass octaves, strings,
// cello), and a written right-hand line where each generated token plays the next note.
// The measured doubt acts only through lib/doubt.js (ghost notes) and the tape, as in lo-fi.

import { reverb, master } from '../lib/synth.js';
import { piano, bowed } from '../lib/piano.js';
import { tape } from '../lib/lofi.js';
import { isMarkup, doubtOf, doubtCurve, ghosts } from '../lib/doubt.js';

const SR = 48000;
export const EIGHTH = 60 / 63 / 3;                // dotted quarter = 63
export const BAR = 6 * EIGHTH;

// bass, three arpeggio tones (left hand), six melody notes (right hand, one per eighth)
const C = {
  Ab:     { bass: 44, tones: [51, 56, 60], mel: [75, 72, 73, 68, 72, 75] },
  Fm:     { bass: 41, tones: [48, 53, 56], mel: [77, 72, 73, 68, 72, 77] },
  Db:     { bass: 37, tones: [44, 49, 53], mel: [77, 73, 75, 72, 73, 68] },
  Eb7:    { bass: 39, tones: [46, 49, 55], mel: [79, 75, 73, 70, 73, 75] },
  Bbm:    { bass: 34, tones: [41, 46, 49], mel: [77, 73, 72, 70, 73, 77] },
  C7:     { bass: 36, tones: [43, 46, 52], mel: [79, 76, 77, 72, 70, 67] },
  Dbmaj7: { bass: 37, tones: [44, 48, 53], mel: [80, 77, 75, 72, 73, 77] },
  Bbm7:   { bass: 34, tones: [41, 44, 49], mel: [80, 77, 73, 72, 70, 73] },
  C7b9:   { bass: 36, tones: [43, 46, 49], mel: [79, 76, 73, 72, 70, 67] },
  AbC:    { bass: 36, tones: [44, 48, 51], mel: [75, 72, 73, 68, 72, 75] },
  Ebsus:  { bass: 39, tones: [46, 51, 56], mel: [80, 75, 70, 75, 73, 70] },
  Csus:   { bass: 36, tones: [43, 48, 53], mel: [77, 72, 67, 72, 77, 79] },
};

// One section per story item, in order. The music builds with the story: calm, then the bass,
// the strings, the climax with the cello, a deceptively calm return, and a suspended end.
const INTRO = { loop: ['Ab', 'Db', 'Eb7'], lh: 0.5 };
const SECTIONS = [
  { loop: ['Ab', 'Fm', 'Db', 'Eb7'], lh: 0.5 },
  { loop: ['Ab', 'Fm', 'Db', 'Eb7'], lh: 0.55, octave: 0.4 },
  { loop: ['Fm', 'Db', 'Bbm', 'C7'], lh: 0.6, octave: 0.45, strings: 0.05 },
  { loop: ['Fm', 'Dbmaj7', 'Bbm7', 'C7b9'], lh: 0.7, octave: 0.55, strings: 0.08, cello: 0.09, rh: 0.72 },
  { loop: ['Ab', 'Fm', 'Db', 'Eb7'], lh: 0.45, strings: 0.035 },
  { loop: ['Db', 'AbC', 'Bbm', 'Ebsus'], lh: 0.55, octave: 0.4, strings: 0.06 },
];
const OUTRO = { loop: ['Fm', 'Db', 'Bbm', 'Fm', 'Db', 'Bbm', 'Csus'], lh: 0.5, strings: 0.06, cello: 0.06 };
const QUESTION_BARS = 1, VERDICT_BARS = 2, RING = 4.5;

// Lay the story on the bar grid. Returns the timeline shared with the picture.
// The website player plays one question alone: { intro: false, outro: false }, and an item may
// pick its section ("section": 1) so every question gets exactly the same music.
export function arrange(story, captures, { intro: withIntro = true, outro: withOutro = true } = {}) {
  const bars = [];                                // { t, chord, sec, role, item }
  const tokens = [];                              // { t, until, s, tok, d, cap, lead, midi, sec }
  const items = [];
  const push = (chord, sec, role, item) => bars.push({ t: bars.length * BAR, chord, sec, role, item });

  if (withIntro) INTRO.loop.forEach((c) => push(c, INTRO, 'intro'));
  const intro = withIntro ? { t0: 0, t1: bars.length * BAR } : null;
  captures.forEach((capture, cap) => {
    const sec = SECTIONS[story.items[cap].section ?? Math.min(cap, SECTIONS.length - 1)];
    const words = capture.tokens.filter((x) => !isMarkup(x.tok));
    const answerBars = Math.ceil(words.length / 6);
    const first = bars.length;
    for (let b = 0; b < QUESTION_BARS + answerBars + VERDICT_BARS; b++) {
      const role = b < QUESTION_BARS ? 'question' : b < QUESTION_BARS + answerBars ? 'answer' : 'verdict';
      push(sec.loop[b % sec.loop.length], sec, role, cap);
    }
    const t0 = (first + QUESTION_BARS) * BAR;
    let s = 0, lead = '';
    for (const tok of capture.tokens) {
      if (isMarkup(tok.tok)) { lead += tok.tok.replace(/\S/g, ''); continue; }
      const bar = bars[first + QUESTION_BARS + Math.floor(s / 6)];
      const t = t0 + s * EIGHTH;
      tokens.push({ t, until: t + EIGHTH * 1.2, s, tok, d: doubtOf(tok), cap, lead, midi: C[bar.chord].mel[s % 6], sec });
      lead = '';
      s++;
    }
    const v0 = (first + QUESTION_BARS + answerBars) * BAR;
    items.push({ cap, ...story.items[cap], q0: first * BAR, t0, t1: v0, v0, v1: bars.length * BAR });
  });
  const o0 = bars.length * BAR;
  if (withOutro) OUTRO.loop.forEach((c) => push(c, OUTRO, 'outro'));
  const outro = withOutro ? { t0: o0, t1: bars.length * BAR } : null;
  // the picture still calls them "answers": the span where an item's text is on screen
  const answers = items.map((it) => ({ cap: it.cap, q0: it.q0, t0: it.t0, t1: it.v1 }));
  return { bars, tokens, items, answers, intro, outro, duration: bars.length * BAR + RING };
}

// Composed pulse 0…1 for the picture: a soft sway on each dotted-quarter beat.
export const pulse = (t) => 0.6 * Math.exp(-(t % (3 * EIGHTH)) / 0.18);

export function render(tl) {
  const n = Math.ceil(tl.duration * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const last = tl.bars.length - 1;

  tl.bars.forEach((bar, b) => {
    const ch = C[bar.chord], sec = bar.sec;
    const end = b === last ? RING : BAR;          // the last chord is held and left unresolved
    const arp = [ch.bass, ...ch.tones, ch.tones[1], ch.tones[0]];
    arp.forEach((midi, e) => {
      if (b === last && e > 3) return;
      piano(L, R, SR, { t: bar.t + e * EIGHTH, midi, vel: sec.lh, gain: 0.32 * (e ? 0.8 : 1), dur: end - e * EIGHTH, seed: b * 7 + e });
    });
    if (sec.octave) piano(L, R, SR, { t: bar.t, midi: ch.bass - 12, vel: sec.octave, gain: 0.28, dur: end, seed: b * 7 + 6 });
    if (sec.strings) {
      ch.tones.forEach((midi, k) => bowed(L, R, SR, { t: bar.t, dur: end, midi: midi + 12, gain: sec.strings, attack: 0.6, release: 1.0, pan: -0.4 + 0.4 * k }));
    }
    if (sec.cello) {
      [ch.tones[2], ch.tones[1]].forEach((midi, k) => bowed(L, R, SR, {
        t: bar.t + k * 3 * EIGHTH, dur: (b === last ? RING : 3 * EIGHTH) - 0.05, midi, gain: sec.cello,
        players: 1, attack: 0.12, release: 0.4, vibrato: 1, pan: 0.25, bright: 5,
      }));
    }
  });

  for (const { t, tok, d, midi, sec } of tl.tokens) {
    const vel = sec.rh ?? 0.62;
    piano(L, R, SR, { t, midi, vel, gain: 0.42, dur: 1.1, seed: 900 + midi });
    for (const g of ghosts(tok, midi, d)) {
      piano(L, R, SR, { t: t + 0.006 * (g.k + 1), midi: g.midi, vel, gain: 0.42 * 1.15 * g.gain, dur: 0.9, pan: g.pan, detune: g.detune, seed: 950 + g.k });
    }
  }

  reverb(L, R, SR, 0.26);
  tape(L, R, SR, doubtCurve(tl.tokens));
  master(L, R);
  return { left: L, right: R, sampleRate: SR };
}
