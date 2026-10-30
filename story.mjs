// A story file → the finished piece: captures laid on a composition, rendered to WAV or MP4.
// Usage: node story.mjs stories/neptune.json renders/neptune.mp4        (or .wav for sound only)
//        node story.mjs stories/test-musique.json renders/x.mp4 --track ~/Music/morceau.mp3 [--start 12]
// --track lays the story on your own music instead of the composed score (only the cassette reacts).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { encodeWav } from './lib/synth.js';

const COMPOSITIONS = {
  nocturne: () => import('./compositions/nocturne.js'),
  track: () => import('./compositions/track.js'),
};

export async function loadStory(file, track = null) {
  const story = JSON.parse(readFileSync(file, 'utf8'));
  const captures = story.items.map((it) => JSON.parse(readFileSync(it.capture, 'utf8')));
  const composition = await COMPOSITIONS[track ? 'track' : story.composition]();
  const tl = composition.arrange(story, captures, track ?? undefined);
  return { story, captures, composition, tl: { ...tl, story, captures } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals: [file, out] } = parseArgs({
    allowPositionals: true,
    options: { track: { type: 'string' }, start: { type: 'string' } },
  });
  if (!file || !/\.(wav|mp4)$/.test(out ?? '')) {
    console.error('usage: node story.mjs <story.json> <out.wav|out.mp4> [--track morceau.mp3 [--start s]]');
    process.exit(1);
  }
  const track = values.track ? { file: values.track, start: Number(values.start ?? 0) } : null;
  const { composition, tl } = await loadStory(file, track);
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
