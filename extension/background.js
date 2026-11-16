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

const DEFAULTS = { enabled: true, tooltips: true, aiEnabled: false, lang: 'en', autoClear: true, serverUrl: 'http://localhost:3000/explain' };
const CONTENT_FILES = [
  'lib/sanitizer.js', 'lib/rules.js', 'lib/rulesText.js', 'lib/i18n.js', 'lib/regexToEnglish.js', 'lib/ruleEngine.js',
  'content/dom.js', 'content/tooltip.js', 'content/imageResize.js', 'content/fileAssist.js', 'content/detector.js',
];
const MAX_LOG = 300;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(Object.keys(DEFAULTS));
  await chrome.storage.local.set({ ...DEFAULTS, ...current }); // keep user's choices on update
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
  if (msg.type === 'ERROR_COUNT' && sender.tab) {
    // 2. badge
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: msg.count ? String(msg.count) : '' });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#d4a72c' });
    return;
  }
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
      await chrome.scripting.registerContentScripts([{ id: scriptId(origin), matches: [origin], js: CONTENT_FILES, runAt: 'document_idle' }]);
      appendAudit({ kind: 'local', host: origin, field: '', detail: `Auto-run enabled for ${origin}` });
    } catch (e) { /* already registered */ }
  }
  // Registered scripts only run on pages loaded from now on. Start them in tabs that are already open
  // (we hold the permission now), so turning auto-run on works without reloading anything.
  try {
    const tabs = await chrome.tabs.query({ url: origins });
    for (const t of tabs) {
      chrome.scripting.executeScript({ target: { tabId: t.id }, files: CONTENT_FILES }).catch(() => { /* page not allowed */ });
    }
  } catch (e) { /* no tab access */ }
});
chrome.permissions.onRemoved.addListener(async ({ origins = [] }) => {
  const ids = origins.map(scriptId);
  try { await chrome.scripting.unregisterContentScripts({ ids }); } catch (e) { /* not registered */ }
});
