/**
 * background.js — MV3 service worker.
 *
 * Jobs:
 *   1. Keep the privacy AUDIT LOG in chrome.storage.local (capped at 300 entries).
 *   2. Show the per-tab error count on the toolbar badge.
 *   3. The ONLY place that can make a network call: the optional AI fallback.
 *      It re-sanitises the payload and refuses when the toggle is OFF.
 *   4. "Always run on this site": register content scripts when the user grants
 *      an optional host permission, unregister when it is removed.
 */
importScripts('lib/sanitizer.js', 'lib/auditLog.js');

const DEFAULTS = { enabled: true, tooltips: true, aiEnabled: false, lang: 'en', autoClear: true, liveHint: true, textSize: 'normal', contrast: false, serverUrl: 'http://localhost:3000/explain' };
const CONTENT_FILES = [
  'lib/sanitizer.js', 'lib/rules.js', 'lib/rulesText.js', 'lib/i18n.js', 'lib/regexToEnglish.js', 'lib/ruleEngine.js',
  'content/dom.js', 'content/tooltip.js', 'content/imageResize.js', 'content/fileAssist.js', 'content/detector.js',
];
const MAX_LOG = 300;

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const first = details.reason === 'install';
  // First install: start in Hindi when the browser itself is set to Hindi
  const lang = first && /^hi\b/i.test(chrome.i18n.getUILanguage()) ? 'hi' : DEFAULTS.lang;
  await chrome.storage.local.set({ ...DEFAULTS, lang, ...current }); // keep user's choices on update
  // First install: a one-time welcome page (language + turn on help). Nothing is requested without a click.
  if (first) chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
});

// ---------------- 1. audit log (serialised writes so entries are never lost) -------------
let writeQueue = Promise.resolve();
function appendAudit(entry) {
  writeQueue = writeQueue.then(async () => {
    const { auditLog = [] } = await chrome.storage.local.get('auditLog');
    auditLog.push({ ...entry, t: Date.now() });
    if (auditLog.length > MAX_LOG) auditLog.splice(0, auditLog.length - MAX_LOG);
    await chrome.storage.local.set({ auditLog });
  }).catch((e) => console.warn('[FormGuard] audit write failed', e));
  return writeQueue;
}

// ---------------- 1b. new website -> clear the old activity automatically ----------------
// Content scripts say "SITE_ENTER" when a page starts or its tab becomes visible. If the host differs
// from the last one we saw, drop the old per-field notes (network entries are always kept).
function enterSite(host) {
  writeQueue = writeQueue.then(async () => {
    const { lastHost } = await chrome.storage.session.get('lastHost');
    if (lastHost === host) return;
    await chrome.storage.session.set({ lastHost: host });
    const { autoClear } = await chrome.storage.local.get({ autoClear: true });
    if (!autoClear) return;
    const { auditLog = [] } = await chrome.storage.local.get('auditLog');
    const { kept, removed } = FormGuard.AuditLog.pruneForSiteSwitch(auditLog);
    if (!removed) return;
    kept.push({ kind: 'local', host, field: '', t: Date.now(),
      detail: `Earlier activity cleared automatically because you moved to ${host}. Network activity (sent / blocked) is always kept.` });
    await chrome.storage.local.set({ auditLog: kept });
  }).catch((e) => console.warn('[FormGuard] auto-clear failed', e));
}

// ---------------- 2. per-tab status, added up over ALL frames (iframes!) -------------------
// Every frame reports { errors, fields }. The toolbar badge shows the sum; the popup asks for the same sum.
let statusQueue = Promise.resolve();
function updateFrame(tabId, frameId, st) {
  statusQueue = statusQueue.then(async () => {
    const key = 'frames_' + tabId;
    const data = (await chrome.storage.session.get(key))[key] || {};
    if (st.gone) delete data[frameId]; else data[frameId] = { errors: st.errors | 0, fields: st.fields | 0 };
    await chrome.storage.session.set({ [key]: data });
    const total = Object.values(data).reduce((n, f) => n + f.errors, 0);
    chrome.action.setBadgeText({ tabId, text: total ? String(total) : '' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#d4a72c' });
  }).catch((e) => console.warn('[FormGuard] status update failed', e));
}
function resetTab(tabId) {
  statusQueue = statusQueue.then(async () => {
    await chrome.storage.session.remove('frames_' + tabId);
    chrome.action.setBadgeText({ tabId, text: '' });
  }).catch(() => {});
}
async function tabStatus(tabId) {
  const data = (await chrome.storage.session.get('frames_' + tabId))['frames_' + tabId];
  if (!data) return null;
  const rows = Object.values(data);
  return { errors: rows.reduce((n, f) => n + f.errors, 0), fields: rows.reduce((n, f) => n + f.fields, 0), frames: rows.length };
}
chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove('frames_' + tabId).catch(() => {}); });

// ---------------- 2b. fields no rule understood: kept on this device only -------------------
// Label / type / name / placeholder, never a value. The user can save the list as a file to share.
function addUnknownField(host, field) {
  writeQueue = writeQueue.then(async () => {
    const { unknownFields = [] } = await chrome.storage.local.get('unknownFields');
    const key = [host, field.label, field.name].join('|');
    if (unknownFields.some((u) => u.key === key)) return;
    unknownFields.push({ key, host, ...field, t: Date.now() });
    if (unknownFields.length > 100) unknownFields.splice(0, unknownFields.length - 100);
    await chrome.storage.local.set({ unknownFields });
  }).catch((e) => console.warn('[FormGuard] unknown-field write failed', e));
}

