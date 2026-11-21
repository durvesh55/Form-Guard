# Development guide

Technical details, file map, tests and evaluation plan for FormGuard. See the [README](../README.md) for the overview.

A privacy-preserving Chrome (Manifest V3) extension that detects form errors on any page, explains them in plain language, and helps fix file-upload problems (size, type, image dimensions) **entirely on your device**. Built for ISRO problem statement PS 26171.

## Quick start

```
npm test          # 7 unit tests (node --test, no dependencies)
npm run test-page # serves test/test-f
orm.html on localhost
npm run icons     # regenerate extension/icons
npm run server    # optional fallback explainer on http://localhost:3000
```

Load the extension: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder. Open the test page, click the FormGuard toolbar icon, and press **Check this page**.

## How it works

1. **Detect** — `content/detector.js` finds fields in an error state (`aria-invalid`, `:user-invalid`, red border, site error text). No polling: it rescans only after DOM mutations or user events.
2. **Identify** — `lib/ruleEngine.js` scores each field's label / name / id / placeholder against `lib/rules.js` (Aadhaar, PAN, IFSC, mobile, PIN code, GSTIN, UPI, etc.).
3. **Explain** — a tooltip (Shadow DOM, so page CSS can't break it) shows one short sentence of what the field needs, one "do this" line (e.g. *You typed 4. Add 2 more numbers.*), and a **fake** example. Longer help sits behind a **More help** button. Language: **English or हिन्दी**, chosen in the popup (Settings → Language / भाषा). If the site supplied a regex `pattern`, `lib/regexToEnglish.js` translates it to English.
4. **Files** — `content/fileAssist.js` reads only file size, MIME type and extension, extracts limits like "Max 50 KB" from nearby text, and `content/imageResize.js` can resize/compress an image in a canvas ("Resize for me") and put it back into the input.
5. **Optional AI fallback** — off by default. Used only if no local rule matches.

## File map

| Path | Purpose |
|---|---|
| `extension/manifest.json` | MV3 manifest, minimal permissions |
| `extension/background.js` | Service worker: audit log, toolbar badge, the **only** network code, auto-run registration |
| `extension/lib/sanitizer.js` | Strips PII (Aadhaar, PAN, phone, email, card-like numbers…) from any outgoing payload |
| `extension/lib/rules.js` | JSON-style rule table for Indian form fields |
| `extension/popup/popupText.js` | Every word of the popup and welcome page, English + Hindi |
| `extension/welcome/` | One-time first-run page: pick a language, turn on help for all websites |
| `extension/lib/rulesText.js` | Plain-language one-liners and Hindi wording for each rule, keyed by rule id |
| `extension/lib/i18n.js` | Every sentence the engine can say, in English and Hindi |
| `extension/lib/ruleEngine.js` | Matches a field to a rule and checks the value shape by length only |
| `extension/lib/regexToEnglish.js` | Converts HTML `pattern` regexes to readable text |
| `extension/content/dom.js` | Label / error-text / hint discovery. Never reads `element.value` |
| `extension/content/detector.js` | Orchestrates scanning, tooltips, audit entries |
| `extension/content/tooltip.js` | Shadow-DOM tooltip UI (`textContent` only, never `innerHTML`) |
| `extension/content/fileAssist.js` | File metadata checks and limit parsing |
| `extension/content/imageResize.js` | On-device image resize/compress |
| `extension/popup/*` | Toolbar popup: toggles, audit log viewer, always-run-on-this-site |
| `server/server.js` | Optional Express fallback explainer |
| `test/test-form.html`, `test/serve.js` | Manual test page and its static server |
| `tests/unit.test.js` | Unit tests |

## Permissions — and why

| Permission | Reason |
|---|---|
| `activeTab` | Run on the current tab only when you click the icon |
| `scripting` | Inject the content scripts on that click |
| `storage` | Save your toggles and the local audit log |
| `optional_host_permissions` (`http(s)://*/*`) | **Optional.** Requested only when you press "Turn on help for all websites", so FormGuard can start by itself everywhere (including inside iframes). You can remove it any time in `chrome://extensions` |

No `tabs`, no `webRequest`, no `history`, no remote code. Nothing is granted at install time beyond the three basic permissions.

## Privacy model

- The extension **never reads what you type**. Only the *length* of a value is used. File **contents** are never uploaded.
- Network access exists in exactly one place (`background.js → explainWithAI`) and refuses to run when **AI fallback is OFF** (the blocked attempt is logged: "0 bytes sent").
- When ON, only `{ label, type, pattern, errorText, valueLength }` is sent, sanitised twice (extension and server). The server rejects any other key and does not store anything.
- The audit log (last 300 events, `chrome.storage.local`) records every local action and every byte sent, so you can verify the claims yourself. When you move to a new website the per-field notes are cleared automatically, but `sent` / `blocked` entries are always kept.
- A **live privacy report** (popup → More settings → Open privacy report) shows requests sent, bytes sent, speed in milliseconds, permissions and how to verify it in DevTools.
- Picture width × height is read only when a site's text asks for pixel sizes, decoded in memory and forgotten. Boxes no rule understood are listed on this device only (label / type / name — never a value) and can be saved to a file if you choose.

## Automated tests

| Command | What it checks |
|---|---|
| `npm test` | 21 fast unit tests: rules, wording in English and Hindi, live counter, size parsing, audit-log pruning |
| `npm run e2e` | 14 **real-browser** tests: Chromium loads the extension and drives `test/test-form.html` sections A–H (tooltips, Hindi, iframe, Shadow DOM, live counter, file fixes, popup, privacy report, zero network requests). First run downloads Chromium (`cd e2e && npm run setup`) |
| `npm run e2e:sweep` | Visits real Indian portals listed in `e2e/sites.json` and writes a compatibility table to `docs/COMPATIBILITY.md` |

`tools/make-test-build.js` makes the test copy of the extension (it starts by itself, because a robot cannot click the toolbar icon). The real `extension/` folder is never changed by it.

## Documents

- [`docs/PRIVACY.md`](PRIVACY.md) — privacy policy
- [`docs/DEMO.md`](DEMO.md) — 6-minute demo script
- [`docs/STORE_LISTING.md`](STORE_LISTING.md) — Chrome Web Store draft, permission justifications, screenshot list
- [`docs/COMPATIBILITY.md`](COMPATIBILITY.md) — browsers, page types, real-portal sweep

## Manual test checklist

Open `npm run test-page` and verify:

- [ ] Typing a bad PIN code / Aadhaar / PAN and blurring shows a tooltip with the right rule.
- [ ] Several errors at once collapse into compact chips; clicking a chip expands it.
- [ ] Toolbar badge shows the error count.
- [ ] Uploading the 2 MB test photo into a "Max 50 KB" input shows a size warning; **Resize for me** produces a compliant file.
- [ ] Wrong file type (e.g. PDF into a JPG-only input) is flagged.
- [ ] Popup toggles (extension on/off, tooltips) take effect.
- [ ] AI fallback OFF: audit log shows `blocked`, nothing leaves the browser (check DevTools → Network).
- [ ] AI fallback ON + server running: unknown field gets a `server-heuristic` explanation, log shows `sent` with the sanitised payload.
- [ ] "Turn on help for all websites" prompts once; removing the permission in `chrome://extensions` stops auto-run.
- [ ] Section F (Shadow DOM), G (iframe) and H (picture 200 × 230 px) show tooltips / the fix button.
- [ ] Focus a Mobile field and type: a counter "5 of 10 numbers" turns green at 10.

## IRCTC guide

The rules include IRCTC-flavoured hints: user ID 3–35 characters (letters, digits, `_`, `.`), password 8–15 characters with upper/lower/digit/special, a captcha that is case-sensitive and refreshes on failure, and OTPs that expire quickly. To try it: turn on help for all websites once, then open the IRCTC page and press LOGIN with empty or wrong fields (or click the FormGuard icon and **Check this page again**). Photo/signature uploads with tight KB limits are where **Resize for me** helps most.

## Phase 9 — Evaluation plan

| Metric | How to measure |
|---|---|
| Detection recall | Collect 20–30 real forms; count fields in error that FormGuard flagged / total fields in error |
| Rule accuracy | For each flagged field, was the matched rule correct? (precision) |
| Explanation usefulness | 5–10 users fix the same broken form with and without FormGuard; compare time-to-success and attempts |
| File-fix success | % of oversized images that pass the site's validation after **Resize for me** |
| Privacy | Inspect DevTools → Network with AI OFF (expect 0 requests); review audit log with AI ON; run sanitizer tests on synthetic PII |
| Performance | Scan time per mutation (Performance panel) and memory on a 100-field page |

## Swapping in a real model (Transformers.js)

The fallback is deliberately pluggable:

- **On-device (preferred for privacy):** bundle Transformers.js plus a small text2text model (e.g. a quantised FLAN-T5-small) as an extension asset, load it in an offscreen document or the service worker, and call it from `explainWithAI` instead of `fetch`. Nothing then leaves the device and `serverUrl` becomes unnecessary. MV3 forbids remote code, so the model and runtime must ship inside the extension package (mind the package size).
- **Server-side:** replace the body of `explain()` in `server/server.js` with a call to your model, passing **only** the sanitised payload `p` in the prompt.

Keep the sanitiser in front of either path.

## Notes

- Edit files with an editor that keeps UTF-8 (on Windows PowerShell 5.1, `Get-Content`/`Set-Content` can corrupt non-ASCII characters).
- Add rules by appending to `RULES` in `extension/lib/rules.js`, and add its `simple` + `hi` wording in `extension/lib/rulesText.js` (a unit test fails if a rule has no Hindi wording).
- Add a language: copy the `en` block in `extension/lib/i18n.js`, translate it, add `hi`-style wording per rule in `rulesText.js`, and add an `<option>` in `popup/popup.html`. The file-upload helper's messages are still English only.
