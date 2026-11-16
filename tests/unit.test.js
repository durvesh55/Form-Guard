/**
 * Unit tests for the on-device logic. Run with:   node --test tests/
 * (uses Node's built-in test runner — no install needed)
 */
const test = require('node:test');
const assert = require('node:assert');
const { regexToEnglish } = require('../extension/lib/regexToEnglish.js');
const { sanitizeText, buildSafePayload } = require('../extension/lib/sanitizer.js');
const { explain, findRule } = require('../extension/lib/ruleEngine.js');
const { RULES } = require('../extension/lib/rules.js');

test('regexToEnglish: common Indian patterns', () => {
  assert.strictEqual(regexToEnglish('[0-9]{6}').text, 'exactly 6 digits');
  assert.strictEqual(regexToEnglish('\\d{6}').text, 'exactly 6 digits');
  assert.strictEqual(regexToEnglish('[6-9][0-9]{9}').text, '1 digit from 6 to 9, then 9 digits');
  assert.strictEqual(regexToEnglish('[A-Z]{5}[0-9]{4}[A-Z]{1}').text,
    '5 uppercase letters, then 4 digits, then 1 uppercase letter');
  assert.strictEqual(regexToEnglish('^[A-Z]{4}0[A-Z0-9]{6}$').text,
    '4 uppercase letters, then the character "0", then 6 uppercase letters or digits');
  assert.strictEqual(regexToEnglish('[A-Za-z ]+').text, 'one or more letters or spaces');
  const pw = regexToEnglish('(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}');
  assert.strictEqual(pw.text, 'at least 8 characters; must contain at least one digit; must contain at least one lowercase letter; must contain at least one uppercase letter');
  assert.strictEqual(pw.minLength, 8);
  assert.strictEqual(regexToEnglish('(\\+91)?[6-9]\\d{9}').text.startsWith('optionally'), true);
});

test('regexToEnglish: lengths and fallbacks', () => {
  const r = regexToEnglish('[0-9]{6}');
  assert.deepStrictEqual([r.minLength, r.maxLength], [6, 6]);
  assert.strictEqual(regexToEnglish('[0-9]{4,8}').text, 'exactly 4 to 8 digits'.replace('exactly ', ''));
  assert.match(regexToEnglish('([a-z').text, /must match the format/);   // invalid regex
  assert.strictEqual(regexToEnglish('').text, '');
});

test('sanitizer removes PII', () => {
  const s = sanitizeText("'rahul@gmail.com' is invalid, phone 9876543210, aadhaar 2345 6789 0123, PAN ABCDE1234F");
  assert.ok(!/rahul|9876543210|2345|ABCDE1234F/.test(s.clean), s.clean);
  const types = s.removed.map((r) => r.type);
  assert.ok(types.includes('aadhaar') && types.includes('phone') && types.includes('pan'));
});

test('safe payload contains ONLY whitelisted keys', () => {
  const { payload } = buildSafePayload({ label: 'PIN', type: 'text', pattern: '\\d{6}', errorText: 'bad', valueLength: 4, value: 'SECRET', name: 'x' });
  assert.deepStrictEqual(Object.keys(payload).sort(), ['errorText', 'label', 'pattern', 'type', 'valueLength']);
  assert.ok(!JSON.stringify(payload).includes('SECRET'));
});

test('rule matching', () => {
  assert.strictEqual(findRule({ label: 'PIN Code' }).rule.id, 'pincode');
  assert.strictEqual(findRule({ label: 'Login PIN' }).rule.id, 'mpin');
  assert.strictEqual(findRule({ nameAttr: 'txtMobileNo' }).rule.id, 'mobile');
  assert.strictEqual(findRule({ label: 'Confirm Password', type: 'password' }).rule.id, 'confirm-password');
  assert.strictEqual(findRule({ label: 'Password', type: 'password' }).rule.id, 'password');
  assert.strictEqual(findRule({ label: 'User Name' }).rule.id, 'username');
  assert.strictEqual(findRule({ label: 'Company' }), null);   // "pan" must not match inside "company"
  assert.strictEqual(findRule({ label: 'IFSC Code' }).rule.id, 'ifsc');
  assert.ok(RULES.length >= 15);
});