// ---------------- 3. optional AI fallback ------------------------------------------------
async function explainWithAI(rawPayload, host) {
  const s = await chrome.storage.local.get(DEFAULTS);
  if (!s.aiEnabled) {
    appendAudit({ kind: 'blocked', host, field: '', detail: 'AI request blocked because AI fallback is OFF. 0 bytes sent.' });
    return { ok: false, reason: 'disabled' };
  }
  let url;
  try { url = new URL(s.serverUrl); if (!/^https?:$/.test(url.protocol)) throw new Error(); }
  catch (e) { return { ok: false, reason: 'bad server URL' }; }

  // Second sanitising pass — even if the content script had a bug, PII is stripped here.
  const { payload, removed } = FormGuard.Sanitizer.buildSafePayload(rawPayload || {});
  const body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body).length;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  const t0 = performance.now();
  try {
    const res = await fetch(url.href, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      credentials: 'omit', cache: 'no-store', signal: ctrl.signal,
    });
    const data = await res.json();
    appendAudit({
      kind: 'sent', host, field: payload.label, bytes, payload, removed,
      detail: `Sent ${bytes} bytes of sanitised metadata to ${url.host} (${Math.round(performance.now() - t0)} ms, HTTP ${res.status}).`,
    });
    if (!res.ok || typeof data.explanation !== 'string') return { ok: false, reason: 'server error' };
    return { ok: true, explanation: data.explanation.slice(0, 500) };
  } catch (e) {
    appendAudit({ kind: 'sent', host, field: payload.label, bytes, payload, removed, detail: `Tried to send ${bytes} bytes to ${url.host} but it failed (${e.name}).` });
    return { ok: false, reason: e.name };
  } finally { clearTimeout(timer); }
}

// ---------------- message router ---------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'AUDIT') { appendAudit(msg.entry); return; }
  if (msg.type === 'SITE_ENTER' && typeof msg.host === 'string' && msg.host) { enterSite(msg.host); return; }
  if (msg.type === 'FRAME_STATUS' && sender.tab) { updateFrame(sender.tab.id, sender.frameId, msg); return; }
  if (msg.type === 'FRAME_RESET' && sender.tab && sender.frameId === 0) { resetTab(sender.tab.id); return; }
  if (msg.type === 'TAB_STATUS' && typeof msg.tabId === 'number') { statusQueue.then(() => tabStatus(msg.tabId)).then(reply, () => reply(null)); return true; }
  if (msg.type === 'UNKNOWN_FIELD' && msg.field && typeof msg.host === 'string') { addUnknownField(msg.host, msg.field); return; }
  if (msg.type === 'AI_EXPLAIN') {
    explainWithAI(msg.payload, msg.host).then(reply);
    return true; // keep the channel open for the async reply
  }
});

// ---------------- 4. "Always run on this site" ---------------------------------------------
const scriptId = (origin) => 'fg_' + origin.replace(/[^a-z0-9]/gi, '_');

chrome.permissions.onAdded.addListener(async ({ origins = [] }) => {
  for (const origin of origins) {
    try {
      await chrome.scripting.registerContentScripts([{ id: scriptId(origin), matches: [origin], js: CONTENT_FILES, allFrames: true, runAt: 'document_idle' }]);
      appendAudit({ kind: 'local', host: origin, field: '', detail: `Auto-run enabled for ${origin}` });
    } catch (e) { /* already registered */ }
  }
  // Registered scripts only run on pages loaded from now on. Start them in tabs that are already open
  // (we hold the permission now), so turning auto-run on works without reloading anything.
  try {
    const tabs = await chrome.tabs.query({ url: origins });
    for (const t of tabs) {
      chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: CONTENT_FILES }).catch(() => { /* page not allowed */ });
    }
  } catch (e) { /* no tab access */ }
});
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  const ids = origins.map(scriptId);
  try { await chrome.scripting.unregisterContentScripts({ ids }); } catch (e) { /* not registered */ }
});

// Scripts registered by an older version only ran in the top frame. After an update (or browser start)
// re-register them for every origin we hold, this time for all frames.
async function refreshRegisteredScripts() {
  try {
    const { origins = [] } = await chrome.permissions.getAll();
    const old = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('fg_'));
    if (old.length) await chrome.scripting.unregisterContentScripts({ ids: old.map((x) => x.id) });
    const wanted = origins.filter((o) => /^https?:\/\//.test(o));
    if (wanted.length) {
      await chrome.scripting.registerContentScripts(wanted.map((o) => ({ id: scriptId(o), matches: [o], js: CONTENT_FILES, allFrames: true, runAt: 'document_idle' })));
    }
  } catch (e) { console.warn('[FormGuard] could not refresh scripts', e); }
}
chrome.runtime.onInstalled.addListener(refreshRegisteredScripts);
chrome.runtime.onStartup.addListener(refreshRegisteredScripts);
