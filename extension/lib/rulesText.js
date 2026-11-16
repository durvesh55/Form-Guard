/**
 * rulesText.js — plain-language wording for each rule in rules.js, keyed by rule id.
 *
 *   simple   ONE short sentence a first-time user can act on (shown big in the tooltip)
 *   hi       the same in Hindi: { title, simple, tips[], example }  (any missing part falls back to English)
 *
 * The longer `explain` / `tips` in rules.js stay as the "More help" text.
 * Examples are FAKE values, never user data.
 */
(function (root) {
  'use strict';

  const RULE_TEXT = {
    mpin: {
      simple: 'A PIN is usually 4 or 6 numbers.',
      hi: { title: 'पिन (PIN)', simple: 'पिन आमतौर पर 4 या 6 अंक का होता है।', tips: ['1234 या 0000 जैसा आसान पिन मत रखिए — कई बैंक मना कर देते हैं।'], example: '4 या 6 अंक' },
    },
    pincode: {
      simple: 'PIN code has exactly 6 numbers. It does not start with 0.',
      hi: { title: 'पिन कोड', simple: 'पिन कोड में ठीक 6 अंक होते हैं। यह 0 से शुरू नहीं होता।', tips: ['बीच में खाली जगह मत छोड़िए (411 001 गलत है)।'] },
    },
    mobile: {
      simple: 'Mobile number has 10 numbers. It starts with 6, 7, 8 or 9.',
      hi: { title: 'मोबाइल नंबर', simple: 'मोबाइल नंबर में 10 अंक होते हैं। यह 6, 7, 8 या 9 से शुरू होता है।', tips: ['+91 या 0 आगे मत लगाइए, जब तक कोड के लिए अलग खाना न हो।'] },
    },
    landline: {
      simple: 'Landline number = STD code + number, about 10 or 11 numbers in all.',
      hi: { title: 'लैंडलाइन नंबर', simple: 'लैंडलाइन = एसटीडी कोड + नंबर, कुल 10 या 11 अंक।', tips: ['अगर एसटीडी कोड का अलग खाना है तो यहाँ सिर्फ़ नंबर लिखिए।'] },
    },
    email: {
      simple: 'Email looks like name@gmail.com. It must have one @.',
      hi: { title: 'ईमेल', simple: 'ईमेल ऐसा दिखता है: name@gmail.com। इसमें एक @ ज़रूर होता है।', tips: ['बीच में खाली जगह नहीं होती।', '"gmial.com" जैसी गलती या ".com" छूटना जाँचिए।'] },
    },
    'confirm-password': {
      simple: 'Type the same password again, exactly as above.',
      hi: { title: 'पासवर्ड दोबारा', simple: 'ऊपर वाला पासवर्ड ठीक वैसा ही दोबारा लिखिए।', tips: ['Caps Lock जाँचिए। बड़े और छोटे अक्षर (A / a) अलग गिने जाते हैं।'], example: '(ऊपर वाले जैसा)' },
    },
    password: {
      simple: 'Password: at least 8 characters, with a capital letter (A), a small letter (a), a number and a symbol like @.',
      hi: { title: 'पासवर्ड', simple: 'पासवर्ड कम से कम 8 अक्षर का हो — एक बड़ा अक्षर (A), एक छोटा (a), एक अंक और एक चिह्न (जैसे @)।', tips: ['कुछ साइट (जैसे IRCTC) में ज़्यादा से ज़्यादा 15 अक्षर ही चलते हैं।', 'खाली जगह (space) नहीं चलती।'], example: 'Abcd@1234 (सिर्फ़ नमूना — अपना अलग बनाइए)' },
    },
    aadhaar: {
      simple: 'Aadhaar number has exactly 12 numbers.',
      hi: { title: 'आधार नंबर', simple: 'आधार नंबर में ठीक 12 अंक होते हैं।', tips: ['ज़्यादातर साइट में 12 अंक बिना खाली जगह के लिखिए।', '16 अंक की वर्चुअल आईडी (VID) तभी डालिए जब फ़ॉर्म माँगे।'], example: '12 अंक (पहला अंक 2 से 9)' },
    },
    pan: {
      simple: 'PAN has 10 characters: 5 CAPITAL letters, 4 numbers, then 1 CAPITAL letter.',
      hi: { title: 'पैन (PAN)', simple: 'पैन में 10 अक्षर होते हैं: 5 बड़े अक्षर, फिर 4 अंक, फिर 1 बड़ा अक्षर।', tips: ['बड़े अक्षर (CAPITAL) में लिखिए।'] },
    },
    ifsc: {
      simple: 'IFSC has 11 characters: 4 capital letters, then zero (0), then 6 letters or numbers.',
      hi: { title: 'IFSC कोड', simple: 'IFSC में 11 निशान होते हैं: 4 बड़े अक्षर, फिर शून्य (0), फिर 6 अक्षर या अंक।', tips: ['पाँचवाँ निशान हमेशा शून्य (0) होता है, अंग्रेज़ी का O नहीं।', 'यह चेकबुक या पासबुक पर छपा होता है।'] },
    },
    'bank-account': {
      simple: 'Bank account number has 9 to 18 numbers, with no spaces.',
      hi: { title: 'बैंक खाता नंबर', simple: 'बैंक खाता नंबर में 9 से 18 अंक होते हैं, बीच में खाली जगह नहीं।', tips: ['पासबुक से ठीक वैसा ही उतारिए — शुरू के शून्य भी लिखिए।'], example: '9 से 18 अंक' },
    },
    date: {
      simple: 'Write a real date, usually day/month/year. It must be inside the allowed dates.',
      hi: { title: 'तारीख', simple: 'सही तारीख लिखिए, आमतौर पर दिन/महीना/साल। तारीख फ़ॉर्म की सीमा के अंदर होनी चाहिए।', tips: ['फ़ॉर्म की उम्र-सीमा जाँचिए।', 'जन्मतिथि आने वाली तारीख नहीं हो सकती।'] },
    },
    name: {
      simple: 'Write your name using letters only — no numbers or symbols.',
      hi: { title: 'नाम', simple: 'नाम सिर्फ़ अक्षरों में लिखिए — अंक या @ # . जैसे चिह्न नहीं।', tips: ['अगर बिंदु (.) नहीं चलता तो नाम के पहले अक्षर बिना बिंदु के लिखिए।', 'नाम ठीक वैसा लिखिए जैसा आधार या मार्कशीट पर है।'] },
    },
    username: {
      simple: 'User ID: letters, numbers and _ only. No spaces. Start with a letter.',
      hi: { title: 'यूज़र आईडी', simple: 'यूज़र आईडी में सिर्फ़ अक्षर, अंक और _ चलते हैं। खाली जगह नहीं, और शुरुआत अक्षर से हो।', tips: ['IRCTC में यूज़र आईडी 3 से 35 अक्षर की होती है।', 'हो सकता है यह नाम किसी ने पहले ले लिया हो — आख़िर में अंक जोड़कर देखिए।'] },
    },
    otp: {
      simple: 'Type the code you got by SMS or email (usually 6 numbers). It stops working after a few minutes.',
      hi: { title: 'ओटीपी (OTP)', simple: 'SMS या ईमेल से आया कोड लिखिए (आमतौर पर 6 अंक)। कुछ मिनट बाद यह काम करना बंद कर देता है।', tips: ['समय निकल गया हो तो "OTP दोबारा भेजें" दबाइए और सिर्फ़ नया कोड डालिए।'], example: '6 अंक' },
    },
    gstin: {
      simple: 'GSTIN has 15 characters: capital letters and numbers.',
      hi: { title: 'जीएसटीआईएन (GSTIN)', simple: 'GSTIN में 15 निशान होते हैं — बड़े अक्षर और अंक।', tips: ['बड़े अक्षर (CAPITAL) में लिखिए।'] },
    },
    upi: {
      simple: 'UPI ID looks like yourname@bank. It has exactly one @.',
      hi: { title: 'यूपीआई आईडी', simple: 'यूपीआई आईडी ऐसी दिखती है: नाम@बैंक (जैसे yourname@oksbi)। इसमें ठीक एक @ होता है।', tips: ['खाली जगह नहीं होती।'] },
    },
    passport: {
      simple: 'Passport number: 1 capital letter, then 7 numbers.',
      hi: { title: 'पासपोर्ट नंबर', simple: 'पासपोर्ट नंबर: 1 बड़ा अक्षर, फिर 7 अंक।', tips: [] },
    },
    'voter-id': {
      simple: 'Voter ID: 3 capital letters, then 7 numbers.',
      hi: { title: 'वोटर आईडी', simple: 'वोटर आईडी: 3 बड़े अक्षर, फिर 7 अंक।', tips: [] },
    },
    'driving-licence': {
      simple: 'Driving licence number: state code, RTO code, year and 7 numbers — no spaces or dashes.',
      hi: { title: 'ड्राइविंग लाइसेंस नंबर', simple: 'ड्राइविंग लाइसेंस नंबर: राज्य कोड, आरटीओ कोड, साल और 7 अंक — बिना खाली जगह या डैश के।', tips: [] },
    },
    vehicle: {
      simple: 'Vehicle number looks like MH12AB1234, usually with no spaces.',
      hi: { title: 'गाड़ी का नंबर', simple: 'गाड़ी का नंबर ऐसा होता है: MH12AB1234, आमतौर पर बिना खाली जगह के।', tips: [] },
    },
    captcha: {
      simple: 'Type exactly what the picture shows. Capital and small letters are different.',
      hi: { title: 'कैप्चा', simple: 'चित्र में जो दिख रहा है ठीक वैसा ही लिखिए। बड़े और छोटे अक्षर अलग गिने जाते हैं।', tips: ['चित्र साफ़ न दिखे तो रिफ़्रेश (दोबारा) बटन दबाइए।'], example: '(चित्र में जैसा दिखे)' },
    },
    amount: {
      simple: 'Write numbers only — no commas, spaces or ₹ sign.',
      hi: { title: 'रकम', simple: 'सिर्फ़ अंक लिखिए — कॉमा, खाली जगह या ₹ का निशान नहीं।', tips: [] },
    },
    age: {
      simple: 'Write your age in whole years, inside the allowed range.',
      hi: { title: 'उम्र', simple: 'अपनी उम्र पूरे सालों में लिखिए, फ़ॉर्म की सीमा के अंदर।', tips: [] },
    },
  };

  root.FormGuard = root.FormGuard || {};
  root.FormGuard.RULE_TEXT = RULE_TEXT;
  if (typeof module !== 'undefined' && module.exports) module.exports = { RULE_TEXT };
})(typeof globalThis !== 'undefined' ? globalThis : this);