test('the visible label beats a misleading hidden name', () => {
  // SuccessFactors-style: label says "Email Address:" but the input is named "username"
  const m = findRule({ label: 'Email Address:', nameAttr: 'username fbclc_userName', type: 'text' });
  assert.strictEqual(m.rule.id, 'email');
  assert.strictEqual(findRule({ label: 'Mobile No.', nameAttr: 'txtPin' }).rule.id, 'mobile');
  // no useful label -> the hidden name still works
  assert.strictEqual(findRule({ label: 'Enter value', nameAttr: 'txtAadhaarNumber' }).rule.id, 'aadhaar');
  assert.strictEqual(findRule({ label: '', nameAttr: 'user_name' }).rule.id, 'username');
  const s = explain({ label: 'Email Address:', nameAttr: 'username', type: 'text', required: true, valueLength: 0 });
  assert.strictEqual(s.ruleId, 'email');
  assert.ok(s.lines[0].text.includes('name@gmail.com'), s.lines[0].text);
});

const texts = (s) => [...s.lines.map((l) => l.text), ...s.points, s.summary].join(' | ');
const DEVANAGARI = /[\u0900-\u097F]/;

test('length feedback uses plain words and says what to do', () => {
  const s = explain({ label: 'PIN Code', type: 'text', errorText: 'Invalid input', valueLength: 4 });
  assert.ok(s.lines.some((l) => l.kind === 'action' && l.text === 'You typed 4. Add 2 more numbers.'), texts(s));
  assert.strictEqual(s.lines[0].kind, 'main');
  assert.ok(s.lines[0].text.includes('exactly 6 numbers'), s.lines[0].text);
  assert.ok(s.points[0].startsWith('The site only said'));
  const t = explain({ label: 'Mobile', type: 'tel', valueLength: 12 });
  assert.ok(t.lines.some((l) => l.text === 'You typed 12. Remove 2 numbers.'), texts(t));
  const one = explain({ label: 'PIN Code', type: 'text', valueLength: 5 });
  assert.ok(one.lines.some((l) => l.text.includes('Add 1 more number.')), texts(one)); // singular
});

test('digit fields count digits only, not spaces or dashes', () => {
  // "1234 5678" = 8 digits + 1 space (valueLength 9) -> 4 more numbers, not 3
  const a = explain({ label: 'Aadhaar number', type: 'text', valueLength: 9, digitCount: 8 });
  assert.ok(a.lines.some((l) => l.text === 'You typed 8. Add 4 more numbers.'), texts(a));
  assert.ok(a.lines.some((l) => l.text.startsWith('Remove spaces and dashes')), texts(a));
  assert.ok(a.headline.startsWith('4 more'), a.headline);
  // right count but separators: "1234 5678 9012" -> only the separator advice
  const c = explain({ label: 'Aadhaar number', type: 'text', valueLength: 14, digitCount: 12 });
  assert.ok(c.lines.some((l) => l.text.startsWith('Remove spaces and dashes')), texts(c));
  assert.ok(!c.lines.some((l) => /Add \d+ more/.test(l.text)), texts(c));
  // no separators -> same count either way
  const b = explain({ label: 'Aadhaar number', type: 'text', valueLength: 8, digitCount: 8 });
  assert.ok(b.lines.some((l) => l.text === 'You typed 8. Add 4 more numbers.'), texts(b));
  assert.ok(!b.lines.some((l) => l.text.startsWith('Remove spaces')), texts(b));
});

test('form-level banner is explained as a sign-in problem, not a username-format rule', () => {
  const s = explain({ label: 'Username', type: 'text', formLevel: true, valueLength: 3,
    errorText: 'Incorrect UserName or Password. If you have recently changed it, use the latest one. You have 3 attempts remaining.' });
  assert.strictEqual(s.ruleId, 'form-level');
  assert.strictEqual(s.title, 'Sign-in problem');
  assert.strictEqual(s.needsAI, false);
  assert.ok(s.lines.some((l) => l.kind === 'action' && l.text.includes('lock the account')), texts(s));
});

test('simple card: short main line + one action, long detail kept for "More help"', () => {
  const s = explain({ label: 'PIN Code', type: 'text', valueLength: 4 });
  assert.ok(s.lines.length <= 3, 'too many big lines: ' + s.lines.length);
  assert.ok(s.lines[0].text.length < 80, s.lines[0].text);
  assert.ok(s.ui && s.ui.more === 'More help');
  assert.ok(!/regex|rule:|digits? from/i.test(s.lines.map((l) => l.text).join(' ')), 'no jargon in the big lines');
});

