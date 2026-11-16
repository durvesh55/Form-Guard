/**
 * popup.js — the small window under the toolbar icon.
 *
 * Design: ONE plain sentence about the current page, ONE big button only until help is
 * switched on for all websites, and everything technical (settings, the log of what
 * FormGuard did) tucked into "More settings". Every word comes from popupText.js and
 * follows the chosen language (English / हिन्दी).
 *
 * Opening the popup is a user gesture, so Chrome grants `activeTab` for this tab and we
 * can start the content scripts here when "all websites" is not on yet.
 */
'use strict';

const CONTENT_FILES = [
  'lib/sanitizer.js', 'lib/rules.js', 'lib/rulesText.js', 'lib/i18n.js', 'lib/regexToEnglish.js', 'lib/ruleEngine.js',
  'content/dom.js', 'content/tooltip.js', 'content/imageResize.js', 'content/fileAssist.js', 'content/detector.js',
];
const DEFAULTS = { enabled: true, tooltips: true, aiEnabled: false, lang: 'en', autoClear: true, liveHint: true, textSize: 'normal', contrast: false, serverUrl: 'http://localhost:3000/explain' };
const ALL_SITES = ['https://*/*', 'http://*/*'];
const $ = (id) => document.getElementById(id);
const UI = globalThis.FG_UI;

let tab = null;
let settings = { ...DEFAULTS };
let allSites = false;
let page = { kind: 'checking' };   // checking | na | blocked | ok
const T = (key, params) => UI.t(settings.lang, key, params);

// ---------------- status: one sentence about THIS page ------------------------------------
function renderStatus() {
  let cls = '', icon = '⏳', title = T('stChecking'), sub = '';
  if (page.kind === 'na') { cls = 'off'; icon = 'ℹ️'; title = T('stNA'); sub = T('stNASub'); }
  else if (page.kind === 'blocked') { cls = 'warn'; icon = '⚠️'; title = T('stBlocked'); sub = page.file ? T('stBlockedFile') : T('stBlockedOther'); }
  else if (page.kind === 'ok') {
    if (!settings.enabled) { cls = 'off'; icon = '⏸️'; title = T('stPaused'); sub = T('stPausedSub'); }
    else if (page.errors > 0) { cls = 'warn'; icon = '💡'; title = T('stProblems', { n: page.errors }); sub = T('stProblemsSub'); }
    else if (page.fields === 0) { cls = 'off'; icon = 'ℹ️'; title = T('stNoForms'); sub = T('stNoFormsSub'); }
    else { cls = 'ok'; icon = '✅'; title = T('stOk'); sub = T('stOkSub'); }
  }
  $('statusCard').className = 'status-card ' + cls;
  $('statusIcon').textContent = icon;
  $('statusTitle').textContent = title;
  $('statusSub').textContent = sub;
}

async function ping() {
  try { return await chrome.tabs.sendMessage(tab.id, { type: 'PING' }); } catch (e) { return null; }
}

/** Errors / fields added up over the main page AND every iframe (the background keeps the sum). */
async function tabStatus() {
  try { return await chrome.runtime.sendMessage({ type: 'TAB_STATUS', tabId: tab.id }); } catch (e) { return null; }
}

async function activate() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || /^(chrome|edge|about|chrome-extension|devtools):/.test(tab.url) || tab.url.startsWith('https://chromewebstore.google.com')) {
    page = { kind: 'na' }; renderStatus(); $('recheck').hidden = true;
    return;
  }
  let res = await ping();
  if (!res) {
    try {
      // every frame (forms inside iframes); if Chrome refuses some frame, at least do the main page
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: CONTENT_FILES }); }
      catch (e) { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }); }
      await new Promise((r) => setTimeout(r, 500));   // let the first scan finish before we read the count
      res = await ping();
    } catch (e) {
      page = { kind: 'blocked', file: tab.url.startsWith('file:') };
      renderStatus(); $('recheck').hidden = true;
      return;
    }
  }
  const sum = await tabStatus();
  page = { kind: 'ok', errors: sum ? sum.errors : (res ? res.errors : 0), fields: sum ? sum.fields : (res ? res.fields : 0) };
  renderStatus();
}

$('recheck').addEventListener('click', async () => {
  if (!tab) return;
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' }).catch(() => null);
  if (!res) return activate();
  await new Promise((r) => setTimeout(r, 300));          // let every frame finish its scan
  const sum = await tabStatus();
  page = { kind: 'ok', errors: sum ? sum.errors : res.errors, fields: sum ? sum.fields : res.fields };
  renderStatus();
});

// ---------------- "turn on for all websites" (only until it is on) ------------------------
function renderTurnOn() { $('turnOnCard').hidden = allSites; }

// Needs a click (user gesture) so Chrome can ask once; background.js then registers the content
// scripts for every site and starts them in tabs that are already open.
$('turnOnBtn').addEventListener('click', async () => {
  allSites = await chrome.permissions.request({ origins: ALL_SITES });
  renderTurnOn();
});

// ---------------- language + settings -------------------------------------------------------
function applyLang() {
  document.documentElement.lang = settings.lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T(n.dataset.i18n); });
  document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === settings.lang)));
  renderStatus(); renderTurnOn(); renderLog();
}

const POPUP_ZOOM = { normal: 1, large: 1.15, xlarge: 1.3 };
function applyDisplayPrefs() {
  document.body.style.zoom = String(POPUP_ZOOM[settings.textSize] || 1);
  document.body.classList.toggle('hc', !!settings.contrast);
}

