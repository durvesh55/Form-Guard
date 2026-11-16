/**
 * popupText.js — every word shown in the popup and the welcome page, English + Hindi.
 * Shared by popup.html and welcome.html. Keep sentences short and in everyday words.
 * A value is a function when it needs numbers / names inserted.
 */
(function (root) {
  'use strict';

  const S = {
    en: {
      // status card
      stChecking: 'Checking this page…',
      stNA: "FormGuard can't work on this page",
      stNASub: 'Chrome keeps its own pages private. Open a website to get help.',
      stBlocked: "Can't open this page",
      stBlockedFile: 'For local files: chrome://extensions → FormGuard → Details → turn on "Allow access to file URLs".',
      stBlockedOther: 'Chrome did not allow FormGuard on this page.',
      stPaused: 'Paused',
      stPausedSub: 'Turn off "Pause FormGuard" in More settings to get help again.',
      stNoForms: 'No form on this page',
      stNoFormsSub: "Open a page with a form — I'll help by myself.",
      stOk: 'No problems found',
      stOkSub: "Fill in the form. I'll help if something goes wrong.",
      stProblems: (p) => `${p.n} ${p.n === 1 ? 'problem' : 'problems'} found`,
      stProblemsSub: 'Look for the yellow notes under the marked boxes.',
      // turn-on card
      turnOn: 'Turn on help for all websites',
      turnOnNote: 'Chrome will ask once. After that FormGuard helps by itself on every website — no clicking.',
      turnedOn: '✓ Help is on for all websites',
      // privacy
      privOk: '✓ Nothing you type ever leaves your device.',
      privAI: (p) => `⚠ AI help is ON: field names and error text (never what you type) may be sent to ${p.host}.`,
      recheck: 'Check this page again',
      // more settings
      adv: 'More settings',
      pause: 'Pause FormGuard',
      autoClear: 'Clear old activity when I go to a new website',
      autoClearNote: 'Network entries are always kept.',
      ai: 'AI help for unknown errors',
      aiNote: 'Off = nothing is ever sent.',
      aiBox: 'Only the field name, type, the site\'s error text and how many characters were typed are sent — never what you typed.',
      server: 'Server address',
      logTitle: 'What FormGuard did',
      stats: (p) => `Checked ${p.reads} ${p.reads === 1 ? 'field' : 'fields'} · sent ${p.sent} ${p.sent === 1 ? 'time' : 'times'} to a server (${p.bytes} bytes)`,
      logEmpty: 'Nothing yet.',
      logRead: (p) => `Checked "${p.field}" — nothing was sent`,
      logSent: (p) => `Sent ${p.bytes} bytes of field info (not what you typed) to ${p.host}`,
      logBlocked: 'AI help was off, so nothing was sent.',
      liveHint: 'Show a counter while I type (e.g. 6 of 10 numbers)',
      textSize: 'Text size', sizeNormal: 'Normal', sizeLarge: 'Large', sizeXLarge: 'Extra large',
      contrast: 'High contrast (clearer colours)',
      unknown: (p) => `${p.n} ${p.n === 1 ? 'box' : 'boxes'} FormGuard did not understand`,
      unknownNote: 'Kept only on this device. Save the file and share it to help improve the rules.',
      unknownSave: 'Save unknown boxes file',
      privacyReport: 'Open privacy report',
      exportLog: 'Save log file',
      clearLog: 'Clear log',
      // welcome page
      wTitle: 'Welcome to FormGuard',
      wLead: 'I explain form mistakes in simple words — in English or हिन्दी. I never read or send what you type.',
      wStep1: '1. Choose your language',
      wStep2: '2. Turn on help',
      wDone: 'All set! Open any website with a form.',
      wSkip: 'You can turn it on later from the FormGuard icon.',
    },
    hi: {
      stChecking: 'यह पेज जाँचा जा रहा है…',
      stNA: 'इस पेज पर FormGuard काम नहीं कर सकता',
      stNASub: 'Chrome अपने खास पेज बंद रखता है। मदद के लिए कोई वेबसाइट खोलिए।',
      stBlocked: 'यह पेज नहीं खुल सका',
      stBlockedFile: 'अपनी फ़ाइलों के लिए: chrome://extensions → FormGuard → Details → "Allow access to file URLs" चालू कीजिए।',
      stBlockedOther: 'Chrome ने इस पेज पर FormGuard को चलने नहीं दिया।',
      stPaused: 'रुका हुआ है',
      stPausedSub: 'फिर से मदद पाने के लिए "और सेटिंग" में "FormGuard को रोकिए" बंद कीजिए।',
      stNoForms: 'इस पेज पर कोई फ़ॉर्म नहीं है',
      stNoFormsSub: 'फ़ॉर्म वाला पेज खोलिए — मैं अपने आप मदद करूँगा।',
      stOk: 'कोई गलती नहीं मिली',
      stOkSub: 'फ़ॉर्म भरिए। कुछ गलत हुआ तो मैं बताऊँगा।',
      stProblems: (p) => `${p.n} गलती मिली`,
      stProblemsSub: 'निशान वाले खानों के नीचे पीले सुझाव देखिए।',
      turnOn: 'सभी वेबसाइट पर मदद चालू कीजिए',
      turnOnNote: 'Chrome एक बार पूछेगा। उसके बाद FormGuard हर वेबसाइट पर अपने आप मदद करेगा — क्लिक की ज़रूरत नहीं।',
      turnedOn: '✓ सभी वेबसाइट पर मदद चालू है',
      privOk: '✓ आप जो लिखते हैं वह आपके डिवाइस से बाहर कभी नहीं जाता।',
      privAI: (p) => `⚠ AI मदद चालू है: खाने का नाम और गलती का संदेश (आपका लिखा कभी नहीं) ${p.host} को भेजा जा सकता है।`,
      recheck: 'यह पेज फिर से जाँचिए',
      adv: 'और सेटिंग',
      pause: 'FormGuard को रोकिए',
      autoClear: 'नई वेबसाइट पर जाते ही पुरानी जानकारी हटाइए',
      autoClearNote: 'नेटवर्क की जानकारी हमेशा रखी जाती है।',
      ai: 'अनजान गलतियों के लिए AI मदद',
      aiNote: 'बंद = कुछ भी कभी नहीं भेजा जाता।',
      aiBox: 'सिर्फ़ खाने का नाम, प्रकार, साइट का गलती-संदेश और कितने अक्षर लिखे गए — यह भेजा जाता है। आपका लिखा हुआ कभी नहीं।',
      server: 'सर्वर का पता',
      logTitle: 'FormGuard ने क्या किया',
      stats: (p) => `${p.reads} खाने जाँचे · ${p.sent} बार सर्वर को भेजा (${p.bytes} बाइट)`,
      logEmpty: 'अभी कुछ नहीं।',
      logRead: (p) => `"${p.field}" जाँचा — कुछ भी भेजा नहीं गया`,
      logSent: (p) => `खाने की जानकारी (आपका लिखा नहीं) के ${p.bytes} बाइट ${p.host} को भेजे गए`,
      logBlocked: 'AI मदद बंद थी, इसलिए कुछ नहीं भेजा गया।',
      liveHint: 'लिखते समय गिनती दिखाइए (जैसे 10 में से 6 अंक)',
      textSize: 'अक्षरों का आकार', sizeNormal: 'सामान्य', sizeLarge: 'बड़ा', sizeXLarge: 'बहुत बड़ा',
      contrast: 'ज़्यादा साफ़ रंग (हाई कॉन्ट्रास्ट)',
      unknown: (p) => `${p.n} खाने FormGuard नहीं समझ सका`,
      unknownNote: 'यह सिर्फ़ आपके डिवाइस पर रहता है। नियम सुधारने में मदद के लिए फ़ाइल सेव करके भेजिए।',
      unknownSave: 'अनजान खानों की फ़ाइल सेव करें',
      privacyReport: 'प्राइवेसी रिपोर्ट खोलिए',
      exportLog: 'लॉग फ़ाइल सेव करें',
      clearLog: 'लॉग साफ़ करें',
      wTitle: 'FormGuard में आपका स्वागत है',
      wLead: 'मैं फ़ॉर्म की गलतियाँ आसान शब्दों में समझाता हूँ — हिन्दी या English में। आप जो लिखते हैं उसे मैं न पढ़ता हूँ, न भेजता हूँ।',
      wStep1: '1. अपनी भाषा चुनिए',
      wStep2: '2. मदद चालू कीजिए',
      wDone: 'सब तैयार! फ़ॉर्म वाली कोई भी वेबसाइट खोलिए।',
      wSkip: 'आप इसे बाद में FormGuard के आइकन से भी चालू कर सकते हैं।',
    },
  };

  function t(lang, key, params) {
    const dict = S[lang] || S.en;
    const v = dict[key] !== undefined ? dict[key] : S.en[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(params || {}) : v;
  }

  root.FG_UI = { t, S };
})(globalThis);
