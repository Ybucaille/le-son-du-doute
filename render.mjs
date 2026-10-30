// Captures → MP4: the lo-fi track and the living cassette, from one shared timeline.
// Usage: node render.mjs captures/a.json [captures/b.json …] out.mp4
// Memory: frames go to ffmpeg one at a time with backpressure, x264 runs with few threads and a
// short lookahead, and an explicit duration replaces -shortest (equation-sound-lab measured
// -shortest buffering 1.5 GB). Rendering pauses while less than 1.5 GB of RAM is available.

import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { render as renderAudio } from './sonify.mjs';
import { encodeWav } from './lib/synth.js';
import { frame, W, H } from './lib/scene.js';
import { timeline, withPicture, resvgOptions } from './lib/timeline.js';

const FPS = 30;
const LOW_MB = 1500;

const memAvailableMb = () => {
  const m = readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/);
  return m ? Number(m[1]) / 1024 : Infinity;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const renderVideo = (captures, outFile) => encode(timeline(captures, FPS), renderAudio(captures), outFile);

export async function renderStoryVideo(tl, renderStoryAudio, outFile) {
  const pulse = tl.pulse ?? (await import(`./compositions/${tl.story.composition}.js`)).pulse;
  return encode(withPicture(tl, FPS, pulse), renderStoryAudio(), outFile);
}

async function encode(tl, audio, outFile) {
  const wavFile = `${outFile}.tmp.wav`;
  writeFileSync(wavFile, encodeWav(audio));
  const frames = Math.ceil(tl.duration * FPS);

  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error', '-thread_queue_size', '4',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0',
    '-i', wavFile,
    '-vf', 'noise=alls=5,format=yuv420p',
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M',
    '-threads', '4', '-x264-params', 'rc-lookahead=12:sync-lookahead=0',
    '-c:a', 'aac', '-b:a', '256k',
    '-movflags', '+faststart', '-t', tl.duration.toFixed(3),
    outFile,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d; });
  ff.stdin.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${ffErr.slice(-800)}`))));
  });

  const started = Date.now();
  try {
    for (let i = 0; i < frames; i++) {
      if (i % 30 === 0) while (memAvailableMb() < LOW_MB) await sleep(500);
      const t = i / FPS;
      const pixels = new Resvg(frame(t, { ...tl, dd: tl.ddAt(t) }), resvgOptions).render().pixels;
      if (!ff.stdin.write(pixels)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`\r${i}/${frames} images`);
    }
    ff.stdin.end();
    await done;
  } finally {
    rmSync(wavFile, { force: true });
  }
  process.stdout.write(`\r${frames}/${frames} images en ${((Date.now() - started) / 1000).toFixed(0)} s\n`);
  return { file: outFile, duration: tl.duration, frames };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const out = args.pop();
  if (!args.length || !out?.endsWith('.mp4')) {
    console.error('usage: node render.mjs <capture.json> [...] <out.mp4>');
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  const r = await renderVideo(args.map((f) => JSON.parse(readFileSync(f, 'utf8'))), out);
  console.log(`${r.duration.toFixed(1)} s → ${r.file}`);
}
