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

test('length feedback', () => {
  const s = explain({ label: 'PIN Code', type: 'text', errorText: 'Invalid input', valueLength: 4 });
  assert.ok(s.points.some((p) => p.includes('You entered 4 characters') && p.includes('2 more')), s.points.join('|'));
  assert.ok(s.points[0].startsWith('The site only said'));
  const t = explain({ label: 'Mobile', type: 'tel', valueLength: 12 });
  assert.ok(t.points.some((p) => p.includes('2 too many')));
});

test('digit fields count digits only, not spaces or dashes', () => {
  // "1234 5678" = 8 digits + 1 space (valueLength 9) -> 4 more digits, not 3
  const a = explain({ label: 'Aadhaar number', type: 'text', valueLength: 9, digitCount: 8 });
  assert.ok(a.points.some((p) => p.includes('8 digits plus 1 space') && p.includes('4 more')), a.points.join('|'));
  assert.ok(a.headline.startsWith('4 more'), a.headline);
  // no separators -> unchanged wording
  const b = explain({ label: 'Aadhaar number', type: 'text', valueLength: 8, digitCount: 8 });
  assert.ok(b.points.some((p) => p.includes('You entered 8 characters') && p.includes('4 more')), b.points.join('|'));
});

test('form-level banner is explained as a sign-in problem, not a username-format rule', () => {
  const s = explain({ label: 'Username', type: 'text', formLevel: true, valueLength: 3,
    errorText: 'Incorrect UserName or Password. If you have recently changed it, use the latest one. You have 3 attempts remaining.' });
  assert.strictEqual(s.ruleId, 'form-level');
  assert.strictEqual(s.title, 'Sign-in problem');
  assert.strictEqual(s.needsAI, false);
  assert.ok(s.points.some((p) => p.includes('lock the account')), s.points.join('|'));
});

test('unknown field asks for AI only when nothing local matches', () => {
  assert.strictEqual(explain({ label: 'Widget code', type: 'text', errorText: 'Invalid' }).needsAI, true);
  assert.strictEqual(explain({ label: 'Widget code', type: 'text', pattern: '[0-9]{3}' }).needsAI, false);
});
