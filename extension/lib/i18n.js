/**
 * i18n.js — every sentence the rule engine can say, in English and Hindi.
 *
 * Writing rules (the tool is for first-time and rural users):
 *   - short sentences, everyday words, say what to DO ("Add 2 more numbers")
 *   - say "numbers" not "digits"; Hindi uses "अंक"
 *   - a value is a function when it needs numbers/words inserted
 * Add a language: copy the `en` block, translate, and add it to the language picker in popup.html.
 */
(function (root) {
  'use strict';

  const S = {
    en: {
      thisBox: 'This box',
      // length / emptiness (shown as the main "do this" line)
      requiredHead: 'required, but empty',
      requiredAction: 'This box is empty. Please fill it.',
      short: (p) => `You typed ${p.len}. Add ${p.n} more ${p.noun}.`,
      shortHead: (p) => `${p.n} more ${p.noun} needed`,
      long: (p) => `You typed ${p.len}. Remove ${p.n} ${p.noun}.`,
      longHead: (p) => `${p.n} ${p.noun} too many`,
      lenOk: 'The count is right. Check each letter and number carefully.',
      sep: 'Remove spaces and dashes — type only numbers.',
      // nouns by expected kind; n lets English pick singular / plural
      nounDigits: (n) => (n === 1 ? 'number' : 'numbers'),
      nounLetters: (n) => (n === 1 ? 'letter' : 'letters'),
      nounAlnum: (n) => (n === 1 ? 'letter or number' : 'letters or numbers'),
      nounChars: (n) => (n === 1 ? 'character' : 'characters'),
      // browser validation flags
      email: 'Write the email like name@gmail.com — it needs one @ and no spaces.',
      url: 'Write the full web address, starting with https://',
      underDate: (p) => `The date must be ${p.v} or later.`,
      underNum: (p) => `The number must be at least ${p.v}.`,
      overDate: (p) => `The date must be ${p.v} or earlier.`,
      overNum: (p) => `The number must be at most ${p.v}.`,
      step: 'Write a whole number — no decimal point.',
      badInput: 'This box cannot read what you typed. In a number box, type numbers only.',
      emailHead: 'not a valid email address',
      urlHead: 'not a valid web address',
      underHead: (p) => `must be ${p.date ? 'on or after' : 'at least'} ${p.v}`,
      overHead: (p) => `must be ${p.date ? 'on or before' : 'at most'} ${p.v}`,
      // when no rule matches
      formatWrong: 'The format of this box is not right. Look at the sample or hint written near the box.',
      noInfo: 'This box has a mistake, but the website did not say what.',
      noInfoPoint: 'Look at the hint or sample text near the box for the right format.',
      patternNeeds: (p) => `This box needs: ${p.text}.`,
      patternDetail: (p) => `Format required: ${p.text}.`,
      vague: (p) => `The site only said "${p.text}". Here is what it most likely means:`,
      // generic by input type
      gEmail: 'Enter an email like name@example.com.',
      gUrl: 'Enter a full web address, e.g. https://example.com',
      gNumber: (p) => `Enter numbers only${p.range ? ` between ${p.min} and ${p.max}` : ''}.`,
      gTel: 'Enter a phone number using numbers only.',
      gDate: 'Choose a real date inside the allowed range.',
      gCheckbox: 'You must tick this box to continue.',
      gSelect: 'Please choose one option from the list.',
      gFile: 'Please choose a file to upload.',
      gRadio: 'Please select one of the options.',
      gLength: 'The length of what you typed is not accepted.',
      // form-level banner (e.g. wrong password message above the form)
      fsTitleSignIn: 'Sign-in problem',
      fsTitleForm: 'Problem with this form',
      fsSays: (p) => `The site says: "${p.text}"`,
      fsMain: 'The site did not accept your username or password.',
      fsHeadSignIn: 'username or password rejected — hover for help',
      fsHeadForm: 'the site rejected this form — hover for help',
      fsRejected: 'The site checked what you typed and rejected the sign-in — the format may be fine, but the username or password is not the one on record.',
      fsCaps: 'Check Caps Lock, and that you are using your username (not email or mobile) unless the site says so.',
      fsRetype: 'Re-type the password slowly — use the eye icon to show it and make sure it is what you meant.',
      fsAttempts: 'Careful: too many wrong attempts can lock the account. Stop and use "Forgot password / account details" instead of guessing.',
      fsCaptcha: 'The captcha was wrong or expired — reload it and type the new characters exactly.',
      fsOtp: 'The OTP is wrong or expired — request a fresh one and use it within its time limit.',
      fsExpired: 'Your session may have timed out — refresh the page and try again.',
      fsLocked: 'The account looks locked — wait for the lock time or use the site\'s reset option.',
      fsNone: 'This message is about the whole form, not one box. Read it and check the boxes below it.',
      // tooltip buttons
      uiMore: 'More help', uiLess: 'Hide help', uiExample: 'Example', uiDismiss: 'Close',
      uiOnDevice: 'Checked on your device — nothing was sent anywhere.',
    },

    hi: {
      thisBox: 'यह खाना',
      requiredHead: 'खाली है, भरना ज़रूरी है',
      requiredAction: 'यह खाना खाली है। कृपया भरिए।',
      short: (p) => `आपने ${p.len} ${p.noun} डाले हैं। ${p.n} ${p.noun} और डालिए।`,
      shortHead: (p) => `${p.n} ${p.noun} और चाहिए`,
      long: (p) => `आपने ${p.len} ${p.noun} डाले हैं। ${p.n} ${p.noun} कम कीजिए।`,
      longHead: (p) => `${p.n} ${p.noun} ज़्यादा हैं`,
      lenOk: 'गिनती सही है। हर अक्षर और अंक ध्यान से जाँचिए।',
      sep: 'खाली जगह (space) और डैश (-) हटाइए — सिर्फ़ अंक लिखिए।',
      nounDigits: () => 'अंक',
      nounLetters: () => 'अक्षर',
      nounAlnum: () => 'अक्षर या अंक',
      nounChars: () => 'अक्षर',
      email: 'ईमेल ऐसे लिखिए: name@gmail.com — इसमें एक @ होता है और खाली जगह नहीं।',
      url: 'पूरा वेब पता लिखिए, https:// से शुरू करके।',
      underDate: (p) => `तारीख ${p.v} या उसके बाद की होनी चाहिए।`,
      underNum: (p) => `संख्या कम से कम ${p.v} होनी चाहिए।`,
      overDate: (p) => `तारीख ${p.v} या उससे पहले की होनी चाहिए।`,
      overNum: (p) => `संख्या ज़्यादा से ज़्यादा ${p.v} होनी चाहिए।`,
      step: 'पूरी संख्या लिखिए — दशमलव (.) नहीं।',
      badInput: 'यह खाना आपका लिखा समझ नहीं पा रहा। अंक वाले खाने में सिर्फ़ अंक लिखिए।',
      emailHead: 'ईमेल सही नहीं है',
      urlHead: 'वेब पता सही नहीं है',
      underHead: (p) => `${p.v} ${p.date ? 'या उसके बाद' : 'या उससे ज़्यादा'} होना चाहिए`,
      overHead: (p) => `${p.v} ${p.date ? 'या उससे पहले' : 'या उससे कम'} होना चाहिए`,
      formatWrong: 'इस खाने का रूप (format) सही नहीं है। खाने के पास लिखा नमूना या सुझाव देखिए।',
      noInfo: 'इस खाने में गलती है, पर वेबसाइट ने कारण नहीं बताया।',
      noInfoPoint: 'सही रूप जानने के लिए खाने के पास लिखा सुझाव या नमूना देखिए।',
      patternNeeds: () => 'इस खाने का रूप (format) सही नहीं है। खाने के पास लिखा नमूना या सुझाव देखिए।',
      patternDetail: () => '',
      vague: (p) => `साइट ने सिर्फ़ "${p.text}" लिखा है। इसका मतलब शायद यह है:`,
      gEmail: 'ईमेल ऐसा लिखिए: name@example.com',
      gUrl: 'पूरा वेब पता लिखिए, जैसे https://example.com',
      gNumber: (p) => `सिर्फ़ अंक लिखिए${p.range ? ` (${p.min} से ${p.max} के बीच)` : ''}।`,
      gTel: 'फ़ोन नंबर सिर्फ़ अंकों में लिखिए।',
      gDate: 'सही तारीख चुनिए, जो ज़रूरी सीमा के अंदर हो।',
      gCheckbox: 'आगे बढ़ने के लिए इस डिब्बे पर टिक लगाइए।',
      gSelect: 'सूची में से एक विकल्प चुनिए।',
      gFile: 'अपलोड करने के लिए फ़ाइल चुनिए।',
      gRadio: 'दिए गए विकल्पों में से एक चुनिए।',
      gLength: 'आपने जितना लिखा है, उतनी लंबाई मंज़ूर नहीं है।',
      fsTitleSignIn: 'लॉगिन में समस्या',
      fsTitleForm: 'फ़ॉर्म में समस्या',
      fsSays: (p) => `साइट ने लिखा है: "${p.text}"`,
      fsMain: 'साइट ने आपका यूज़रनेम या पासवर्ड नहीं माना।',
      fsHeadSignIn: 'यूज़रनेम या पासवर्ड गलत है — मदद के लिए यहाँ रुकिए',
      fsHeadForm: 'साइट ने फ़ॉर्म नहीं माना — मदद के लिए यहाँ रुकिए',
      fsRejected: 'साइट ने आपका लिखा जाँचा और लॉगिन मना कर दिया। हो सकता है लिखने का तरीका सही हो, पर यूज़रनेम या पासवर्ड रिकॉर्ड से मेल नहीं खाता।',
      fsCaps: 'Caps Lock जाँचिए। जब तक साइट न कहे, ईमेल या मोबाइल नहीं, अपना यूज़रनेम ही डालिए।',
      fsRetype: 'पासवर्ड धीरे-धीरे दोबारा लिखिए — आँख वाले निशान से पासवर्ड देखकर जाँच लीजिए।',
      fsAttempts: 'सावधान: बार-बार गलत डालने से खाता बंद (लॉक) हो सकता है। अंदाज़ा मत लगाइए — "पासवर्ड भूल गए / अकाउंट डिटेल्स" का इस्तेमाल कीजिए।',
      fsCaptcha: 'कैप्चा गलत या पुराना है — उसे रिफ़्रेश कीजिए और नए अक्षर ठीक वैसे ही लिखिए।',
      fsOtp: 'ओटीपी गलत है या उसका समय निकल गया — नया ओटीपी मँगाइए और समय के अंदर डालिए।',
      fsExpired: 'आपका सेशन खत्म हो गया होगा — पेज रिफ़्रेश करके दोबारा कोशिश कीजिए।',
      fsLocked: 'खाता बंद (लॉक) लग रहा है — कुछ देर रुकिए या साइट का रीसेट विकल्प इस्तेमाल कीजिए।',
      fsNone: 'यह संदेश पूरे फ़ॉर्म के बारे में है, किसी एक खाने के बारे में नहीं। इसे पढ़िए और नीचे के खाने जाँचिए।',
      uiMore: 'और मदद', uiLess: 'मदद छुपाइए', uiExample: 'उदाहरण', uiDismiss: 'बंद करें',
      uiOnDevice: 'आपके अपने डिवाइस पर ही जाँचा गया — कुछ भी कहीं भेजा नहीं गया।',
    },
  };

  const LANGS = Object.keys(S);

  /** t('hi', 'short', {len: 4, n: 2, noun: 'अंक'}) — falls back to English, then to the key itself. */
  function t(lang, key, params) {
    const dict = S[lang] || S.en;
    let v = dict[key] !== undefined ? dict[key] : S.en[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(params || {}) : v;
  }

  /** Noun for an expected value kind ('digits' | 'letters' | 'alnum' | 'chars'), singular/plural aware. */
  function noun(lang, kind, n) {
    const key = { digits: 'nounDigits', letters: 'nounLetters', alnum: 'nounAlnum' }[kind] || 'nounChars';
    return t(lang, key, n);
  }

  /** The tooltip's own button labels, in one object. */
  function ui(lang) {
    return {
      more: t(lang, 'uiMore'), less: t(lang, 'uiLess'), example: t(lang, 'uiExample'),
      dismiss: t(lang, 'uiDismiss'), onDevice: t(lang, 'uiOnDevice'),
    };
  }

  const api = { t, noun, ui, LANGS };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.I18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
