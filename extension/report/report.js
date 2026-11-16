/**
 * report.js — builds the privacy report from live data (activity log, manifest, granted permissions).
 * Everything is read locally; nothing leaves the browser.
 */
'use strict';
const $ = (id) => document.getElementById(id);

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function percentile(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0; }
function table(rows) {
  const t = el('table');
  for (const [k, v] of rows) { const tr = el('tr'); tr.append(el('th', null, k), el('td', null, v)); t.append(tr); }
  return t;
}

(async function main() {
  $('print').addEventListener('click', () => window.print());
  const { auditLog = [], unknownFields = [], aiEnabled = false } = await chrome.storage.local.get(['auditLog', 'unknownFields', 'aiEnabled']);

  // 1. network
  const sent = auditLog.filter((e) => e.kind === 'sent');
  const bytes = sent.reduce((n, e) => n + (e.bytes || 0), 0);
  const blocked = auditLog.filter((e) => e.kind === 'blocked').length;
  const net = $('netBody');
  net.append(el('div', 'big ' + (sent.length ? 'bad' : 'good'), `${sent.length} request${sent.length === 1 ? '' : 's'} · ${bytes} bytes`));
  net.append(el('p', null, aiEnabled
    ? 'AI help is currently ON, so field names and error text (never what you type) can be sent to the server you configured.'
    : 'AI help is OFF (the default): FormGuard makes no network calls at all.'));
  net.append(table([
    ['Requests sent', String(sent.length)],
    ['Bytes sent', String(bytes)],
    ['AI attempts blocked because AI help was off', String(blocked)],
    ['Entries in the activity log', String(auditLog.length)],
  ]));
  if (sent.length) net.append(el('p', null, 'Sent entries are never removed automatically; the manual "Clear log" button is the only way to remove them.'));

  // 3. speed
  const lat = auditLog.filter((e) => e.kind === 'read' && typeof e.latencyMs === 'number').map((e) => e.latencyMs).sort((a, b) => a - b);
  const sp = $('speedBody');
  if (!lat.length) sp.append(el('p', null, 'No timings recorded yet. Use FormGuard on a page with form errors, then reload this report.'));
  else {
    const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
    sp.append(table([
      ['Fields analysed (with timing)', String(lat.length)],
      ['Average time per field', avg.toFixed(1) + ' ms'],
      ['Median', percentile(lat, 0.5).toFixed(1) + ' ms'],
      ['95th percentile', percentile(lat, 0.95).toFixed(1) + ' ms'],
      ['Slowest', lat[lat.length - 1].toFixed(1) + ' ms'],
    ]));
    sp.append(el('p', 'lead', 'Time from finding an error on a field to showing its tooltip, measured inside the page. The log keeps the most recent 300 entries.'));
  }

  // 4. permissions
  const m = chrome.runtime.getManifest();
  const granted = await chrome.permissions.getAll();
  const pb = $('permsBody');
  pb.append(table([
    ['Permissions', (m.permissions || []).join(', ') || 'none'],
    ['Optional site access (asked only when you click)', (m.optional_host_permissions || []).join(', ') || 'none'],
    ['Site access granted right now', (granted.origins || []).join(', ') || 'none: it works only on the tab you open it on'],
  ]));
  pb.append(el('p', 'lead', '"activeTab" means only the page you are looking at, only after you click. "scripting" starts the helper on that page. "storage" keeps your settings and this log on your own device.'));

  // 5. stored
  $('storedBody').append(table([
    ['Settings (language, text size and so on)', 'on this device (chrome.storage.local)'],
    ['Activity log', `${auditLog.length} entries, at most 300, no typed values`],
    ['Boxes FormGuard did not understand', `${unknownFields.length} (label / type / name only; saved to a file only when you choose)`],
  ]));
})();
