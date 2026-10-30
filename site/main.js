// The website player. It imports the very modules that render the video: the same score, the
// same doubt rule, the same cassette. The audio is rendered in a worker, the picture is drawn
// frame by frame by scene.js and locked to the audio clock.

import { arrange, pulse } from './compositions/nocturne.js';
import { frame, doubtTrack } from './lib/scene.js';
import { cassette } from './lib/companion.js';

const FPS = 60;
const stage = document.getElementById('stage');
const status = document.getElementById('status');
const list = document.getElementById('questions');
const hero = document.getElementById('hero-cassette');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The hero cassette has no data to read: it only turns its reels, its doubt stays at zero.
function drawHero(t) {
  hero.innerHTML = `<svg viewBox="-392 -252 784 504" xmlns="http://www.w3.org/2000/svg">${cassette({ t, dd: 0, doubtLabel: 'DOUTE 0,00' })}</svg>`;
}

// Stage before anything plays: the cassette waiting, no question, no answer.
const idle = {
  tokens: [], items: [], captures: [{ question: '' }], beatAt: () => 0,
  answers: [{ cap: 0, q0: Infinity, t0: Infinity, t1: Infinity }],
};
const drawIdle = (t) => { stage.innerHTML = frame(t, { ...idle, dd: 0 }); };

const [questions, captures] = await (async () => {
  const qs = await fetch('questions.json').then((r) => r.json());
  return [qs, await Promise.all(qs.map((q) => fetch(q.capture).then((r) => r.json())))];
})();

const buttons = questions.map((q, i) => {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.className = 'q';
  b.type = 'button';
  b.setAttribute('aria-pressed', 'false');
  b.innerHTML = `<span class="band"><span>Q${String(i + 1).padStart(2, '0')}</span>${q.video ? '<span class="tag">dans la vidéo</span>' : ''}</span>`
    + `<span class="text"></span><span class="verdict">verdict après écoute</span>`;
  b.querySelector('.text').textContent = q.short;
  b.addEventListener('click', () => play(i));
  li.append(b);
  list.append(li);
  return b;
});

// Audio, rendered once per question and kept.
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const rendered = new Map();
const pending = new Map();
worker.onmessage = ({ data }) => { pending.get(data.id)?.(data); pending.delete(data.id); };
const storyFor = (i) => ({ items: [{ ...questions[i], section: 1 }] });
function audioFor(i) {
  if (!rendered.has(i)) {
    rendered.set(i, new Promise((resolve) => {
      pending.set(i, resolve);
      worker.postMessage({ id: i, story: storyFor(i), capture: captures[i] });
    }));
  }
  return rendered.get(i);
}

let ctx = null, playing = null, heroOn = true;

async function play(i) {
  ctx ??= new AudioContext();
  await ctx.resume();
  playing?.source.stop();
  playing = null;
  buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  status.textContent = 'Rembobinage de la cassette…';

  const story = storyFor(i);
  const tl = arrange(story, [captures[i]], { intro: false, outro: false });
  const view = { ...tl, story, captures: [captures[i]], beatAt: pulse };
  const track = doubtTrack(tl.tokens, tl.duration, FPS);
  const audio = await audioFor(i);
  if (buttons[i].getAttribute('aria-pressed') !== 'true') return;  // another question was picked

  const buffer = ctx.createBuffer(2, audio.left.length, audio.sampleRate);
  buffer.copyToChannel(new Float32Array(audio.left), 0);
  buffer.copyToChannel(new Float32Array(audio.right), 1);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.05;
  source.start(t0);
  const me = { source };
  playing = me;
  status.textContent = `Qwen répond à « ${questions[i].short} »`;

  const item = tl.items[0];
  const tick = () => {
    if (playing !== me) return;
    const t = Math.max(0, ctx.currentTime - t0);
    stage.innerHTML = frame(t, { ...view, dd: track[Math.min(track.length - 1, Math.round(t * FPS))] });
    if (t >= item.v0 && !buttons[i].classList.contains('played')) {
      buttons[i].classList.add('played');
      buttons[i].querySelector('.verdict').textContent = `${questions[i].verdict} · ${questions[i].note}`;
      status.textContent = `${questions[i].verdict}. ${questions[i].note}`;
    }
    if (t < tl.duration) requestAnimationFrame(tick);
    else { playing = null; status.textContent += ' Choisissez une autre question, ou rejouez celle-ci.'; }
  };
  requestAnimationFrame(tick);
}

// Hero and idle stage keep turning while visible, unless the visitor asked for less motion.
const visible = new Set();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
});
io.observe(hero);
io.observe(stage);
let last = 0;
function idleLoop(now) {
  if (now - last > 1000 / 30) {
    last = now;
    const t = now / 1000;
    if (heroOn && visible.has(hero)) drawHero(t);
    if (!playing && !rendered.size && visible.has(stage)) drawIdle(t);
  }
  requestAnimationFrame(idleLoop);
}
drawHero(0.35);
drawIdle(0.35);
if (!reduced) requestAnimationFrame(idleLoop);
