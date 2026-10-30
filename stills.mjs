// Renders a few PNG stills to check the look without a full video render.
// Usage: node stills.mjs out-dir captures/a.json [...] -- "Fournier" "Woodward" "té"
// Each word after -- picks the moment that token is sung; with none, picks least/mid/most doubt.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { timeline, resvgOptions } from './lib/timeline.js';
import { frame } from './lib/scene.js';

const args = process.argv.slice(2);
const sep = args.indexOf('--');
const [outDir, ...files] = sep < 0 ? args : args.slice(0, sep);
const words = sep < 0 ? [] : args.slice(sep + 1);
const tl = timeline(files.map((f) => JSON.parse(readFileSync(f, 'utf8'))));

let moments = words.map((w) => tl.tokens.find((tk) => tk.tok.tok.includes(w)));
if (!words.length) {
  const sorted = [...tl.tokens].sort((a, b) => a.d - b.d);
  moments = [sorted[0], sorted[sorted.length >> 1], sorted[sorted.length - 1]];
}
mkdirSync(outDir, { recursive: true });
moments.forEach((tk, i) => {
  if (!tk) { console.error(`no token matches "${words[i]}"`); return; }
  const t = tk.t + 0.25;                            // a beat after the token, once the tape reacted
  const svg = frame(t, { ...tl, dd: tl.ddAt(t) });
  const file = `${outDir}/still-${i + 1}-${tk.tok.tok.trim().replace(/[^\p{L}\p{N}]+/gu, '') || 'x'}.png`;
  writeFileSync(file, new Resvg(svg, resvgOptions).render().asPng());
  console.log(`${file}  token "${tk.tok.tok}" doute ${tk.d.toFixed(2)} (lissé ${tl.ddAt(t).toFixed(2)})`);
});
