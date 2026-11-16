# FormGuard privacy policy

_Last updated: 2026-11-16. Replace the bracketed parts before publishing._

**FormGuard** helps people understand form errors on websites, and fix file-upload problems, in plain English or Hindi. It is built to work **entirely on your own device**.

## The short version

- FormGuard **does not collect, store or send anything you type** into a form. Not passwords, Aadhaar, PAN, OTPs or anything else.
- FormGuard **does not send any data to any server** in its default setting. It makes no network requests at all.
- There are **no accounts, no analytics, no advertising and no tracking**.
- The optional "AI help" is **off by default**. See below.

## What FormGuard reads on a page

Only while you use a page it has been allowed to run on, and only inside your browser:

| Read | Why |
|---|---|
| The label, type, name and format rules of a form field (for example "Mobile number, 10 digits") | To work out what the field expects |
| The text of the error message the website itself shows | To explain it in simpler words |
| **How many characters** you typed in a field (a number) | To say "you typed 6, add 4 more". The characters themselves are never read, kept or sent |
| For a file you chose: its size and type; and its picture width and height only when the site asks for pixel sizes | To check it against the site's limits. The picture is decoded in memory on your device and then forgotten |

FormGuard **never reads or stores**: what you type, file contents or file names (a file name is shown on your own screen only), your browsing history, or other tabs.

## What is stored on your device

Kept in your browser's own extension storage (`chrome.storage`), never sent anywhere:

- Your settings (language, text size, contrast, switches).
- A short **activity log** (at most 300 entries) listing which fields were checked and that nothing was sent, so you can see what FormGuard did. It contains no typed values.
- A list of **boxes FormGuard did not understand** (label, type, name, placeholder: never a value). You can save this list as a file and share it **only if you choose to**.

You can clear the log at any time from the popup, and removing the extension deletes everything.

## Optional "AI help" (off by default)

If you switch it on **and** a field cannot be explained on-device, FormGuard may send the field's name, type, format rules, the website's error text and the **number** of characters typed to a server address **you** configure. Emails, phone numbers, Aadhaar/PAN/IFSC-like text and quoted values are removed before sending, and again by the server. **Typed values are never part of this.** Every such request is shown in the activity log, with the exact payload. Turn it off and nothing is ever sent.

## Permissions, and why

| Permission | Why FormGuard needs it |
|---|---|
| `activeTab` | To work on the page you are looking at, only after you click the icon |
| `scripting` | To start FormGuard's helper on that page |
| `storage` | To remember your settings and the activity log on your device |
| Optional: access to all websites | Only if **you** press "Turn on help for all websites". Lets FormGuard start by itself on every site. You can remove it any time in `chrome://extensions` |

## Third parties

None. FormGuard loads no remote code, no fonts, no scripts and no analytics. Read-aloud uses only voices already installed on your device.

## Children

FormGuard collects no personal data from anyone, including children.

## Changes

If this policy changes, the date above changes. Material changes will be mentioned in the extension's release notes.

## Contact

[Your name / institution] · [contact email] · [project page URL]
