/**
 * screenshots.js — captures the Chrome Web Store screenshots (1280×800) from the real extension in Chromium.
 *   cd e2e && npm run screenshots        -> ../docs/screenshots/*.png
 * The popup itself is not captured here: opened as a tab it is "looking at" a browser page, so its status
 * card would not show a real page. Capture the popup by hand on a real site (see docs/STORE_LISTING.md).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./harness');

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const h = await start();
  const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, name) }); console.log('  saved', name); };
  try {
    await h.setSettings({ lang: 'en', liveHint: true });

    // 1 + 3: English notes, one card expanded
    let page = await h.open('/test-form.html');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Submit A' }).click();
    await page.waitForTimeout(1500);
    await page.locator('#formA').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.getElementById('formA').getBoundingClientRect().top + window.scrollY - 140));
    await page.waitForTimeout(500);
    await shot(page, '1-english-notes.png');
    await page.locator('formguard-root .tip').nth(1).hover();    // PIN code
    await page.waitForTimeout(400);
    await shot(page, '3-card-expanded.png');

    // 2: the same page in Hindi
    await h.setSettings({ lang: 'hi' });
    await page.waitForTimeout(1200);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    await shot(page, '2-hindi-notes.png');
    await h.setSettings({ lang: 'en' });
    await page.close();

    // 4: live counter, green
    page = await h.open('/test-form.html');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, document.getElementById('formA').getBoundingClientRect().top + window.scrollY - 140));
    const mobile = page.locator('#a-mobile');
    await mobile.fill('');
    await mobile.pressSequentially('9876543210');
    await page.waitForTimeout(500);
    await shot(page, '4-live-counter.png');
    await page.close();

    // 5: file card with the fix button, then the success note
    page = await h.open('/test-form.html');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: /Generate 300 KB image/ }).click();
    await page.locator('formguard-root .tip button.btn').waitFor({ timeout: 8000 });
    await page.evaluate(() => window.scrollTo(0, document.getElementById('d-sign').parentElement.getBoundingClientRect().top + window.scrollY - 200));
    await page.waitForTimeout(500);
    await shot(page, '5-file-fix-button.png');
    await page.locator('formguard-root .tip button.btn').click();
    await page.locator('formguard-root').getByText('Upload or Submit').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, '5b-file-fixed.png');
    await page.close();

    // 7: privacy report
    const id = new URL(h.worker.url()).host;
    page = await h.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`chrome-extension://${id}/report/report.html`);
    await page.waitForTimeout(800);
    await shot(page, '7-privacy-report.png');
    await page.close();
  } finally { await h.stop(); }
  console.log('Screenshots in', OUT);
})().catch((e) => { console.error('SCREENSHOTS FAILED:', e.message); process.exit(1); });
