/**
 * popup.js — activates FormGuard on the current tab, manages settings and
 * renders the privacy audit log.
 *
 * Opening the popup = a user gesture, so Chrome grants `activeTab` for this
 * tab. We use that to inject the content scripts with chrome.scripting.
 */
'use strict';

const CONTENT_FILES = [
  'lib/sanitizer.js', 'lib/rules.js', 'lib/rulesText.js', 'lib/i18n.js', 'lib/regexToEnglish.js', 'lib/ruleEngine.js',
  'content/dom.js', 'content/tooltip.js', 'content/imageResize.js', 'content/fileAssist.js', 'content/detector.js',
];
const DEFAULTS = { enabled: true, tooltips: true, aiEnabled: false, lang: 'en', serverUrl: 'http://localhost:3000/explain' };
const $ = (id) => document.getElementById(id);
let tab = null;

// ---------------- activation ---------------------------------------------------------
function setStatus(text, cls) { const s = $('status'); s.textContent = text; s.className = 'pill ' + (cls || ''); }

async function ping() {
  try { return await chrome.tabs.sendMessage(tab.id, { type: 'PING' }); } catch (e) { return null; }
}

async function activate() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || /^(chrome|edge|about|chrome-extension|devtools):/.test(tab.url) || tab.url.startsWith('https://chromewebstore.google.com')) {
    setStatus('Not available here', 'off');
    $('rescan').disabled = true; $('alwaysOn').disabled = true;
    return;
  }
  let res = await ping();
  if (!res) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
      res = await ping();
    } catch (e) {
      setStatus('Cannot access page', 'off');
      $('privacyLine').textContent = tab.url.startsWith('file:')
        ? 'For local files: chrome://extensions → FormGuard → Details → enable "Allow access to file URLs", or serve the page with npm run test-page.'
        : 'Chrome blocked access to this page: ' + e.message;
      $('privacyLine').className = 'privacy warn';
      return;
    }
  }
  setStatus(res ? `Active · ${res.errors} issue${res.errors === 1 ? '' : 's'}` : 'Active', 'on');

  // "Always run on this site" reflects whether we hold the optional host permission
  if (/^https?:/.test(tab.url)) {
    const origin = new URL(tab.url).origin + '/*';
    $('alwaysOn').checked = await chrome.permissions.contains({ origins: [origin] });
    $('alwaysOn').addEventListener('change', async (e) => {
      // background.js registers/unregisters the content scripts on permission change
      if (e.target.checked) e.target.checked = await chrome.permissions.request({ origins: [origin] });
      else await chrome.permissions.remove({ origins: [origin] });
    });
  } else $('alwaysOn').disabled = true;
}

$('rescan').addEventListener('click', async () => {
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' }).catch(() => null);
  if (res) setStatus(`Active · ${res.errors} issue${res.errors === 1 ? '' : 's'}`, 'on');
});

// ---------------- settings -------------------------------------------------------------
async function loadSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  $('tooltips').checked = s.tooltips;
  $('lang').value = s.lang;
  $('aiEnabled').checked = s.aiEnabled;
  $('serverUrl').value = s.serverUrl;
  $('aiBox').hidden = !s.aiEnabled;
  return s;
}
$('tooltips').addEventListener('change', (e) => chrome.storage.local.set({ tooltips: e.target.checked }));
// Tooltips on open pages re-render in the new language right away (detector listens for storage changes)
$('lang').addEventListener('change', (e) => chrome.storage.local.set({ lang: e.target.value }));
$('aiEnabled').addEventListener('change', (e) => {
  $('aiBox').hidden = !e.target.checked;
  chrome.storage.local.set({ aiEnabled: e.target.checked });
});
$('serverUrl').addEventListener('change', (e) => {
  try { new URL(e.target.value); chrome.storage.local.set({ serverUrl: e.target.value.trim() }); }
  catch (err) { e.target.value = DEFAULTS.serverUrl; }
});

// ---------------- audit log --------------------------------------------------------------
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

async function renderLog() {
  const { auditLog = [], aiEnabled, serverUrl } = await chrome.storage.local.get({ auditLog: [], ...DEFAULTS });
  const reads = auditLog.filter((e) => e.kind === 'read');
  const sent = auditLog.filter((e) => e.kind === 'sent');
  const blocked = reads.reduce((n, e) => n + (e.blocked ? e.blocked.length : 0), 0) + auditLog.filter((e) => e.kind === 'blocked').length;
  const bytes = sent.reduce((n, e) => n + (e.bytes || 0), 0);
  $('statRead').textContent = reads.length;
  $('statBlocked').textContent = blocked;
  $('statSent').textContent = sent.length;
  $('statBytes').textContent = bytes;

  const line = $('privacyLine');
  if (!line.classList.contains('warn') || line.dataset.auto) {
    line.dataset.auto = '1';
    if (aiEnabled) {
      let host = serverUrl; try { host = new URL(serverUrl).host; } catch (e) { /* keep */ }
      line.textContent = `⚠ AI fallback is ON — sanitised metadata may be sent to ${host} only when no rule matches.`;
      line.className = 'privacy warn';
    } else {
      line.textContent = `✓ Default mode: zero network calls. ${bytes} bytes have ever been sent.`;
      line.className = 'privacy';
    }
  }

  const filter = $('filter').value;
  const list = $('log');
  list.textContent = '';
  const items = auditLog.filter((e) => filter === 'all' || e.kind === filter).slice(-100).reverse();
  if (!items.length) { list.append(el('li', 'empty', 'Nothing logged yet.')); return; }
  for (const e of items) {
    const li = el('li');
    li.append(el('span', 'tag ' + e.kind, e.kind.toUpperCase()), el('b', null, e.field || ''));
    let text = e.detail || '';
    if (e.kind === 'read') {
      text = `Read: ${(e.items || []).join(', ')}.`;
      if (e.blocked && e.blocked.length) text += ` Never read: ${e.blocked.join(', ')}.`;
    }
    li.append(el('div', null, text));
    const meta = [new Date(e.t).toLocaleTimeString(), e.host, e.ruleId && `rule: ${e.ruleId}`,
      e.latencyMs != null && `${e.latencyMs} ms`, e.signals && `signals: ${e.signals.join(', ')}`].filter(Boolean).join(' · ');
    li.append(el('div', 'meta', meta));
    if (e.payload) li.append(el('pre', 'payload', 'Payload sent: ' + JSON.stringify(e.payload, null, 1)
      + (e.removed && e.removed.length ? `\nPII removed: ${e.removed.map((r) => `${r.type}×${r.count}`).join(', ')}` : '')));
    list.append(li);
  }
}

$('filter').addEventListener('change', renderLog);
$('clearLog').addEventListener('click', () => chrome.storage.local.set({ auditLog: [] }));
$('exportLog').addEventListener('click', async () => {
  const { auditLog = [] } = await chrome.storage.local.get('auditLog');
  const url = URL.createObjectURL(new Blob([JSON.stringify(auditLog, null, 2)], { type: 'application/json' }));
  const a = el('a'); a.href = url; a.download = `formguard-audit-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.auditLog || changes.aiEnabled || changes.serverUrl)) renderLog();
});

loadSettings().then(renderLog);
activate();
