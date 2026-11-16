/**
 * ruleEngine.js — turns SAFE field context into a plain-language suggestion.
 *
 * Input  (context object, built by the content script — contains NO typed value):
 *   { label, nameAttr, placeholder, type, pattern, minLength, maxLength,
 *     minAttr, maxAttr, required, autocomplete, errorText, valueLength, digitCount,
 *     validity, lang ('en' | 'hi'), formLevel }
 *
 * Output (suggestion object):
 *   title, headline        -> the one-line chip
 *   lines[]                -> the BIG part of the card: { kind: 'main' | 'action', text }
 *                             main = what the field needs, action = what to do now
 *   summary, points[]      -> the collapsed "More help" part
 *   example, source, ruleId, confidence, needsAI, ui (button labels), lang
 *
 * Steps:  1. find the best matching rule (keyword scoring)
 *         2. count the typed length against the expected length (digits only for digit fields)
 *         3. add native validity hints (required, range, type)
 *         4. write everything in the chosen language (lib/i18n.js, lib/rulesText.js)
 */
(function (root) {
  'use strict';

  const FG = root.FormGuard || {};
  const RULES = FG.RULES || (typeof require === 'function' ? require('./rules.js').RULES : []);
  const regexToEnglish = FG.regexToEnglish || (typeof require === 'function' ? require('./regexToEnglish.js').regexToEnglish : null);
  const RULE_TEXT = FG.RULE_TEXT || (typeof require === 'function' ? require('./rulesText.js').RULE_TEXT : {});
  const I18N = FG.I18n || (typeof require === 'function' ? require('./i18n.js') : null);

  /** "txtPinCode" / "pin_code" / "PIN-Code" -> "txt pin code" */
  function normalise(s) {
    return String(s || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_\-.[\]:*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function hasWord(haystack, keyword) {
    if (!haystack) return false;
    const esc = keyword.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).test(haystack);
  }

  /**
   * Score every rule and return the best one (or null).
   * labelOnly: only rules whose keyword appears in the VISIBLE label can win.
   */
  function pickRule(ctx, labelOnly) {
    const label = normalise(ctx.label);
    const name = normalise(ctx.nameAttr);
    const placeholder = normalise(ctx.placeholder);
    const error = normalise(ctx.errorText);
    let best = null, bestScore = 0;

    for (const rule of RULES) {
      if ((rule.notKeywords || []).some((k) => hasWord(label, k) || hasWord(name, k))) continue;
      let score = 0;
      for (const kw of rule.keywords) {
        const w = kw.split(' ').length; // multi-word keywords are more specific
        let s = 0;
        if (hasWord(label, kw)) s = Math.max(s, 3 * w);
        if (!labelOnly) {
          if (hasWord(name, kw)) s = Math.max(s, 2 * w);
          if (hasWord(placeholder, kw)) s = Math.max(s, 1 * w);
          if (hasWord(error, kw)) s = Math.max(s, 1 * w);
        }
        score = Math.max(score, s);
      }
      if (labelOnly && score === 0) continue;
      if ((rule.types || []).includes(ctx.type)) score += 3;
      if ((rule.autocomplete || []).includes(String(ctx.autocomplete || '').toLowerCase())) score += 4;
      if (score > bestScore) { best = rule; bestScore = score; }
    }
    return bestScore >= 3 ? { rule: best, score: bestScore } : null;
  }

  /**
   * What the user READS beats what the developer named the field: a box labelled "Email Address"
   * is an email box even if its hidden name/id is "username". Only when the label says nothing useful
   * do we fall back to name / id / placeholder / the site's error text.
   */
  function findRule(ctx) {
    return pickRule(ctx, true) || pickRule(ctx, false);
  }

  const VAGUE = /^(invalid|error|wrong|incorrect|not valid|please check|invalid input|invalid value|invalid format|field is invalid)\b/i;
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const dedupe = (arr) => [...new Set(arr.filter(Boolean))];
  const line = (kind, text) => ({ kind, text });

  /** Wording for one rule in the chosen language; missing Hindi parts fall back to English. */
  function ruleText(rule, lang) {
    const x = RULE_TEXT[rule.id] || {};
    const h = lang === 'hi' ? x.hi : null;
    return {
      title: (h && h.title) || rule.title,
      simple: (h && h.simple) || x.simple || rule.explain,
      explain: h ? '' : rule.explain,              // Hindi: the simple line already says it
      tips: h ? (h.tips || []) : (rule.tips || []),
      example: (h && h.example) || rule.example,
    };
  }

  /** "You typed 4. Add 2 more numbers."  (counts the typed length against min..max) */
  function lengthSimple(lang, len, min, max, kind) {
    if (min == null && max == null) return null;
    min = min ?? 0; max = max ?? Infinity;
    if (len < min) {
      const n = min - len, noun = I18N.noun(lang, kind, n);
      return { ok: false, text: I18N.t(lang, 'short', { len, n, noun }), head: I18N.t(lang, 'shortHead', { n, noun }) };
    }
    if (len > max) {
      const n = len - max, noun = I18N.noun(lang, kind, n);
      return { ok: false, text: I18N.t(lang, 'long', { len, n, noun }), head: I18N.t(lang, 'longHead', { n, noun }) };
    }
    // Right count: only worth saying for exact-length fields (PIN, Aadhaar…), where it means "a wrong character"
    return { ok: true, text: min === max && min > 0 ? I18N.t(lang, 'lenOk') : '' };
  }

  function genericSummary(ctx, lang) {
    const T = (k, p) => I18N.t(lang, k, p);
    const t = ctx.type;
    if (t === 'email') return T('gEmail');
    if (t === 'url') return T('gUrl');
    if (t === 'number') return T('gNumber', { range: !!(ctx.minAttr || ctx.maxAttr), min: ctx.minAttr ?? '…', max: ctx.maxAttr ?? '…' });
    if (t === 'tel') return T('gTel');
    if (t === 'date') return T('gDate');
    if (t === 'checkbox') return T('gCheckbox');
    if (t === 'select') return T('gSelect');
    if (t === 'file') return T('gFile');
    if (t === 'radio') return T('gRadio');
    if (ctx.minLength != null || ctx.maxLength != null) return T('gLength');
    return '';
  }

  /** A banner for the whole form (not one field): explain from the site's own words, on-device. */
  function explainFormError(ctx, lang) {
    const T = (k, p) => I18N.t(lang, k, p);
    const e = String(ctx.errorText || '');
    const signIn = /(user ?name|user ?id|password|login|log in|sign ?in|credential)/i.test(e);
    const rejected = /(incorrect|invalid|wrong|not match|mismatch)/i.test(e) && signIn;

    // what to do, most important first; only the first one is shown big, the rest go to "More help"
    const acts = [];
    if (/attempts?/i.test(e)) acts.push(T('fsAttempts'));
    if (/captcha/i.test(e)) acts.push(T('fsCaptcha'));
    if (/otp/i.test(e)) acts.push(T('fsOtp'));
    if (/(expired|session)/i.test(e)) acts.push(T('fsExpired'));
    if (/(locked|blocked)/i.test(e)) acts.push(T('fsLocked'));
    if (rejected) acts.push(T('fsCaps'), T('fsRetype'));
    if (!acts.length) acts.push(T('fsNone'));

    return {
      title: signIn ? T('fsTitleSignIn') : T('fsTitleForm'),
      headline: signIn ? T('fsHeadSignIn') : T('fsHeadForm'),
      lines: [line('main', rejected ? T('fsMain') : T('fsSays', { text: e.slice(0, 160) })), line('action', acts[0])],
      summary: rejected ? T('fsSays', { text: e.slice(0, 160) }) : '',
      points: dedupe([rejected ? T('fsRejected') : '', ...acts.slice(1)]),
      example: '', source: 'form-level', ruleId: 'form-level', confidence: 'medium', needsAI: false,
      ui: I18N.ui(lang), lang,
    };
  }

  function explain(ctx) {
    const lang = ctx.lang === 'hi' ? 'hi' : 'en';
    const T = (k, p) => I18N.t(lang, k, p);
    if (ctx.formLevel) return explainFormError(ctx, lang);

    const details = [];                // collapsed "More help"
    const actions = [];                // what to do now (shown big)
    let countOk = '';                  // "the count is right" — only used when nothing else is wrong
    let headline = '';                 // one-line version shown in the compact chip
    const v = ctx.validity || {};
    const len = ctx.valueLength || 0;
    const match = findRule(ctx);
    const rule = match && match.rule;
    const rt = rule ? ruleText(rule, lang) : null;
    const pat = ctx.pattern && regexToEnglish ? regexToEnglish(ctx.pattern) : null;
    const patOk = !!(pat && pat.understood);
    let source = rule ? `rule:${rule.id}` : pat ? 'pattern' : 'generic';
    let confidence = rule ? (match.score >= 6 ? 'high' : 'medium') : patOk ? 'high' : 'low';

    // 1. Empty required field
    if (v.valueMissing || (ctx.required && len === 0)) {
      actions.push(T('requiredAction'));
      headline = T('requiredHead');
    }

    // 2. Length (attribute > pattern > rule)
    if (len > 0 && ctx.type !== 'date' && ctx.type !== 'file' && ctx.type !== 'select') {
      const pick = (a, b, c) => (a != null ? a : b != null ? b : c);
      const patMin = patOk ? pat.minLength : null;
      const patMax = patOk && pat.maxLength !== Infinity ? pat.maxLength : null;
      const min = pick(ctx.minLength, patMin, rule && rule.expect.min);
      const max = pick(ctx.maxLength, patMax, rule && rule.expect.max);
      const kind = rule ? rule.expect.kind : 'chars';
      // Digit fields (Aadhaar "1234 5678 9012", phone "98765-43210"): spaces and dashes are not
      // digits, so count digits only — otherwise "8 digits + 1 space" reads as 9 and the hint is off by one.
      let effLen = len, sep = 0;
      if (kind === 'digits' && Number.isFinite(ctx.digitCount) && len > ctx.digitCount) { sep = len - ctx.digitCount; effLen = ctx.digitCount; }
      const fb = lengthSimple(lang, effLen, min, max, kind);
      if (fb && !fb.ok) actions.push(fb.text);
      else if (fb && fb.text) countOk = fb.text;
      if (fb && !fb.ok && !headline) headline = fb.head;
      if (sep > 0) actions.push(T('sep'));
    }

    // 3. Native HTML5 validity flags (booleans only — never the value)
    const isDate = ctx.type === 'date';
    if (v.typeMismatch) {
      actions.push(ctx.type === 'url' ? T('url') : T('email'));
      if (!headline) headline = T(ctx.type === 'url' ? 'urlHead' : 'emailHead');
    }
    if (v.rangeUnderflow) {
      actions.push(T(isDate ? 'underDate' : 'underNum', { v: ctx.minAttr }));
      if (!headline) headline = T('underHead', { v: ctx.minAttr, date: isDate });
    }
    if (v.rangeOverflow) {
      actions.push(T(isDate ? 'overDate' : 'overNum', { v: ctx.maxAttr }));
      if (!headline) headline = T('overHead', { v: ctx.maxAttr, date: isDate });
    }
    if (v.stepMismatch) actions.push(T('step'));
    if (v.badInput) actions.push(T('badInput'));
    if (countOk && !actions.length) actions.push(countOk);

    // 4. What the field needs (the "main" line) + the longer explanation for "More help"
    let main, summary = '';
    if (rule) {
      main = rt.simple;
      if (rt.explain && rt.explain !== main) summary = rt.explain;
      if (pat && patOk) { const d = T('patternDetail', { text: pat.text }); if (d) details.push(d); }
      rt.tips.slice(0, 2).forEach((x) => details.push(x));
    } else if (pat) {
      main = T('patternNeeds', { text: pat.text });
    } else {
      main = genericSummary(ctx, lang);
      if (!main) { main = T('noInfo'); details.push(T('noInfoPoint')); }
    }
    if (!headline && pat && patOk && lang === 'en') headline = `needs ${pat.text}`;
    if (!headline) headline = actions[0] || String(main).split(/(?<=[.।])\s/)[0];

    // 5. Mention when the site's own message is vague
    if (ctx.errorText && VAGUE.test(ctx.errorText.trim())) {
      details.unshift(T('vague', { text: ctx.errorText.trim().slice(0, 60) }));
    }

    const gen = genericSummary(ctx, lang);
    if (!rule && !pat && gen) { source = 'native'; confidence = 'medium'; }
    // Ask the (optional) AI only when nothing on-device could explain the error
    const needsAI = !rule && !patOk && !gen;

    return {
      title: rule ? rt.title : ctx.label ? truncate(ctx.label, 40) : T('thisBox'),
      headline,
      lines: [line('main', main), ...dedupe(actions).map((a) => line('action', a))],
      summary,
      points: dedupe(details),
      example: rt ? rt.example : '',
      source, ruleId: rule ? rule.id : null, confidence, needsAI,
      ui: I18N.ui(lang), lang,
    };
  }

  const api = { explain, findRule, normalise };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.RuleEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
