// One 1080×1350 (4:5) frame: the question, the living cassette, the words the model almost
// said floating around it, and the answer typed token by token, coloured by its doubt.

import { cassette } from './companion.js';
import { TAPE } from './lofi.js';
import { tokenAt } from './doubt.js';

export const W = 1080, H = 1350;
const BG = '#241c2b', CREAM = '#f3e9d7', HOT = [255, 106, 77];
const ANSWER_SIZE = 46, ANSWER_CHARS = 34, ANSWER_LINE = 64;
const GHOST_SLOTS = [[-260, -290], [270, -285], [-330, 300], [340, 305]];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mix = (d) => {
  const c = [243, 233, 215].map((v, i) => Math.round(v + (HOT[i] - v) * Math.min(1, d * 1.4)));
  return `rgb(${c.join(',')})`;
};

// Smoothed doubt per frame, the same one-pole follower the tape applies per sample.
export function doubtTrack(tokens, duration, fps) {
  const n = Math.ceil(duration * fps), out = new Float32Array(n);
  const k = 1 - Math.exp(-1 / (TAPE.follow * fps));
  let dd = 0;
  for (let i = 0; i < n; i++) {
    dd += ((tokenAt(tokens, i / fps)?.d ?? 0) - dd) * k;
    out[i] = dd;
  }
  return out;
}

// Tokens are word pieces ("Me", "aul", "nes"): group them into words, then break lines
// between words only. Each piece keeps its own doubt colour.
function wrap(tokens) {
  const words = [];
  for (const tk of tokens) {
    const text = (tk.lead + tk.tok.tok).replace(/\n/g, ' ');
    if (!words.length || /^\s/.test(text)) words.push([]);
    words[words.length - 1].push({ ...tk, text });
  }
  const lines = [[]];
  let len = 0;
  for (const word of words) {
    const wlen = word.reduce((n, p) => n + p.text.length, 0);
    if (len + wlen > ANSWER_CHARS && len > 0) {
      word[0] = { ...word[0], text: word[0].text.trimStart() };
      lines.push([...word]);
      len = wlen;
    } else {
      lines[lines.length - 1].push(...word);
      len += wlen;
    }
  }
  return lines;
}

function wrapWords(text, chars) {
  const lines = [''];
  for (const w of text.split(' ')) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > chars && cur) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines;
}

// Story cards (intro, outro): lines that appear at given times. Composed, never data.
function cards(out, lines, t) {
  for (const { text, at, y, size, weight = 700, opacity = 1, fade = 0 } of lines) {
    if (t < at) continue;
    const a = fade ? Math.min(1, (t - at) / fade) : 1;
    wrapWords(text, Math.floor(1700 / size)).forEach((line, i) => {
      out.push(`<text x="${W / 2}" y="${y + i * size * 1.18}" text-anchor="middle" font-family="Space Grotesk" font-weight="${weight}" font-size="${size}" fill="${CREAM}" opacity="${(a * opacity).toFixed(2)}">${esc(line)}</text>`);
    });
  }
}

// VRAI / FAUX stamped across the cassette, slammed down, with the real answer under it.
function verdict(out, item, t) {
  const age = t - item.v0;
  if (age < 0) return;
  const ink = { VRAI: '#8fdc97', FAUX: '#ff5a4e' }[item.verdict] ?? '#f2a65a';
  const k = Math.min(1, age / 0.12);
  const scale = 1.7 - 0.7 * k * k;
  const size = item.verdict.length > 5 ? 104 : 150, half = Math.max(230, item.verdict.length * size * 0.36 + 50);
  out.push(`<g transform="translate(${W / 2} 540) rotate(-9) scale(${scale.toFixed(3)})" opacity="${k.toFixed(2)}">`
    + `<rect x="${-half}" y="-92" width="${2 * half}" height="184" rx="22" fill="${BG}" fill-opacity="0.55" stroke="${ink}" stroke-width="14"/>`
    + `<text y="${size * 0.35}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${size}" fill="${ink}" letter-spacing="8">${esc(item.verdict)}</text></g>`);
  const na = Math.max(0, Math.min(1, (age - 0.35) / 0.3));
  wrapWords(item.note, 40).forEach((line, i) => {
    out.push(`<text x="${W / 2}" y="${880 + i * 46}" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="36" fill="${CREAM}" opacity="${na.toFixed(2)}">${esc(line)}</text>`);
  });
}

