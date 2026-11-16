# FormGuard compatibility

## Browsers

| Browser | Status | Notes |
|---|---|---|
| Google Chrome (current) | **Supported and tested** | Developed and tested here, by hand and with automated tests, on current Chrome / Chromium. Manifest V3; `minimum_chrome_version` is 110, but older versions than the current one were **not** tested. |
| Microsoft Edge (Chromium) | Expected to work, **not tested** | Same engine and extension APIs as Chrome. Load it with `edge://extensions` → Developer mode → Load unpacked. |
| Brave, Opera, other Chromium browsers | Expected to work, not tested | Same reason. |
| Firefox | **Not supported yet** | Needs a small port: Firefox runs MV3 background code as an "event page" (`background.scripts`) rather than a `service_worker`, and the manifest needs a `browser_specific_settings.gecko.id`. Everything else used here (`scripting`, `storage.session`, `:user-invalid`, `speechSynthesis`) exists in current Firefox. Not attempted or tested. |
| Safari | Not supported | Needs conversion with Xcode's web-extension converter. |

## What works on which kind of page

| Page type | Works? | Notes |
|---|---|---|
| Ordinary forms (HTML5 validation, custom red-border / error text) | Yes | Core feature. Covered by automated tests. |
| Framework forms (Angular `ng-invalid`, Bootstrap `is-invalid`, PrimeNG) | Yes | Detection signals added; confirmed on IRCTC login by hand. |
| One banner for the whole form ("Incorrect username or password") | Yes | Explained as a sign-in problem. |
| Forms inside iframes | Yes (tested) | Needs the extension to be allowed on the frame's site. Cross-origin frames work once "all websites" is turned on. |
| Forms inside **open** Shadow DOM (web components) | Yes (tested) | |
| Forms inside **closed** Shadow DOM | No | Browsers do not let any extension see inside a closed shadow root. |
| File upload with hidden styled buttons | Yes (tested) | An "✓ Attached" note is shown because the browser shows no file name. |
| Picture size rules in pixels | Yes (tested) | Only when the site's own text states pixels, e.g. "200 x 230 pixels". |
| Pages opened as local `file://` files | Only if you enable "Allow access to file URLs" | Serve them with `npm run test-page` instead. |
| `chrome://` pages, the Chrome Web Store | No | Chrome blocks all extensions there. |

## How this is checked

- **Automated, in a real browser:** `cd e2e && npm test` loads the extension into Chromium and runs 14 checks against `test/test-form.html` (sections A–H), including the zero-network-requests check.
- **Compatibility sweep on real portals:** `cd e2e && npm run sweep`. It opens each site in `e2e/sites.json` with the extension, presses the first submit-like button on empty fields, and records what FormGuard found. Results below are regenerated each run.

> The sweep is a **first screening, not a guarantee**. It runs in a headless robot browser on public pre-login pages. Sites that block robots, show a captcha or need a real login will show "no form found" even if FormGuard would work for a real person. Confirm important portals by hand.

## Sweep results

<!-- SWEEP:START -->
_Last run: 2026-11-16 · headless Chromium · empty-submit test · public pre-login pages_

**2 of 12** sites: FormGuard explained at least one error. **5 of 12** sites: a form was found.

| Site | Result | Fields seen | Errors explained | Rules matched | Sample tooltip | Notes |
|---|---|---|---|---|---|---|
| [Control: classic login (the-internet)](https://the-internet.herokuapp.com/login) | 🟢 errors explained | 2 | 1 | form-level | Sign-in problem: username or password rejected — hover for help | Known-good baseline: a plain login form with a banner error. |
| [IRCTC (train search + login)](https://www.irctc.co.in/nget/train-search) | ⚪ not reached | 0 | 0 | — | — | Could not load: page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.irctc.co.in/nget/train-search |
| [UIDAI - My Aadhaar](https://myaadhaar.uidai.gov.in/) | ⚪ no form found | 0 | 0 | — | — | — |
| [Income Tax e-filing login](https://eportal.incometax.gov.in/iec/foservices/#/login) | ⚪ not reached | 0 | 0 | — | — | Could not load: page.goto: Timeout 35000ms exceeded. |
| [DigiLocker](https://www.digilocker.gov.in/) | 🟢 errors explained | 1 | 1 | mobile | Mobile number Mobile number has 10 numbers. It starts with 6, 7, 8 or 9. This box is empty. Please fill it. � Read aloud Example: 98XXXXXXXX More help | — |
| [SBI online banking login](https://retail.onlinesbi.sbi/retail/login.htm) | 🟡 form seen, no error appeared | 3 | 0 | password, captcha | — | — |
| [National Scholarship Portal](https://scholarships.gov.in/) | ⚪ no form found | 0 | 0 | — | — | — |
| [Passport Seva login](https://www.passportindia.gov.in/AppOnlineProject/user/userLogin) | ⚪ no form found | 0 | 0 | — | — | — |
| [SSC](https://ssc.gov.in/) | 🟡 form seen, no error appeared | 4 | 0 | — | — | — |
| [EPFO member portal](https://unifiedportal-mem.epfindia.gov.in/memberinterface/) | ⚪ no form found | 0 | 0 | — | — | — |
| [PM-KISAN](https://pmkisan.gov.in/) | ⚪ no form found | 0 | 0 | — | — | — |
| [SAP SuccessFactors careers sign-in](https://career5.successfactors.eu/careers?company=EYHRISPRD1) | 🟡 form seen, no error appeared | 14 | 0 | — | — | — |
<!-- SWEEP:END -->
