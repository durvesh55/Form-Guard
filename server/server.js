/**
 * server.js — OPTIONAL fallback explainer (Phase 7).
 *
 * The extension calls this ONLY when:
 *   (a) the user turned "AI fallback" ON in the popup, and
 *   (b) no on-device rule / pattern could explain the error.
 *
 * It receives ONLY: { label, type, pattern, errorText, valueLength }
 * and returns:      { explanation, source }
 *
 * Privacy measures here:
 *   - whitelist of accepted keys (anything else -> 400)
 *   - body size limit 2 KB
 *   - the same PII sanitizer runs AGAIN on arrival
 *   - nothing is stored; the console log prints only the sanitised payload
 *
 * The default "explainer" is a small keyword engine so the project runs with
 * no API keys and no internet. See explain() to plug in a real model.
 */
const express = require('express');
const { buildSafePayload } = require('../extension/lib/sanitizer.js');
const { regexToEnglish } = require('../extension/lib/regexToEnglish.js');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_KEYS = ['label', 'type', 'pattern', 'errorText', 'valueLength'];

// --- CORS: the extension's service worker has origin chrome-extension://<id> ---
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',          // tighten to your extension id in production
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '2kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/explain', (req, res) => {
  const body = req.body || {};
  const extra = Object.keys(body).filter((k) => !ALLOWED_KEYS.includes(k));
  if (extra.length) return res.status(400).json({ error: `Unexpected fields: ${extra.join(', ')}` });

  const { payload, removed } = buildSafePayload(body); // defence in depth
  console.log(`[${new Date().toISOString()}] /explain`, JSON.stringify(payload),
    removed.length ? `(server removed: ${removed.map((r) => r.type).join(',')})` : '');

  res.json({ explanation: explain(payload), source: 'server-heuristic' });
});

/**
 * Turn sanitised metadata into a plain-language explanation.
 *
 * To use a real language model instead, replace the body of this function with
 * a call to your model and pass ONLY `p` (the sanitised payload) in the prompt.
 */
function explain(p) {
  const label = p.label || 'this field';
  const e = (p.errorText || '').toLowerCase();
  const tips = [];

  if (p.pattern) tips.push(`It must contain ${regexToEnglish(p.pattern).text}.`);
  if (/required|mandatory|empty|blank/.test(e) || p.valueLength === 0) tips.push(`"${label}" cannot be left empty.`);
  if (/special|symbol|character/.test(e)) tips.push('Remove special characters such as @ # $ % & * unless the hint says they are allowed.');
  if (/space/.test(e)) tips.push('Remove spaces at the start, end or middle of the entry.');
  if (/numeric|number|digit/.test(e)) tips.push('Use digits 0–9 only (no letters, spaces or symbols).');
  if (/alpha|letter|character only/.test(e)) tips.push('Use letters only — no digits or symbols.');
  if (/match|same|mismatch/.test(e)) tips.push('This must exactly match the related field (check spelling and capital letters).');
  if (/exist|already|taken|registered|duplicate/.test(e)) tips.push('This value is already registered — use a different one or log in / recover your account.');
  if (/expire|session|timeout/.test(e)) tips.push('Your session or code expired — refresh the page or request a new code.');
  if (/upper|capital/.test(e)) tips.push('Use CAPITAL letters.');
  if (/length|long|short|characters|min|max/.test(e)) tips.push(`Check the length: you entered ${p.valueLength} character(s). The hint near the field usually says the allowed length.`);
  if (/date|dob|age/.test(e)) tips.push('Check the date format (often DD/MM/YYYY) and the allowed age range.');

  if (!tips.length) {
    tips.push(`The site rejected "${label}" without a clear reason.`,
      'Remove leading/trailing spaces, check the placeholder or example format near the field, and compare it with your document.');
  }
  return tips.join(' ');
}

if (require.main === module) {
  app.listen(PORT, '127.0.0.1', () => console.log(`FormGuard fallback server on http://localhost:${PORT}  (POST /explain)`));
}
module.exports = { app, explain };
