// A story file → the finished piece: captures laid on a composition, rendered to WAV or MP4.
// Usage: node story.mjs stories/neptune.json renders/neptune.wav
//        node story.mjs stories/neptune.json renders/neptune.mp4

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { encodeWav } from './lib/synth.js';

const COMPOSITIONS = { nocturne: () => import('./compositions/nocturne.js') };

export async function loadStory(file) {
  const story = JSON.parse(readFileSync(file, 'utf8'));
  const captures = story.items.map((it) => JSON.parse(readFileSync(it.capture, 'utf8')));
  const composition = await COMPOSITIONS[story.composition]();
  const tl = composition.arrange(story, captures);
  return { story, captures, composition, tl: { ...tl, story, captures } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, out] = process.argv.slice(2);
  if (!file || !/\.(wav|mp4)$/.test(out ?? '')) {
    console.error('usage: node story.mjs <story.json> <out.wav|out.mp4>');
    process.exit(1);
  }
  const { composition, tl } = await loadStory(file);
  mkdirSync(dirname(out), { recursive: true });
  const started = Date.now();
  if (out.endsWith('.wav')) {
    writeFileSync(out, encodeWav(composition.render(tl)));
  } else {
    const { renderStoryVideo } = await import('./render.mjs');
    await renderStoryVideo(tl, () => composition.render(tl), out);
  }
  console.log(`${tl.duration.toFixed(1)} s → ${out} (${((Date.now() - started) / 1000).toFixed(0)} s de rendu)`);
}