function syncControls() {
  $('liveHint').checked = settings.liveHint;
  $('textSize').value = settings.textSize;
  $('contrast').checked = settings.contrast;
  applyDisplayPrefs();
  $('pause').checked = !settings.enabled;
  $('autoClear').checked = settings.autoClear;
  $('aiEnabled').checked = settings.aiEnabled;
  $('serverUrl').value = settings.serverUrl;
  $('aiBox').hidden = !settings.aiEnabled;
}

document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => {
  settings.lang = b.dataset.lang;
  chrome.storage.local.set({ lang: settings.lang });   // open pages re-render their tooltips right away
  applyLang();
}));
$('pause').addEventListener('change', (e) => { settings.enabled = !e.target.checked; chrome.storage.local.set({ enabled: settings.enabled }); renderStatus(); });
$('liveHint').addEventListener('change', (e) => chrome.storage.local.set({ liveHint: e.target.checked }));
$('textSize').addEventListener('change', (e) => { settings.textSize = e.target.value; applyDisplayPrefs(); chrome.storage.local.set({ textSize: settings.textSize }); });
$('contrast').addEventListener('change', (e) => { settings.contrast = e.target.checked; applyDisplayPrefs(); chrome.storage.local.set({ contrast: settings.contrast }); });
$('openReport').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('report/report.html') }));
$('autoClear').addEventListener('change', (e) => chrome.storage.local.set({ autoClear: e.target.checked }));
$('aiEnabled').addEventListener('change', (e) => {
  $('aiBox').hidden = !e.target.checked;
  chrome.storage.local.set({ aiEnabled: e.target.checked });
});
$('serverUrl').addEventListener('change', (e) => {
  try { new URL(e.target.value); chrome.storage.local.set({ serverUrl: e.target.value.trim() }); }
  catch (err) { e.target.value = DEFAULTS.serverUrl; }
});

// ---------------- "what FormGuard did" ----------------------------------------------------
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

async function renderLog() {
  const { auditLog = [] } = await chrome.storage.local.get({ auditLog: [] });
  const reads = auditLog.filter((e) => e.kind === 'read').length;
  const sent = auditLog.filter((e) => e.kind === 'sent');
  const bytes = sent.reduce((n, e) => n + (e.bytes || 0), 0);
  $('statLine').textContent = T('stats', { reads, sent: sent.length, bytes });
  const { unknownFields = [] } = await chrome.storage.local.get({ unknownFields: [] });
  $('unknownLine').textContent = T('unknown', { n: unknownFields.length });
  $('exportUnknown').disabled = !unknownFields.length;

  const line = $('privacyLine');
  if (settings.aiEnabled) {
    let host = settings.serverUrl; try { host = new URL(settings.serverUrl).host; } catch (e) { /* keep */ }
    line.textContent = T('privAI', { host }); line.className = 'privacy warn';
  } else { line.textContent = T('privOk'); line.className = 'privacy'; }

  const list = $('log');
  list.textContent = '';
  const items = auditLog.slice(-50).reverse();
  if (!items.length) { list.append(el('li', 'empty', T('logEmpty'))); return; }
  for (const e of items) {
    const li = el('li', e.kind);
    let text = e.detail || '';
    if (e.kind === 'read') text = T('logRead', { field: e.field || e.host || '' });
    else if (e.kind === 'blocked') text = T('logBlocked');
    else if (e.kind === 'sent') {
      const m = /to ([^\s(]+)/.exec(e.detail || '');
      text = T('logSent', { bytes: e.bytes || 0, host: m ? m[1] : '' });
    }
    li.append(el('div', null, text));
    li.append(el('div', 'meta', [new Date(e.t).toLocaleTimeString(), e.host].filter(Boolean).join(' · ')));
    if (e.payload) li.append(el('pre', 'payload', JSON.stringify(e.payload, null, 1)
      + (e.removed && e.removed.length ? `\nPII removed: ${e.removed.map((r) => `${r.type}×${r.count}`).join(', ')}` : '')));
    list.append(li);
  }
}

$('exportUnknown').addEventListener('click', async () => {
  const { unknownFields = [] } = await chrome.storage.local.get('unknownFields');
  const url = URL.createObjectURL(new Blob([JSON.stringify(unknownFields.map(({ key, ...f }) => f), null, 2)], { type: 'application/json' }));
  const a = el('a'); a.href = url; a.download = `formguard-unknown-fields-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('clearLog').addEventListener('click', () => chrome.storage.local.set({ auditLog: [] }));
$('exportLog').addEventListener('click', async () => {
  const { auditLog = [] } = await chrome.storage.local.get('auditLog');
  const url = URL.createObjectURL(new Blob([JSON.stringify(auditLog, null, 2)], { type: 'application/json' }));
  const a = el('a'); a.href = url; a.download = `formguard-audit-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.lang || changes.enabled || changes.aiEnabled || changes.serverUrl || changes.autoClear || changes.liveHint || changes.textSize || changes.contrast) {
    settings = await chrome.storage.local.get(DEFAULTS);
    syncControls(); applyLang();
  } else if (changes.auditLog || changes.unknownFields) renderLog();
});

// ---------------- start ----------------------------------------------------------------------
(async function init() {
  settings = await chrome.storage.local.get(DEFAULTS);
  allSites = await chrome.permissions.contains({ origins: ALL_SITES });
  syncControls();
  applyLang();
  activate();
})();