export function frame(t, { tokens, answers, captures, dd, beatAt, intro, outro, items, story }) {
  const inIntro = intro && t < intro.t1, inOutro = outro && t >= outro.t0;
  const inStory = !inIntro && !inOutro;
  const answer = answers.find((a) => t < a.t1) ?? answers[answers.length - 1];
  const cap = captures[answer.cap];
  const shown = inStory ? tokens.filter((tk) => tk.cap === answer.cap && tk.t <= t) : [];
  const current = inStory ? tokenAt(tokens, t) : null;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#3a2d42"/><stop offset="1" stop-color="${BG}"/></radialGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>`];

  // question, appearing during the bar before its answer (lo-fi: 2.6 s before)
  const qa = inStory ? Math.max(0, Math.min(1, (t - (answer.q0 ?? answer.t0 - 2.6)) / 0.4)) : 0;
  if (qa > 0) wrapWords(cap.question.replace(/ ([?!:;»])/g, "\u00a0$1"), 38).forEach((line, i) => {
    out.push(`<text x="${W / 2}" y="${118 + i * 52}" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="40" fill="${CREAM}" opacity="${(qa * 0.85).toFixed(2)}">${esc(line)}</text>`);
  });

  // the cassette
  const totalTok = tokens.filter((tk) => tk.cap === answer.cap).length;
  const ghosts = current?.cap === answer.cap ? current.tok.alts.slice(0, GHOST_SLOTS.length) : [];
  const lookAt = ghosts.length && dd > 0.15 ? GHOST_SLOTS[current.s % ghosts.length] : [0, 0];
  const gaze = [Math.sign(lookAt[0]) * Math.min(1, dd * 2.2), Math.sign(lookAt[1]) * Math.min(1, dd * 2.2) * 0.8];
  out.push(`<g transform="translate(${W / 2} 560)">`);
  out.push(cassette({
    t, dd, gaze, beat: beatAt(t), progress: totalTok ? shown.length / totalTok : 0,
    doubtLabel: `DOUTE ${dd.toFixed(2).replace('.', ',')}`,
  }));

  // the words it almost said: as visible as the model believed in them
  if (current?.cap === answer.cap) {
    const age = t - current.t;
    ghosts.forEach((g, k) => {
      const [gx, gy] = GHOST_SLOTS[k];
      const op = Math.min(1, age / 0.08) * Math.min(1, g.p ** 0.6 * 1.5);
      if (g.p < 0.05 || !g.tok.trim()) return;
      const size = Math.round(30 + 34 * g.p);
      out.push(`<text x="${gx}" y="${gy + Math.sin(t * 2 + k) * 6}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${size}" fill="${CREAM}" opacity="${op.toFixed(2)}">${esc(g.tok.trim())}<tspan font-size="${Math.round(size * 0.55)}" font-weight="500"> ${Math.round(g.p * 100)} %</tspan></text>`);
    });
  }
  out.push('</g>');

  // the answer so far, each token in its own doubt colour
  const lines = wrap(shown);
  const top = lines.length > 3 ? 1036 : 1066;
  lines.forEach((line, i) => {
    const spans = line.map((tk) => {
      const op = Math.min(1, (t - tk.t) / 0.07);
      return `<tspan fill="${mix(tk.d)}" opacity="${op.toFixed(2)}">${esc(tk.text).replace(/ /g, '\u00a0')}</tspan>`;
    });
    out.push(`<text x="70" y="${top + i * ANSWER_LINE}" font-family="JetBrains Mono" font-weight="600" font-size="${ANSWER_SIZE}">${spans.join('')}</text>`);
  });

  const item = items?.find((it) => it.cap === answer.cap);
  if (item && inStory && t >= item.v0) verdict(out, item, t);

  if (inIntro) {
    cards(out, story.intro.map((text, i) => ({ text, at: 0.4 + i * 2.2, y: 1080 + i * 80, size: 58 })), t);
  }
  if (inOutro) {
    const o = t - outro.t0, [a, b, c, d] = story.outro;
    if (o < 7.4) {
      cards(out, [
        { text: a, at: 0.2, y: 960, size: 54, fade: 0.5 },
        { text: b, at: 3.0, y: 1060, size: 54, fade: 0.5 },
      ], o);
    } else {
      cards(out, [{ text: c, at: 7.4, y: 1040, size: 76 }, { text: d, at: 9.6, y: 1150, size: 76 }], o);
    }
  }
  if (inOutro && t - outro.t0 > 11) {
    wrapWords(story.footer, 48).forEach((line, i, all) => {
      out.push(`<text x="${W / 2}" y="${H - 48 - (all.length - 1 - i) * 32}" text-anchor="middle" font-family="JetBrains Mono" font-size="22" fill="${CREAM}" opacity="0.55">${esc(line)}</text>`);
    });
  } else if (!inOutro) {
    out.push(`<text x="70" y="${H - 48}" font-family="JetBrains Mono" font-size="22" fill="${CREAM}" opacity="0.45">blanc = sûr · orange = doute · fantômes = mots envisagés</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
