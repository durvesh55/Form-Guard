/**
 * features.test.js — real-browser tests. Chromium loads the extension (test build) and drives test/test-form.html.
 *   cd e2e && npm test
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('../harness');

const DEVANAGARI = /[ऀ-ॿ]/;
let h;
test.before(async () => { h = await start(); });
test.after(async () => { if (h) await h.stop(); });

/** Run a test body on a fresh page of the test site, then close the page. */
async function onPage(path, body) {
  const page = await h.open(path);
  try { await body(page); } finally { await page.close(); }
}
const joined = (texts) => texts.join(' | ');

test('A. native validation: every wrong field gets a tooltip, in plain words', { timeout: 60000 }, async () => {
  await h.setSettings({ lang: 'en' });
  await onPage('/test-form.html', async (page) => {
    await page.getByRole('button', { name: 'Submit A' }).click();
    await page.waitForFunction(() => document.querySelector('formguard-root') !== null);
    await page.waitForTimeout(1200);
    const tips = joined(await h.tipTexts(page));
    assert.match(tips, /PIN code: 2 more numbers needed/);
    assert.match(tips, /Mobile number: 5 more numbers needed/);
    // "1234 5678" is 8 digits + a space: must say 4 more, not 3
    assert.match(tips, /Aadhaar number: 4 more numbers needed/);
    assert.strictEqual((await h.tipTexts(page)).length, 12);
    assert.strictEqual(await h.badge(page), '12');
  });
});

test('Hindi: the same page, explained in Hindi', { timeout: 60000 }, async () => {
  await h.setSettings({ lang: 'hi' });
  try {
    await onPage('/test-form.html', async (page) => {
      await page.getByRole('button', { name: 'Submit A' }).click();
      await page.waitForTimeout(1500);
      const tips = await h.tipTexts(page);
      assert.ok(tips.length >= 10, 'tooltips: ' + tips.length);
      assert.match(joined(tips), /पिन कोड: 2 अंक और चाहिए/);
      assert.ok(tips.every((t) => DEVANAGARI.test(t)), 'every chip should contain Hindi: ' + joined(tips.filter((t) => !DEVANAGARI.test(t))));
    });
  } finally { await h.setSettings({ lang: 'en' }); }
});

test('E. a banner for the whole form is explained as a sign-in problem', { timeout: 60000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    await page.locator('#e-user').fill('someone');
    await page.locator('#loginE').click();
    await page.waitForTimeout(1500);
    assert.match(joined(await h.tipTexts(page)), /Sign-in problem/);
  });
});

test('a server-rendered error banner is found right after a reload, but a permanent red legend is not', { timeout: 60000 }, async () => {
  await onPage('/login-error.html', async (page) => {
    await page.locator('formguard-root .tip').first().waitFor({ timeout: 8000 });
    assert.match(joined(await h.tipTexts(page)), /Sign-in problem/);
  });
  await onPage('/static-legend.html', async (page) => {
    await page.waitForTimeout(1500);
    assert.strictEqual((await h.tipTexts(page)).length, 0, 'a mandatory-fields legend is not an error');
  });
});

test('live counter: "5 of 10 numbers", turns into a tick when the count is right', { timeout: 60000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    const mobile = page.locator('#a-mobile');
    await mobile.fill('');
    await mobile.pressSequentially('98765');
    const hint = page.locator('formguard-root .hint');
    await hint.waitFor({ timeout: 5000 });
    assert.match(await hint.innerText(), /Mobile number: 5 of 10 numbers/);
    await mobile.pressSequentially('43210');
    assert.match(await hint.innerText(), /✓ 10 numbers/);
    assert.ok(await hint.evaluate((n) => n.classList.contains('ok')), 'counter should turn green');
    await page.locator('#a-name').focus();                       // leaving the field hides the counter
    await page.waitForTimeout(300);
    assert.strictEqual(await page.locator('formguard-root .hint').count(), 0);
  });
});

test('clicking a button only marks ITS part of the page, not every form', { timeout: 60000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    await page.getByRole('button', { name: /Generate 300 KB image/ }).click();
    await page.waitForTimeout(1500);
    const tips = joined(await h.tipTexts(page));
    assert.doesNotMatch(tips, /PIN code|Mobile number|Aadhaar/, 'section A must stay quiet: ' + tips);
  });
});

test('G. a form inside an iframe is detected, and the badge adds the frames up', { timeout: 60000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    const frame = page.frameLocator('#formFrame');
    await frame.locator('#iframeSubmit').click();
    await frame.locator('formguard-root .tip').first().waitFor({ timeout: 8000 });
    const tips = joined(await frame.locator('formguard-root .tip').allInnerTexts());
    assert.match(tips, /Mobile number/);
    assert.match(tips, /PIN code/);
    await page.waitForTimeout(600);
    assert.strictEqual(await h.badge(page), '2');
  });
});

