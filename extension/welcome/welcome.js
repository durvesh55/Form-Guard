/**
 * welcome.js — first-run page (opened once, right after install).
 * Two steps: pick a language, turn on help for all websites. Both are optional; the toolbar
 * popup offers the same choices later. Permission requests need a click, which is why this is a button.
 */
'use strict';

const ALL_SITES = ['https://*/*', 'http://*/*'];
const $ = (id) => document.getElementById(id);
let lang = 'en';
const T = (k) => globalThis.FG_UI.t(lang, k);

function render(allOn) {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T(n.dataset.i18n); });
  document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('turnOnBtn').hidden = allOn;
  $('turnOnBtn').nextElementSibling.hidden = allOn;   // the note under the button
  $('done').hidden = !allOn;
}

async function allOn() { return chrome.permissions.contains({ origins: ALL_SITES }); }

document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', async () => {
  lang = b.dataset.lang;
  chrome.storage.local.set({ lang });
  render(await allOn());
}));

$('turnOnBtn').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ALL_SITES });
  render(granted);
});

(async function init() {
  const { lang: saved } = await chrome.storage.local.get({ lang: 'en' });
  lang = saved === 'hi' ? 'hi' : 'en';
  render(await allOn());
})();
