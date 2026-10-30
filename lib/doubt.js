// The measured part, shared by every composition and by the picture.
// A token's doubt is the entropy of its top-5 candidates (plus the leftover mass), scaled to 0…1.

export const H_MAX = Math.log(6);                 // entropy of 5 equal candidates + rest
export const isMarkup = (tok) => /^[\s*_#`"«»]*$/.test(tok);
export const doubtOf = (tok) => Math.min(1, tok.h / H_MAX);

// Runner-ups the model almost said play this many semitones away from the written note.
export const CLASH = [1, -1, 6, 2];

// Each arranged token is { t, until, tok, d, … }: it holds its doubt from t until `until`.
// Token sounding at time t, or null.
export function tokenAt(tokens, t) {
  let lo = 0, hi = tokens.length - 1, k = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].t <= t) { k = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return k >= 0 && t < tokens[k].until ? tokens[k] : null;
}

export const doubtCurve = (tokens) => (t) => tokenAt(tokens, t)?.d ?? 0;

// Ghost notes for one token: every runner-up, a clashing interval away, as loud as the model
// believed in it, detuned further the more the model doubted.
export function ghosts(tok, midi, d) {
  return tok.alts.slice(0, CLASH.length).map((alt, k) => ({
    k, midi: midi + CLASH[k], gain: alt.p ** 0.7,
    pan: k % 2 ? 0.7 : -0.7, detune: (k % 2 ? 1 : -1) * (12 + 30 * d),
  }));
}
