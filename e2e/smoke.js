// Quick manual check: node smoke.js   (not part of the test suite)
const { start } = require('./harness');
(async () => {
  const h = await start();
  try {
    const page = await h.open('/test-form.html');
    await page.getByRole('button', { name: 'Submit A' }).click();
    await page.waitForTimeout(1500);
    const tips = await h.tipTexts(page);
    console.log('tooltips:', tips.length);
    console.log(tips.slice(0, 4));
    console.log('badge:', await h.badge(page));
    console.log('external requests:', h.requests.filter((r) => !r.url.startsWith(h.origin) && !r.url.startsWith('chrome-extension://') && !r.url.startsWith('data:')).map((r) => r.url));
  } finally { await h.stop(); }
})().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
