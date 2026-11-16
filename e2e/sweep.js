/**
 * sweep.js — compatibility sweep. Loads each site in e2e/sites.json in Chromium WITH the extension,
 * presses the first "submit-like" button on empty fields to trigger the site's own validation,
 * and records what FormGuard found. Writes a table into docs/COMPATIBILITY.md.
 *
 *   cd e2e && npm run sweep            (needs internet; takes a few minutes)
 *
 * Honest limits: pages are public pre-login pages, opened by a robot in headless Chromium. Some sites
 * block robots, need captchas or a real login, so "no form" can mean "the site did not let me in".
 * Treat it as a first screening, then confirm important portals by hand.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./harness');

const SITES = JSON.parse(fs.readFileSync(path.join(__dirname, 'sites.json'), 'utf8'));
const DOC = path.join(__dirname, '..', 'docs', 'COMPATIBILITY.md');
const SUBMITLIKE = /\b(submit|log ?in|sign ?in|register|next|continue|search|check|proceed|verify|get otp|send otp|validate)\b/i;
const NOT_SUBMIT = /\b(reset|cancel|clear|back|close|forgot)\b/i;

async function tabStatus(h, page) {
  return h.worker.evaluate(async (u) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === u) || tabs[tabs.length - 1];
    const key = 'frames_' + tab.id;
    const data = (await chrome.storage.session.get(key))[key] || {};
    const rows = Object.values(data);
    return { errors: rows.reduce((n, f) => n + f.errors, 0), fields: rows.reduce((n, f) => n + f.fields, 0), frames: rows.length };
  }, page.url());
}

/** Press the first visible submit-like button in any frame. Returns its label, or null. */
async function pressSubmit(page) {
  for (const frame of page.frames()) {
    const buttons = frame.locator('button, input[type=submit], input[type=button], [role=button], a.btn');
    const n = Math.min(await buttons.count().catch(() => 0), 40);
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      if (!(await b.isVisible().catch(() => false))) continue;
      const label = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value').catch(() => '')) || '').trim().slice(0, 40);
      if (!label || NOT_SUBMIT.test(label) || !SUBMITLIKE.test(label)) continue;
      try { await b.click({ timeout: 3000 }); return label; } catch (e) { /* try the next one */ }
    }
  }
  return null;
}

async function openByText(page, text) {
  const target = page.getByText(text, { exact: true }).first();
  try { await target.click({ timeout: 4000 }); await page.waitForTimeout(1500); return true; } catch (e) { return false; }
}

async function visit(h, site) {
  const row = { name: site.name, url: site.url, loaded: false, fields: 0, clicked: '', errors: 0, tips: [], rules: [], note: site.note || '' };
  const before = (await h.getStorage('auditLog')).auditLog || [];
  const page = await h.context.newPage();
  try {
    await page.goto(site.url, { timeout: 35000, waitUntil: 'domcontentloaded' });
    row.loaded = true;
    await page.waitForTimeout(4000);
    row.title = (await page.title()).slice(0, 60);
    if (site.open) await openByText(page, site.open);
    let st = await tabStatus(h, page);
    row.fields = st.fields;
    row.clicked = (await pressSubmit(page)) || '';
    if (row.clicked) { await page.waitForTimeout(3000); st = await tabStatus(h, page); }
    row.errors = st.errors; row.fields = Math.max(row.fields, st.fields);
    const tips = [];
    for (const f of page.frames()) tips.push(...(await f.locator('formguard-root .tip').allInnerTexts().catch(() => [])));
    row.tips = tips.map((t) => t.replace(/[💡✓×]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3);
    const after = (await h.getStorage('auditLog')).auditLog || [];
    row.rules = [...new Set(after.slice(before.length).filter((e) => e.kind === 'read' && e.ruleId).map((e) => e.ruleId))].slice(0, 6);
    const html = (await page.content()).slice(0, 4000).toLowerCase();
    if (/access denied|request blocked|unusual traffic|are you a robot|captcha/.test(html) && !row.fields) row.note = 'Site may have blocked the robot / asked for a captcha. ' + row.note;
  } catch (e) {
    row.note = ('Could not load: ' + e.message.split('\n')[0]).slice(0, 140);
  } finally { await page.close().catch(() => {}); }
  return row;
}

function verdict(r) {
  if (!r.loaded) return '⚪ not reached';
  if (!r.fields) return '⚪ no form found';
  if (r.errors > 0) return '🟢 errors explained';
  if (!r.clicked) return '🟡 form seen, nothing to press';
  return '🟡 form seen, no error appeared';
}

function table(rows) {
  const cell = (s) => String(s || '—').replace(/\|/g, '/').replace(/\n/g, ' ');
  const head = '| Site | Result | Fields seen | Errors explained | Rules matched | Sample tooltip | Notes |\n|---|---|---|---|---|---|---|\n';
  return head + rows.map((r) => `| [${cell(r.name)}](${r.url}) | ${verdict(r)} | ${r.fields} | ${r.errors} | ${cell(r.rules.join(', '))} | ${cell(r.tips[0])} | ${cell(r.note)} |`).join('\n');
}

(async () => {
  const h = await start();
  const rows = [];
  try {
    for (const site of SITES) {
      process.stdout.write(`• ${site.name} … `);
      const row = await visit(h, site);
      rows.push(row);
      console.log(verdict(row), `(fields ${row.fields}, errors ${row.errors})`);
    }
  } finally { await h.stop(); }

  const reached = rows.filter((r) => r.loaded && r.fields > 0);
  const explained = rows.filter((r) => r.errors > 0);
  const summary = `**${explained.length} of ${rows.length}** sites: FormGuard explained at least one error. **${reached.length} of ${rows.length}** sites: a form was found.`;
  const stamp = new Date().toISOString().slice(0, 10);
  const block = `<!-- SWEEP:START -->\n_Last run: ${stamp} · headless Chromium · empty-submit test · public pre-login pages_\n\n${summary}\n\n${table(rows)}\n<!-- SWEEP:END -->`;
  let doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '# Compatibility\n\n<!-- SWEEP:START -->\n<!-- SWEEP:END -->\n';
  doc = /<!-- SWEEP:START -->[\s\S]*<!-- SWEEP:END -->/.test(doc) ? doc.replace(/<!-- SWEEP:START -->[\s\S]*<!-- SWEEP:END -->/, () => block) : doc + '\n' + block + '\n';
  fs.mkdirSync(path.dirname(DOC), { recursive: true });
  fs.writeFileSync(DOC, doc);
  console.log('\n' + summary + '\nWritten to ' + DOC);
})().catch((e) => { console.error('SWEEP FAILED:', e); process.exit(1); });
