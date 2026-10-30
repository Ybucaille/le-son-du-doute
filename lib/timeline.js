// Everything the picture needs, built from the same arrangement the sound is rendered from.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arrange, BEAT, eighth } from '../sonify.mjs';
import { doubtTrack } from './scene.js';

export const FONT_DIR = fileURLToPath(new URL('../fonts/', import.meta.url));
export const resvgOptions = {
  font: {
    loadSystemFonts: false,
    fontFiles: readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')).map((f) => FONT_DIR + f),
    defaultFontFamily: 'Space Grotesk',
  },
};

// Kick pulse 0…1 (composed, not data): the cassette bobs on the downbeat and the "and" of 3.
function beatAt(t) {
  const bar = 4 * BEAT, inBar = t % bar;
  const since = inBar >= eighth(5) ? inBar - eighth(5) : inBar;
  return Math.exp(-since / 0.12);
}

// Adds what only the picture needs: the smoothed doubt per frame and the composed pulse.
export function withPicture(tl, fps, pulse) {
  const track = doubtTrack(tl.tokens, tl.duration, fps);
  return { ...tl, fps, beatAt: pulse, ddAt: (t) => track[Math.min(track.length - 1, Math.max(0, Math.round(t * fps)))] };
}

export function timeline(captures, fps = 30) {
  return withPicture({ ...arrange(captures), captures }, fps, beatAt);
}
