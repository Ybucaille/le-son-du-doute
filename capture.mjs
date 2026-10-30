// Asks a local model a question and records, for every generated token, how sure it was:
// the chosen token's probability, the runners-up it almost said, and the entropy of that choice.
// Usage: node capture.mjs "Qui a écrit Le Grand Meaulnes ?" captures/meaulnes.json [model]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const OLLAMA = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const SYSTEM = 'Réponds en français, en une seule phrase courte, en texte brut sans markdown.';
const TOP_K = 5;

// Entropy over the top-k candidates plus one bucket for the probability mass left outside them.
function entropy(ps) {
  const rest = Math.max(0, 1 - ps.reduce((a, b) => a + b, 0));
  return -[...ps, rest].filter((p) => p > 0).reduce((h, p) => h + p * Math.log(p), 0);
}

export async function capture(question, model = 'qwen3.5:4b') {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({
      model, system: SYSTEM, prompt: question, stream: false, think: false,
      logprobs: true, top_logprobs: TOP_K,
      options: { temperature: 0, seed: 0, num_predict: 80 },
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const tokens = (data.logprobs ?? []).map((t) => {
    const alts = (t.top_logprobs ?? []).map((a) => ({ tok: a.token, p: Math.exp(a.logprob) }));
    return {
      tok: t.token,
      p: Math.exp(t.logprob),
      h: entropy(alts.map((a) => a.p)),
      alts: alts.filter((a) => a.tok !== t.token),
    };
  });
  return { model, question, answer: data.response.trim(), tokens };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [question, out, model] = process.argv.slice(2);
  if (!question || !out) {
    console.error('usage: node capture.mjs "<question>" <out.json> [model]');
    process.exit(1);
  }
  const result = await capture(question, model);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 1));
  const meanH = result.tokens.reduce((s, t) => s + t.h, 0) / Math.max(1, result.tokens.length);
  console.log(`${result.answer}\n→ ${result.tokens.length} tokens, mean doubt ${meanH.toFixed(2)} → ${out}`);
}
