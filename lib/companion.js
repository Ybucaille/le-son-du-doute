// The living cassette. Its reels are its eyes. Every expression is a function of the same
// smoothed doubt `dd` the tape hears, plus time for the motion that never depends on data
// (reels turning, bobbing on the kick). Nothing is keyframed by hand.

import { TAPE } from './lofi.js';

const TAU = Math.PI * 2;
export const INK = '#2a2030';
const BODY = '#eadcc3', LABEL = '#e8755a', STRIPE = '#f2a65a', TAPEC = '#5b4636', EYE = '#f7f1e6';

const f = (v) => (Math.round(v * 10) / 10).toString();
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// gaze: [-1…1, -1…1], where the pupils look. progress 0…1 moves tape from left to right reel.
export function cassette({ t, dd, gaze = [0, 0], progress = 0.3, beat = 0, doubtLabel = '' }) {
  const wow = Math.sin(TAU * TAPE.wowHz * t), flutter = Math.sin(TAU * TAPE.flutterHz * t);
  const tilt = 4 * dd * wow;
  const jx = 5 * dd * dd * flutter, jy = 3 * dd * dd * Math.cos(TAU * TAPE.flutterHz * t);
  const bob = 1 + 0.012 * beat;
  const spin = t * 140 + 30 * dd * wow;             // degrees; wow makes the reels lurch
  const squint = 0.12 + 0.5 * dd;                   // fraction of each eye covered by the lid
  const out = [];

  out.push(`<g transform="translate(${f(jx)} ${f(jy)}) rotate(${f(tilt)}) scale(${bob.toFixed(4)})">`);
  out.push(tapeSpill(t, dd));
  out.push(`<rect x="-380" y="-240" width="760" height="480" rx="34" fill="${BODY}" stroke="${INK}" stroke-width="7"/>`);
  for (const [sx, sy] of [[-344, -204], [344, -204], [-344, 204], [344, 204]]) {
    out.push(`<circle cx="${sx}" cy="${sy}" r="11" fill="#bfae92" stroke="${INK}" stroke-width="3"/>`,
      `<path d="M${sx - 6} ${sy}h12M${sx} ${sy - 6}v12" stroke="${INK}" stroke-width="3"/>`);
  }
  out.push(`<rect x="-322" y="-208" width="644" height="262" rx="18" fill="${LABEL}" stroke="${INK}" stroke-width="5"/>`,
    `<rect x="-322" y="-208" width="644" height="46" rx="18" fill="${STRIPE}" stroke="${INK}" stroke-width="5"/>`,
    `<text x="-294" y="-175" font-family="JetBrains Mono" font-weight="600" font-size="24" fill="${INK}">QWEN 3.5 · 4B</text>`,
    `<text x="294" y="-175" text-anchor="end" font-family="JetBrains Mono" font-weight="600" font-size="24" fill="${INK}">${doubtLabel}</text>`);

  // eyebrows: relaxed arch when sure, inner ends lifted (worried) with doubt
  for (const side of [-1, 1]) {
    const x0 = side * 215, x1 = side * 85;
    const inner = -150 - 26 * dd, outer = -146 + 8 * dd, mid = -160 + 6 * dd;
    out.push(`<path d="M${x0} ${f(outer)}Q${side * 150} ${f(mid)} ${x1} ${f(inner)}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`);
  }

  out.push(`<rect x="-262" y="-122" width="524" height="156" rx="78" fill="${INK}"/>`);
  const left = 66 - 16 * progress, right = 50 + 16 * progress;  // tape packs
  [[-150, left], [150, right]].forEach(([ex, pack], k) => {
    out.push(`<circle cx="${ex}" cy="-44" r="${f(pack)}" fill="${TAPEC}"/>`);
    out.push(eye(ex, -44, gaze, spin + k * 30, squint, k));
  });

  // mouth: a smile that flattens, then trembles into a wave as doubt rises
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 12 - 1, x = u * 92;
    const smile = (1 - u * u) * 34 * (1 - 1.5 * dd);
    const wave = 13 * dd * Math.sin(u * 3 * Math.PI + t * 9);
    pts.push(`${f(x)} ${f(98 + smile + wave)}`);
  }
  out.push(`<path d="M${pts.join('L')}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`);

  out.push(`<path d="M-232 240L-192 150H192L232 240" fill="#d6c6a9" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`);
  for (const hx of [-150, -60, 60, 150]) out.push(`<circle cx="${hx}" cy="200" r="11" fill="${INK}"/>`);
  if (dd > 0.5) {
    const a = clamp01((dd - 0.5) / 0.25), y = -250 + 18 * ((t * 1.3) % 1);
    out.push(`<path d="M372 ${f(y)}c-12 18-18 28-18 38a18 18 0 0 0 36 0c0-10-6-20-18-38z" fill="#9bd0ec" stroke="${INK}" stroke-width="4" opacity="${a.toFixed(2)}"/>`);
  }
  out.push('</g>');
  return out.join('');
}

function eye(cx, cy, [gx, gy], spin, squint, k) {
  const r = 40, id = `eye${k}`;
  const px = cx + gx * 13, py = cy + gy * 11;
  const teeth = [];
  for (let i = 0; i < 6; i++) {
    const a = ((spin + i * 60) * Math.PI) / 180;
    teeth.push(`<rect x="-4" y="-21" width="8" height="9" rx="2" fill="${EYE}" transform="translate(${f(px)} ${f(py)}) rotate(${f((a * 180) / Math.PI)})"/>`);
  }
  const lid = cy - r + 2 * r * squint;
  const tiltIn = (k === 0 ? 1 : -1) * 10 * squint;   // inner corner of the lid sits a bit higher
  return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`
    + `<g clip-path="url(#${id})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${EYE}"/>`
    + `<circle cx="${f(px)}" cy="${f(py)}" r="21" fill="${INK}"/>${teeth.join('')}`
    + `<path d="M${cx - r - 4} ${cy - r - 4}H${cx + r + 4}V${f(lid - tiltIn)}L${cx - r - 4} ${f(lid + tiltIn)}Z" fill="${LABEL}" stroke="${INK}" stroke-width="5"/></g>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="5"/>`;
}

// Tape spilling out of the bottom when the model really doubts, a loop that writhes.
function tapeSpill(t, dd) {
  const len = 150 * clamp01((dd - 0.25) / 0.55);
  if (len < 4) return '';
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const u = i / 30, y = 236 + u * len;
    const x = 40 * Math.sin(u * 5 + t * 3) * u + 30 * Math.sin(u * 11 - t * 2) * u * dd;
    pts.push(`${f(x - 20)} ${f(y)}`);
  }
  const back = pts.slice().reverse().map((p) => {
    const [x, y] = p.split(' ').map(Number);
    return `${f(x + 46 + 10 * Math.sin(y / 30 + t * 4))} ${f(y - 8)}`;
  });
  return `<path d="M${[...pts, ...back].join('L')}" fill="none" stroke="${TAPEC}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
}
