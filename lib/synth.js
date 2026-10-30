// Shared DSP. The room reverb and the WAV encoder come from equation-sound-lab's core/synth.js.

export const TAU = Math.PI * 2;

export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Small deterministic PRNG so renders are reproducible.
export function noiseGen(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// Freeverb-style room: parallel combs into series allpasses, slightly different per side.
export function reverb(L, R, sr, mix) {
  if (!(mix > 0)) return;
  const scale = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491];
  const allps = [556, 441, 341];
  const run = (src, spread) => {
    const out = new Float32Array(src.length);
    for (const c of combs) {
      const size = Math.round((c + spread) * scale);
      const buf = new Float32Array(size);
      let idx = 0, store = 0;
      for (let i = 0; i < src.length; i++) {
        const o = buf[idx];
        store = o * 0.75 + store * 0.25;
        buf[idx] = src[i] * 0.015 + store * 0.82;
        out[i] += o;
        if (++idx >= size) idx = 0;
      }
    }
    for (const a of allps) {
      const size = Math.round((a + spread) * scale);
      const buf = new Float32Array(size);
      let idx = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[idx];
        const v = out[i];
        buf[idx] = v + b * 0.5;
        out[i] = b - v;
        if (++idx >= size) idx = 0;
      }
    }
    return out;
  };
  const wl = run(L, 0), wr = run(R, 23);
  for (let i = 0; i < L.length; i++) {
    L[i] += wl[i] * mix;
    R[i] += wr[i] * mix;
  }
}

// Peak-normalize to −1 dBFS.
export function master(L, R) {
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
}

export function encodeWav({ left, right, sampleRate }) {
  const n = left.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), true);
    v.setInt16(o + 2, Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), true);
    o += 4;
  }
  return new Uint8Array(buf);
}
