# FormGuard demo script (about 6 minutes)

Use this for a recording or a live demo. Everything runs from `test/test-form.html` except steps 7 and 8.

## Before you start (2 minutes)
1. `npm run test-page`, then open the URL it prints (usually `http://localhost:8080/test-form.html`).
2. Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** → the `extension` folder.
3. Open the FormGuard popup and click **Turn on help for all websites**, accept Chrome's prompt.
4. Open DevTools (F12) → **Network** tab → tick **Preserve log**. Leave it visible for the whole demo: this is the privacy proof.

## The story to tell
> "Government forms give errors like 'Invalid input'. Many people can't tell what is wrong, especially in a second language. FormGuard explains the mistake in simple words, on the user's own device, without ever reading what they type."

## Steps

| # | Do this | Say / point out | Expected result |
|---|---|---|---|
| 1 | Click **Submit A** | "Every field is wrong on purpose." | 12 yellow notes. Each says what to do: "Mobile number: 5 more numbers needed". |
| 2 | Hover the **PIN code** note | "Big sentence first, one action line, an example. The long explanation is behind *More help*." | Card with "PIN code has exactly 6 numbers" and "You typed 4. Add 2 more numbers." |
| 3 | Point at **Aadhaar**: value is `1234 5678` | "It counts numbers, not spaces. 8 numbers, so 4 more." | "Aadhaar number: 4 more numbers needed" |
| 4 | Popup → **हिन्दी** | "One click. Every note is now Hindi, the popup too." | All notes switch to Hindi, e.g. "पिन कोड: 2 अंक और चाहिए" |
| 5 | Click **🔊 सुनिए / Read aloud** on a note | "For people who find reading hard. Uses the device's own voice, so nothing is sent." | The sentence is spoken (needs an offline voice on the computer). |
| 6 | Click into **Mobile Number**, clear it, type slowly | "Help *before* the mistake: a live counter." | "Mobile number: 3 of 10 numbers" → green "✓ 10 numbers" |
| 7 | Section **E**: click **Login** | "Many sites show one red banner for the whole form, like IRCTC." | A "Sign-in problem" note under Username explaining it, warning about attempts. |
| 8 | Section **G** (iframe) and **F** (web component) | "Forms hidden in iframes and shadow DOM are handled too." | Notes appear inside both; the toolbar badge adds up the count. |
| 9 | Section **D**: **Generate 300 KB image → Signature**, then the blue **Make it smaller** button | "The site wants under 20 KB. FormGuard shrinks it right here, in memory." | "Done! The picture is now 19 KB…", then a lasting "✓ File attached" note. |
| 10 | Section **H**: **Generate 900 × 500 photo**, then **Fix the picture size** | "The site wants exactly 200 × 230 pixels and under 50 KB. One button does both." | "The picture is now 200×230 pixels and 38 KB". |
| 11 | Look at the **Network** tab | "Zero requests from FormGuard. Nothing left the device." | Only the test page's own files. |
| 12 | Popup → **More settings** → **Open privacy report** | "Live numbers, not claims." | "0 requests · 0 bytes", speed in milliseconds, permissions, how to verify. |

## Optional extras (if time allows)
- **Text size → Extra large** and **High contrast** in More settings (accessibility).
- Open `chrome://extensions` → FormGuard → Details to show the short permission list.
- Run `cd e2e && npm test` to show 14 automated real-browser checks passing.
- Show a real site: open IRCTC login, press LOGIN with empty fields.

## If something does not appear
- No notes at all: check the popup says "Active" or "Help is on", then press **Check this page again**.
- Read-aloud says "no offline voice": install the Hindi voice in Windows Settings → Time & language → Speech.
- File notes missing: the picture generators need the page to be served (`npm run test-page`), not opened as a file.
