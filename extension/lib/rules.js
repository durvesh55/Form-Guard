/**
 * rules.js — the JSON rule table for common Indian form fields.
 *
 * Each rule is plain JSON data (no functions), so it can be moved to a .json
 * file, edited by non-programmers, or loaded from storage later.
 *
 * Fields of a rule:
 *   id          unique id (shown in the tooltip footer and audit log)
 *   title       short heading shown in the tooltip
 *   keywords    words searched in the label / name / id / placeholder
 *               (multi-word keywords score higher, so "login pin" beats "pin")
 *   notKeywords if any of these appear in the label, the rule is skipped
 *   types       input types that strongly suggest this rule
 *   autocomplete  autocomplete attribute values that suggest this rule
 *   expect      { kind: digits|letters|alnum|chars, min, max } expected value shape
 *   explain     plain-language explanation
 *   example     a FAKE example value (never user data)
 *   tips        extra hints
 */
(function (root) {
  'use strict';

  const RULES = [
    {
      id: 'mpin', title: 'PIN / MPIN',
      keywords: ['mpin', 'atm pin', 'login pin', 'upi pin', 'transaction pin', 'tpin'],
      expect: { kind: 'digits', min: 4, max: 6 },
      explain: 'A security PIN is usually 4 or 6 digits only.',
      example: '4 or 6 digits', tips: ['Avoid simple PINs like 1234 or 0000 — many banks reject them.'],
    },
    {
      id: 'pincode', title: 'PIN code',
      keywords: ['pin code', 'pincode', 'postal code', 'postcode', 'zip code', 'zip', 'pin'],
      autocomplete: ['postal-code'],
      expect: { kind: 'digits', min: 6, max: 6 },
      explain: 'An Indian PIN code is exactly 6 digits and never starts with 0.',
      example: '411001', tips: ['Do not put spaces in the middle (411 001 is wrong).'],
    },
    {
      id: 'mobile', title: 'Mobile number',
      keywords: ['mobile', 'mobile number', 'phone', 'phone number', 'contact number', 'cell', 'whatsapp', 'mobile no'],
      notKeywords: ['landline', 'std'],
      types: ['tel'], autocomplete: ['tel', 'tel-national'],
      expect: { kind: 'digits', min: 10, max: 10 },
      explain: 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.',
      example: '98XXXXXXXX', tips: ['Do not add +91 or 0 in front unless the form shows a separate country-code box.'],
    },
    {
      id: 'landline', title: 'Landline number',
      keywords: ['landline', 'std code', 'telephone', 'tel no'],
      expect: { kind: 'digits', min: 10, max: 11 },
      explain: 'A landline number is STD code + phone number, usually 10–11 digits in total.',
      example: '020XXXXXXXX', tips: ['Some forms have a separate STD-code box — then type only the number here.'],
    },
    {
      id: 'email', title: 'Email address',
      keywords: ['email', 'e-mail', 'email id', 'mail id'],
      types: ['email'], autocomplete: ['email'],
      expect: { kind: 'chars', min: 6, max: 254 },
      explain: 'An email looks like name@example.com — it needs one "@", a name before it and a domain (like gmail.com) after it.',
      example: 'name@example.com', tips: ['No spaces allowed.', 'Check for typos like "gmial.com" or a missing ".com".'],
    },
    {
      id: 'confirm-password', title: 'Confirm password',
      keywords: ['confirm password', 're-enter password', 'retype password', 'repeat password', 'reenter password', 'confirm pass'],
      expect: { kind: 'chars', min: 1, max: 64 },
      explain: 'This must be exactly the same as the password you typed above (it is case-sensitive).',
      example: '(same as password)', tips: ['Check Caps Lock.'],
    },
    {
      id: 'password', title: 'Password',
      keywords: ['password', 'passcode', 'new password'],
      notKeywords: ['confirm', 're-enter', 'retype', 'repeat', 'one time'],
      types: ['password'], autocomplete: ['new-password', 'current-password'],
      expect: { kind: 'chars', min: 8, max: 64 },
      explain: 'Most portals need at least 8 characters with at least one capital letter, one small letter, one digit and one special character (like @ # $).',
      example: 'Abcd@1234 (style only — make your own)',
      tips: ['Some portals (e.g. IRCTC) also set a maximum, often 15 characters.', 'Spaces are usually not allowed.'],
    },
    {
      id: 'aadhaar', title: 'Aadhaar number',
      keywords: ['aadhaar', 'aadhar', 'adhaar', 'uid', 'uidai', 'aadhaar number'],
      expect: { kind: 'digits', min: 12, max: 12 },
      explain: 'An Aadhaar number is exactly 12 digits and does not start with 0 or 1.',
      example: '12 digits, e.g. 2XXX XXXX XXXX', tips: ['Most sites want the 12 digits without spaces; a few accept 4-4-4 groups.', 'Do not enter the 16-digit Virtual ID here unless the form asks for VID.'],
    },
    {
      id: 'pan', title: 'PAN',
      keywords: ['pan', 'pan number', 'pan card', 'pan no', 'permanent account number'],
      expect: { kind: 'alnum', min: 10, max: 10 },
      explain: 'A PAN is 10 characters: 5 capital letters, then 4 digits, then 1 capital letter.',
      example: 'ABCDE1234F', tips: ['Use CAPITAL letters.', 'The 4th letter is "P" for individuals.'],
    },
    {
      id: 'ifsc', title: 'IFSC code',
      keywords: ['ifsc', 'ifsc code', 'ifs code'],
      expect: { kind: 'alnum', min: 11, max: 11 },
      explain: 'An IFSC code is 11 characters: 4 capital letters (bank), then the digit 0, then 6 letters or digits (branch).',
      example: 'SBIN0001234', tips: ['The 5th character is always zero (0), not the letter O.', 'It is printed on your cheque book / passbook.'],
    },
    {
      id: 'bank-account', title: 'Bank account number',
      keywords: ['account number', 'bank account', 'account no', 'a/c no', 'acc no', 'acct no'],
      expect: { kind: 'digits', min: 9, max: 18 },
      explain: 'Bank account numbers in India are usually 9 to 18 digits, with no spaces or dashes.',
      example: '9–18 digits', tips: ['Copy it exactly from your passbook — leading zeros matter.'],
    },
    {
      id: 'date', title: 'Date',
      keywords: ['date of birth', 'dob', 'birth date', 'date'],
      types: ['date', 'datetime-local'], autocomplete: ['bday'],
      expect: { kind: 'chars', min: 8, max: 10 },
      explain: 'Use the date format the form shows (in India usually DD/MM/YYYY). The date must be a real date and inside the allowed range.',
      example: '15/08/2000', tips: ['Check you meet the age limit of the form.', 'Dates in the future are usually rejected for date of birth.'],
    },
    {
      id: 'name', title: 'Name',
      keywords: ['full name', 'name', 'first name', 'last name', 'middle name', 'surname', 'applicant name', "father's name", "mother's name", 'father name', 'mother name', 'candidate name'],
      notKeywords: ['user name', 'username', 'bank name', 'branch name', 'file name', 'company name', 'login name'],
      autocomplete: ['name', 'given-name', 'family-name'],
      expect: { kind: 'letters', min: 1, max: 100 },
      explain: 'Names usually allow only letters and spaces — no digits or symbols like @ # . or ,',
      example: 'Rahul Kumar Sharma', tips: ['Write initials without dots if dots are rejected.', 'Spell it exactly as on your ID document (Aadhaar / marksheet).'],
    },
    {
      id: 'username', title: 'User ID',
      keywords: ['username', 'user name', 'user id', 'userid', 'login id'],
      autocomplete: ['username'],
      expect: { kind: 'alnum', min: 3, max: 35 },
      explain: 'User IDs usually allow letters, digits and underscore only, with no spaces, and must start with a letter.',
      example: 'rahul_k2001', tips: ['IRCTC user IDs must be 3–35 characters.', 'The ID may already be taken — try adding digits.'],
    },
    {
      id: 'otp', title: 'OTP',
      keywords: ['otp', 'one time password', 'verification code', 'one-time password'],
      autocomplete: ['one-time-code'],
      expect: { kind: 'digits', min: 4, max: 8 },
      explain: 'Enter the code sent to you by SMS or email (usually 6 digits). OTPs expire after a few minutes.',
      example: '6 digits', tips: ['If it expired, press "Resend OTP" and use only the newest code.'],
    },
    {
      id: 'gstin', title: 'GSTIN',
      keywords: ['gstin', 'gst number', 'gst no', 'gst'],
      expect: { kind: 'alnum', min: 15, max: 15 },
      explain: 'A GSTIN is 15 characters: 2-digit state code + your 10-character PAN + 1 entity digit + the letter Z + 1 check character.',
      example: '27ABCDE1234F1Z5', tips: ['Use capital letters.'],
    },
    {
      id: 'upi', title: 'UPI ID',
      keywords: ['upi id', 'vpa', 'upi address', 'upi'],
      notKeywords: ['upi pin'],
      expect: { kind: 'chars', min: 5, max: 50 },
      explain: 'A UPI ID looks like name@bank — for example yourname@oksbi. It needs exactly one "@".',
      example: 'yourname@okhdfcbank', tips: ['No spaces allowed.'],
    },
    {
      id: 'passport', title: 'Passport number',
      keywords: ['passport number', 'passport no', 'passport'],
      expect: { kind: 'alnum', min: 8, max: 8 },
      explain: 'An Indian passport number is 8 characters: 1 capital letter followed by 7 digits.',
      example: 'A1234567', tips: [],
    },
    {
      id: 'voter-id', title: 'Voter ID (EPIC)',
      keywords: ['voter id', 'epic', 'epic number', 'voter card'],
      expect: { kind: 'alnum', min: 10, max: 10 },
      explain: 'A Voter ID (EPIC) number is 10 characters: 3 capital letters followed by 7 digits.',
      example: 'ABC1234567', tips: [],
    },
    {
      id: 'driving-licence', title: 'Driving licence number',
      keywords: ['driving licence', 'driving license', 'dl number', 'dl no', 'licence number', 'license number'],
      expect: { kind: 'alnum', min: 15, max: 16 },
      explain: 'A driving licence number is the 2-letter state code, 2-digit RTO code, 4-digit year and 7 digits — usually typed without spaces or dashes.',
      example: 'MH1420110062821', tips: [],
    },
    {
      id: 'vehicle', title: 'Vehicle registration number',
      keywords: ['vehicle number', 'vehicle no', 'registration number', 'vehicle registration'],
      expect: { kind: 'alnum', min: 8, max: 10 },
      explain: 'Vehicle numbers look like MH12AB1234 — state code, district number, series letters and 4 digits, usually without spaces.',
      example: 'MH12AB1234', tips: [],
    },
    {
      id: 'captcha', title: 'Captcha',
      keywords: ['captcha', 'security code', 'enter the characters', 'enter the text', 'verification text'],
      expect: { kind: 'chars', min: 4, max: 8 },
      explain: 'Type exactly the characters shown in the image. Captchas are often case-sensitive and change after every failed attempt.',
      example: '(as shown in the image)', tips: ['Click refresh if the image is unreadable.'],
    },
    {
      id: 'amount', title: 'Amount',
      keywords: ['amount', 'income', 'annual income', 'salary', 'fee', 'fees'],
      expect: { kind: 'digits', min: 1, max: 12 },
      explain: 'Amounts usually need digits only — no commas, spaces or the ₹ symbol.',
      example: '250000', tips: [],
    },
    {
      id: 'age', title: 'Age',
      keywords: ['age'],
      expect: { kind: 'digits', min: 1, max: 3 },
      explain: 'Age should be a whole number of years, inside the range allowed by the form.',
      example: '21', tips: [],
    },
  ];

  root.FormGuard = root.FormGuard || {};
  root.FormGuard.RULES = RULES;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RULES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
