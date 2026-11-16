# Chrome Web Store listing (draft)

## Name
FormGuard – Private Form Error Helper

## Summary (max 132 characters)
Explains form errors in simple English or हिन्दी, fixes photo and signature uploads, all on your device. Never reads what you type.

## Category
Productivity (or Accessibility)

## Single purpose (the Web Store asks for this)
Help users understand and fix errors on web forms, including file-upload size and type problems, without sending form data anywhere.

## Description
Government and bank forms often say only "Invalid input". FormGuard tells you what is wrong, in simple words, and what to do.

**What it does**
- Explains each form error in plain English or हिन्दी: "PIN code has 6 numbers. You typed 4. Add 2 more."
- Shows a live counter while you type: "Mobile number: 6 of 10 numbers".
- Understands Indian forms: Aadhaar, PAN, IFSC, mobile, PIN code, OTP, GSTIN, UPI, passport and more.
- Fixes photo and signature uploads: makes them the right size in KB and in pixels, right on your device.
- Explains banners like "Incorrect username or password" and warns before an account gets locked.
- Reads advice aloud, using a voice already on your device.
- Larger text and high-contrast options.

**Private by design**
- It never reads, stores or sends what you type, and makes no network requests in its default setting.
- No account, no analytics, no ads.
- A built-in privacy report shows the real numbers (zero requests) and how to verify them yourself.
- An optional AI helper exists for unknown errors. It is OFF by default and, when on, can only send field names and error text, never what you typed.

**Works on** forms in normal pages, iframes and web components. It starts by itself on every site once you allow it once, or only on the tab you click.

## Screenshots to capture (1280×800)
1. Section A of the test page with the yellow notes, English.
2. The same page in Hindi.
3. A card expanded: big sentence, action line, example.
4. The live counter turning green.
5. The file card with "Make it smaller for me", and the success note.
6. The popup: status card + "Turn on help" button.
7. The privacy report showing "0 requests".

## Permission justifications (the Web Store asks for each)
| Permission | Justification |
|---|---|
| `activeTab` | Lets FormGuard work on the page the user is looking at, only after the user clicks the extension icon. |
| `scripting` | Starts the helper script on that page to read field labels and error messages. |
| `storage` | Saves the user's settings and an activity log on the user's own device. |
| Optional host access (`http://*/*`, `https://*/*`) | Requested only when the user presses "Turn on help for all websites", so FormGuard can start automatically on every site. Can be removed any time. |

## Privacy practices form
- Collects user data: **No**.
- Sells data / uses it for unrelated purposes / for creditworthiness: **No**.
- Remote code: **No**.
- Privacy policy URL: host `docs/PRIVACY.md` (for example as a GitHub Pages page) and paste the link.

## Before you submit
- [ ] Fill in the contact details in `docs/PRIVACY.md`.
- [ ] Have a Hindi speaker review the Hindi wording (`lib/rulesText.js`, `lib/i18n.js`, `popup/popupText.js`).
- [ ] Run `npm test` and `cd e2e && npm test`.
- [ ] Zip the `extension` folder (not the repo root) for upload.
