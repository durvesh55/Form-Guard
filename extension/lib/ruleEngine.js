/**
 * ruleEngine.js — turns SAFE field context into a plain-language suggestion.
 *
 * Input  (context object, built by the content script — contains NO typed value):
 *   { label, nameAttr, placeholder, type, pattern, minLength, maxLength,
 *     minAttr, maxAttr, required, autocomplete, errorText, valueLength, validity }
 *
 * Output (suggestion object):
 *   { title, summary, points[], example, source, ruleId, confidence, needsAI }
 *
 * Steps:  1. find the best matching rule (keyword scoring)
 *         2. translate the pattern attribute (regexToEnglish)
 *         3. compare value LENGTH with the expected length
 *         4. add native validity hints (required, range, type)
 */
(function (root) {
  'use strict';

  const FG = root.FormGuard || {};
  const RULES = FG.RULES || (typeof require === 'function' ? require('./rules.js').RULES : []);
  const regexToEnglish = FG.regexToEnglish || (typeof require === 'function' ? require('./regexToEnglish.js').regexToEnglish : null);

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

  /** Score every rule and return the best one (or null). */
  function findRule(ctx) {
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
        if (hasWord(name, kw)) s = Math.max(s, 2 * w);
        if (hasWord(placeholder, kw)) s = Math.max(s, 1 * w);
        if (hasWord(error, kw)) s = Math.max(s, 1 * w);
        score = Math.max(score, s);
      }
      if ((rule.types || []).includes(ctx.type)) score += 3;
      if ((rule.autocomplete || []).includes(String(ctx.autocomplete || '').toLowerCase())) score += 4;
      if (score > bestScore) { best = rule; bestScore = score; }
    }
    return bestScore >= 3 ? { rule: best, score: bestScore } : null;
  }

  const KIND_NOUN = { digits: 'digits', letters: 'letters', alnum: 'characters', chars: 'characters' };
  const VAGUE = /^(invalid|error|wrong|incorrect|not valid|please check|invalid input|invalid value|invalid format|field is invalid)\b/i;

  /** "You entered 4 characters — exactly 6 digits are needed (2 more)." */
  function lengthFeedback(len, min, max, noun, typedText) {
    if (min == null && max == null) return null;
    min = min ?? 0; max = max ?? Infinity;
    const need = min === max ? `exactly ${min} ${noun}` : max === Infinity ? `at least ${min} ${noun}` : `${min}–${max} ${noun}`;
    const typed = typedText || `You entered ${len} character${len === 1 ? '' : 's'}`;
    const unit = (k) => (k === 1 ? noun.replace(/s$/, '') : noun);
    if (len < min) return { ok: false, text: `${typed} — ${need} needed (${min - len} more).`, short: `${min - len} more ${unit(min - len)} needed` };
    if (len > max) return { ok: false, text: `${typed} — ${need} allowed (${len - max} too many; remove spaces or extra characters).`, short: `${len - max} character${len - max === 1 ? '' : 's'} too many` };
    return { ok: true, text: `Length is fine (${len}). The problem is probably a wrong character or format.` };
  }

  /** A banner for the whole form (not one field): explain from the site's own words, on-device. */
  function explainFormError(ctx) {
    const e = String(ctx.errorText || '');
    const points = [];
    const signIn = /(user ?name|user ?id|password|login|log in|sign ?in|credential)/i.test(e);
    if (/(incorrect|invalid|wrong|not match|mismatch)/i.test(e) && signIn) {
      points.push('The site checked what you typed and rejected the sign-in — the format may be fine, but the username or password is not the one on record.');
      points.push('Check Caps Lock, and that you are using your username (not email or mobile) unless the site says so.');
      points.push('Re-type the password slowly — use the eye icon to reveal it and make sure it is what you meant.');
    }
    if (/attempts?/i.test(e)) points.push('Be careful: too many wrong attempts can lock the account. Stop and use "Forgot password / account details" instead of guessing.');
    if (/captcha/i.test(e)) points.push('The captcha was wrong or expired — reload it and type the new characters exactly.');
    if (/otp/i.test(e)) points.push('The OTP is wrong or expired — request a fresh one and use it within its time limit.');
    if (/(expired|session)/i.test(e)) points.push('Your session may have timed out — refresh the page and try again.');
    if (/(locked|blocked)/i.test(e)) points.push('The account looks locked — wait for the lock time or use the site\'s reset option.');
    if (!points.length) points.push('This message is about the whole form, not one field. Re-read it and check the fields below it.');
    return {
      title: signIn ? 'Sign-in problem' : 'Problem with this form',
      summary: `The site says: "${e.slice(0, 160)}"`,
      headline: signIn ? 'username or password rejected — hover for help' : 'the site rejected this form — hover for help',
      points: dedupe(points), example: '', source: 'form-level', ruleId: 'form-level', confidence: 'medium', needsAI: false,
    };
  }

  function explain(ctx) {
    if (ctx.formLevel) return explainFormError(ctx);
    const points = [];
    let headline = '';                 // one-line version shown in the compact chip
    const v = ctx.validity || {};
    const len = ctx.valueLength || 0;
    const match = findRule(ctx);
    const rule = match && match.rule;
    const pat = ctx.pattern && regexToEnglish ? regexToEnglish(ctx.pattern) : null;
    let source = rule ? `rule:${rule.id}` : pat ? 'pattern' : 'generic';
    let confidence = rule ? (match.score >= 6 ? 'high' : 'medium') : pat && pat.understood ? 'high' : 'low';

    // 1. Empty required field
    if (v.valueMissing || (ctx.required && len === 0)) {
      points.push('This field is required, but it is empty.');
      headline = 'required, but empty';
    }

    // 2. Pattern in plain English
    if (pat) points.push(`Format required: ${pat.text}.`);

    // 3. Length feedback (attribute > pattern > rule)
    if (len > 0 && ctx.type !== 'date' && ctx.type !== 'file' && ctx.type !== 'select') {
      const pick = (a, b, c) => (a != null ? a : b != null ? b : c);
      const patMin = pat && pat.understood ? pat.minLength : null;
      const patMax = pat && pat.understood && pat.maxLength !== Infinity ? pat.maxLength : null;
      const min = pick(ctx.minLength, patMin, rule && rule.expect.min);
      const max = pick(ctx.maxLength, patMax, rule && rule.expect.max);
      const noun = rule ? KIND_NOUN[rule.expect.kind] : 'characters';
      // Digit fields (Aadhaar "1234 5678 9012", phone "98765-43210"): spaces and dashes are not
      // digits, so count digits only — otherwise "8 digits + 1 space" reads as 9 and the hint is off by one.
      let effLen = len, typedText;
      const sep = noun === 'digits' && Number.isFinite(ctx.digitCount) ? len - ctx.digitCount : 0;
      if (sep > 0) {
        effLen = ctx.digitCount;
        typedText = `You entered ${effLen} digit${effLen === 1 ? '' : 's'} plus ${sep} space${sep === 1 ? '' : 's'} or separator${sep === 1 ? '' : 's'}`;
      }
      const fb = lengthFeedback(effLen, min, max, noun, typedText);
      if (fb) points.push(fb.text);
      if (sep > 0) points.push('Many sites accept digits only — try removing the spaces or dashes.');
      if (fb && !fb.ok && !headline) headline = fb.short;
    }

    // 4. Native HTML5 validity flags (booleans only — never the value)
    if (v.typeMismatch) points.push(ctx.type === 'url' ? 'This must be a full web address starting with https://' : 'This does not look like a valid email address.');
    if (v.rangeUnderflow) points.push(`The value must be ${ctx.type === 'date' ? 'on or after' : 'at least'} ${ctx.minAttr}.`);
    if (v.rangeOverflow) points.push(`The value must be ${ctx.type === 'date' ? 'on or before' : 'at most'} ${ctx.maxAttr}.`);
    if (v.stepMismatch) points.push('The number must be a whole number (or a valid step value) — no extra decimals.');
    if (v.badInput) points.push('The browser could not read this value — for example letters typed into a number field.');
    if (!headline && v.typeMismatch) headline = ctx.type === 'url' ? 'not a valid web address' : 'not a valid email address';
    if (!headline && v.rangeUnderflow) headline = `must be ${ctx.type === 'date' ? 'on/after' : 'at least'} ${ctx.minAttr}`;
    if (!headline && v.rangeOverflow) headline = `must be ${ctx.type === 'date' ? 'on/before' : 'at most'} ${ctx.maxAttr}`;
    if (!headline && pat && pat.understood) headline = `needs ${pat.text}`;

    // 5. Rule explanation + tips
    let summary;
    if (rule) {
      summary = rule.explain;
      (rule.tips || []).slice(0, 2).forEach((t) => points.push(t));
    } else if (pat) {
      summary = `This field must contain ${pat.text}.`;
    } else {
      summary = genericSummary(ctx);
      if (!summary) {
        summary = 'This field has an error, but the website did not explain why.';
        points.push('Check the placeholder or hint text near the field for the expected format.');
      }
    }

    // 6. Mention when the site's own message is vague
    if (ctx.errorText && VAGUE.test(ctx.errorText.trim())) {
      points.unshift(`The site only said "${ctx.errorText.trim().slice(0, 60)}". Here is what it most likely means:`);
    }

    const gen = genericSummary(ctx);
    if (!rule && !pat && gen) { source = 'native'; confidence = 'medium'; }
    // Ask the (optional) AI only when nothing on-device could explain the error
    const needsAI = !rule && !(pat && pat.understood) && !gen;

    return {
      title: rule ? rule.title : ctx.label ? truncate(ctx.label, 40) : 'This field',
      summary,
      headline: headline || String(summary).split(/(?<=\.)\s/)[0],
      points: dedupe(points),
      example: rule ? rule.example : '',
      source,
      ruleId: rule ? rule.id : null,
      confidence,
      needsAI,
    };
  }

  function genericSummary(ctx) {
    const t = ctx.type;
    if (t === 'email') return 'Enter an email like name@example.com.';
    if (t === 'url') return 'Enter a full web address, e.g. https://example.com';
    if (t === 'number') return `Enter digits only${ctx.minAttr || ctx.maxAttr ? ` between ${ctx.minAttr ?? '…'} and ${ctx.maxAttr ?? '…'}` : ''}.`;
    if (t === 'tel') return 'Enter a phone number using digits only.';
    if (t === 'date') return 'Choose a valid date within the allowed range.';
    if (t === 'checkbox') return 'You must tick this box to continue.';
    if (t === 'select') return 'Please choose an option from the list.';
    if (t === 'file') return 'Please choose a file to upload.';
    if (t === 'radio') return 'Please select one of the options.';
    if (ctx.minLength != null || ctx.maxLength != null) return 'The length of your entry is not accepted.';
    return '';
  }

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const dedupe = (arr) => [...new Set(arr)];

  const api = { explain, findRule, normalise, lengthFeedback };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.RuleEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