test('Hindi: every part of the card is in Hindi', () => {
  const s = explain({ label: 'PIN Code', type: 'text', valueLength: 4, lang: 'hi' });
  assert.strictEqual(s.title, 'पिन कोड');
  assert.ok(DEVANAGARI.test(s.lines[0].text), s.lines[0].text);
  assert.ok(s.lines.some((l) => l.text === 'आपने 4 अंक डाले हैं। 2 अंक और डालिए।'), texts(s));
  assert.ok(DEVANAGARI.test(s.headline) && s.headline.includes('2 अंक'), s.headline);
  assert.strictEqual(s.ui.more, 'और मदद');
  assert.strictEqual(s.lang, 'hi');
  // no English leaks into the big lines or the chip
  assert.ok(!/[A-Za-z]{4,}/.test(s.lines.map((l) => l.text).join(' ') + s.headline), texts(s));
});

test('Hindi: digits-only counting, empty field, form-level banner, unknown field', () => {
  const a = explain({ label: 'Aadhaar number', type: 'text', valueLength: 9, digitCount: 8, lang: 'hi' });
  assert.ok(a.lines.some((l) => l.text === 'आपने 8 अंक डाले हैं। 4 अंक और डालिए।'), texts(a));
  assert.ok(a.lines.some((l) => l.text.includes('खाली जगह')), texts(a));
  const e = explain({ label: 'Full Name', type: 'text', required: true, valueLength: 0, lang: 'hi' });
  assert.ok(e.lines.some((l) => l.text.startsWith('यह खाना खाली है')), texts(e));
  const f = explain({ label: 'Username', type: 'text', formLevel: true, lang: 'hi',
    errorText: 'Incorrect UserName or Password. You have 1 attempts remaining.' });
  assert.strictEqual(f.title, 'लॉगिन में समस्या');
  assert.ok(f.lines.some((l) => l.text.includes('लॉक')), texts(f));
  const u = explain({ label: 'Widget code', type: 'text', errorText: 'Invalid', lang: 'hi' });
  assert.ok(DEVANAGARI.test(u.lines[0].text) && u.title === 'Widget code', texts(u));
});

test('every rule has Hindi wording, and unknown languages fall back to English', () => {
  const { RULE_TEXT } = require('../extension/lib/rulesText.js');
  for (const r of RULES) {
    const x = RULE_TEXT[r.id];
    assert.ok(x && x.simple, `rule ${r.id} has no simple English line`);
    assert.ok(x.hi && x.hi.title && DEVANAGARI.test(x.hi.simple), `rule ${r.id} has no Hindi wording`);
  }
  const s = explain({ label: 'PIN Code', type: 'text', valueLength: 4, lang: 'fr' });
  assert.strictEqual(s.lang, 'en');
  assert.strictEqual(s.title, 'PIN code');
});

test('site switch clears read/local notes but never sent/blocked entries', () => {
  const { pruneForSiteSwitch } = require('../extension/lib/auditLog.js');
  const log = [
    { kind: 'read', host: 'a.com' }, { kind: 'local', host: 'a.com' },
    { kind: 'sent', host: 'a.com', bytes: 104 }, { kind: 'blocked', host: 'a.com' }, { kind: 'read', host: 'a.com' },
  ];
  const { kept, removed } = pruneForSiteSwitch(log);
  assert.strictEqual(removed, 3);
  assert.deepStrictEqual(kept.map((e) => e.kind), ['sent', 'blocked']);
  assert.deepStrictEqual(pruneForSiteSwitch(undefined), { kept: [], removed: 0 });
  assert.strictEqual(pruneForSiteSwitch([{ kind: 'sent' }]).removed, 0);
});

test('unknown field asks for AI only when nothing local matches', () => {
  assert.strictEqual(explain({ label: 'Widget code', type: 'text', errorText: 'Invalid' }).needsAI, true);
  assert.strictEqual(explain({ label: 'Widget code', type: 'text', pattern: '[0-9]{3}' }).needsAI, false);
});