test('F. a form inside an open Shadow DOM is detected', { timeout: 60000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    await page.locator('#s-check').click();                      // Playwright pierces open shadow roots
    await page.locator('formguard-root .tip').first().waitFor({ timeout: 8000 });
    assert.match(joined(await h.tipTexts(page)), /Mobile number/);
  });
});

test('D. signature upload: card keeps its button, fix works, an "attached" chip stays', { timeout: 90000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    await page.getByRole('button', { name: /Generate 300 KB image/ }).click();
    const fix = page.locator('formguard-root .tip button.btn');
    await fix.waitFor({ timeout: 8000 });
    assert.match(await fix.innerText(), /Make it smaller for me \(under 20 KB\)/);
    await fix.click();
    await page.locator('formguard-root').getByText('Upload or Submit').first().waitFor({ timeout: 10000 });
    const file = await page.evaluate(() => { const f = document.getElementById('d-sign').files[0]; return { name: f.name, size: f.size }; });
    assert.ok(file.size <= 20 * 1024, `signature should be <= 20 KB, got ${file.size}`);
    assert.match(file.name, /_resized\.jpg$/);
    // the real input is hidden, so FormGuard leaves a visible "attached" note after the success card fades
    await page.locator('formguard-root').getByText('File attached').first().waitFor({ timeout: 15000 });
  });
});

test('H. pixel-size rule: wrong picture is detected and fixed to exactly 200 x 230 under 50 KB', { timeout: 90000 }, async () => {
  await onPage('/test-form.html', async (page) => {
    await page.getByRole('button', { name: /Generate 900 × 500 photo/ }).click();
    const fix = page.locator('formguard-root .tip button.btn', { hasText: 'Fix the picture size' });
    await fix.waitFor({ timeout: 10000 });
    assert.match(joined(await h.tipTexts(page)), /900×500 pixels, but the site wants 200×230/);
    await fix.click();
    await page.locator('formguard-root').getByText('200×230 pixels').first().waitFor({ timeout: 10000 });
    const r = await page.evaluate(async () => {
      const f = document.getElementById('h-photo').files[0];
      const b = await createImageBitmap(f);
      return { w: b.width, h: b.height, size: f.size };
    });
    assert.deepStrictEqual([r.w, r.h], [200, 230]);
    assert.ok(r.size <= 50 * 1024, 'size ' + r.size);
  });
});

test('popup: plain status, Hindi switch, and the settings are reachable', { timeout: 60000 }, async () => {
  const id = new URL(h.worker.url()).host;
  const popup = await h.context.newPage();
  try {
    await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await popup.locator('#statusTitle').waitFor();
    // opened as a normal tab, the popup is looking at a browser page: it must say so, in words
    assert.match(await popup.locator('#statusTitle').innerText(), /can't work on this page/);
    await popup.getByRole('button', { name: 'हिन्दी' }).click();
    await popup.waitForTimeout(400);
    assert.match(await popup.locator('#statusTitle').innerText(), DEVANAGARI);
    assert.strictEqual((await h.getStorage('lang')).lang, 'hi');
    await popup.locator('summary').click();
    assert.ok(await popup.locator('#liveHint').isVisible());
    assert.ok(await popup.locator('#textSize').isVisible());
  } finally {
    await h.setSettings({ lang: 'en' });
    await popup.close();
  }
});

test('text size and high contrast reach the tooltip', { timeout: 60000 }, async () => {
  await h.setSettings({ textSize: 'xlarge', contrast: true });
  try {
    await onPage('/test-form.html', async (page) => {
      await page.getByRole('button', { name: 'Submit A' }).click();
      await page.waitForTimeout(1200);
      const host = page.locator('formguard-root');
      assert.strictEqual(await host.evaluate((n) => n.style.getPropertyValue('--s')), '1.4');
      assert.strictEqual(await host.evaluate((n) => n.hasAttribute('data-contrast')), true);
    });
  } finally { await h.setSettings({ textSize: 'normal', contrast: false }); }
});

test('privacy report page shows zero requests', { timeout: 60000 }, async () => {
  const id = new URL(h.worker.url()).host;
  const page = await h.context.newPage();
  try {
    await page.goto(`chrome-extension://${id}/report/report.html`);
    await page.locator('#netBody .big').waitFor();
    assert.match(await page.locator('#netBody .big').innerText(), /^0 requests · 0 bytes/);
  } finally { await page.close(); }
});

test('PRIVACY: after all of the above, FormGuard made no outside requests and sent nothing', async () => {
  const outside = h.requests.filter((r) => !r.url.startsWith(h.origin) && !r.url.startsWith('chrome-extension://')
    && !r.url.startsWith('data:') && !r.url.startsWith('blob:') && !r.url.startsWith('about:'));
  assert.deepStrictEqual(outside.map((r) => r.url), []);
  const { auditLog = [] } = await h.getStorage('auditLog');
  assert.strictEqual(auditLog.filter((e) => e.kind === 'sent').length, 0);
  assert.ok(auditLog.length > 5, 'the activity log should have recorded the reads');
});
