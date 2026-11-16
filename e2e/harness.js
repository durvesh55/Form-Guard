/**
 * harness.js — shared helpers for the real-browser tests.
 *
 *   const h = await start();            // builds the test extension, serves /test, launches Chromium with it
 *   const page = await h.open('/test-form.html');
 *   await h.setSettings({ lang: 'hi' }); // writes chrome.storage.local from the extension's own worker
 *   await h.stop();
 */
'use strict';
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'test');
const EXT_DIR = path.join(__dirname, '.build', 'extension');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

function serveTestPages() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(TEST_DIR, p === '/' ? 'test-form.html' : p);
      if (!file.startsWith(TEST_DIR)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function start() {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-test-build.js')], { stdio: 'pipe' });
  const { server, origin } = await serveTestPages();
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-e2e-'));
  const context = await chromium.launchPersistentContext(userData, {
    channel: 'chromium',           // the full new-headless Chromium, which can load extensions
    headless: true,
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
    viewport: { width: 1200, height: 900 },
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });

  // Every request the browser makes, to prove FormGuard itself makes none to the outside world.
  const requests = [];
  context.on('request', (r) => requests.push({ url: r.url(), fromWorker: !!r.serviceWorker() }));

  const api = {
    origin, context, worker, requests,
    /** Open a test page and wait until the content script is running in it. */
    async open(p) {
      const page = await context.newPage();
      await page.goto(origin + p);
      await page.waitForTimeout(600);   // content script start + first scan
      return page;
    },
    setSettings: (values) => worker.evaluate((v) => chrome.storage.local.set(v), values),
    getStorage: (keys) => worker.evaluate((k) => chrome.storage.local.get(k), keys),
    /** The toolbar badge text for the tab showing this page. */
    async badge(page) {
      const url = page.url();
      return worker.evaluate(async (u) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((t) => t.url === u);
        return tab ? chrome.action.getBadgeText({ tabId: tab.id }) : null;
      }, url);
    },
    /** Text of every tooltip chip / card in a page or frame (the test build keeps the shadow root open). */
    async tipTexts(scope) {
      return scope.locator('formguard-root .tip').allInnerTexts();
    },
    async stop() {
      await context.close().catch(() => {});
      await new Promise((r) => server.close(r));
      fs.rmSync(userData, { recursive: true, force: true });
    },
  };
  return api;
}

module.exports = { start };
