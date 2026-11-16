/**
 * dom.js — read-only helpers that look at the page structure.
 *
 * IMPORTANT PRIVACY RULE: nothing in this file reads `element.value`.
 * We only read labels, attributes and the site's own error text.
 */
(function (root) {
  'use strict';
  const FG = (root.FormGuard = root.FormGuard || {});

  const FIELD_SELECTOR = [
    'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])',
    'select', 'textarea',
  ].join(',');

  // Common error-message containers across Bootstrap, Material, AntD, MUI,
  // Parsley, ASP.NET, jQuery Validate and hand-written government portals.
  const ERROR_SELECTOR = [
    '.error', '.errors', '.invalid', '.invalid-feedback', '.help-block', '.error-message', '.error-msg',
    '.errorMsg', '.errormsg', '.field-error', '.form-error', '.text-danger', '.err', '.err-msg', '[role="alert"]',
    'mat-error', '.mat-error', '.mat-mdc-form-field-error', '.ant-form-item-explain-error', '.Mui-error',
    '.parsley-errors-list', '.validation-message', '.field-validation-error', 'label.error', '.form-text.text-danger',
  ].join(',');
  const ERROR_CLASS_RE = /(^|[\s_-])(error|errors|invalid|danger|err|errormsg|validation-error)([\s_-]|$)/i;
  // camelCase class names common in Angular/React apps: "loginError", "errorMsg", "fieldInvalid"
  const ERROR_CAMEL_RE = /(^|[\s_-])[a-z]*(Error|Invalid|Err)(Msg|Message|Text|Label)?([\s_-]|$)|(^|\s)error[A-Z]\w*/;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function isVisible(n) {
    if (!n || !n.getClientRects || n.getClientRects().length === 0) return false;
    const cs = getComputedStyle(n);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }

  /** Parse "rgb(r, g, b)" / "rgba(...)" and decide if it looks red. */
  function isReddish(color) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(color || '');
    if (!m) return false;
    const [r, g, b, a] = [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    return a > 0.3 && r >= 150 && g <= 120 && b <= 120 && r - Math.max(g, b) >= 70;
  }

  function hasRedBorder(el) {
    const cs = getComputedStyle(el);
    const widths = [cs.borderTopWidth, cs.borderBottomWidth].map(parseFloat);
    if (Math.max(...widths) === 0 && !isReddish(cs.outlineColor)) return false;
    return isReddish(cs.borderTopColor) || isReddish(cs.borderBottomColor) || isReddish(cs.borderLeftColor);
  }

  /** Text of an element without the text of form controls inside it. */
  function textWithoutControls(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input,select,textarea,option,script,style').forEach((n) => n.remove());
    return clean(copy.textContent);
  }

  /** Find the human-readable label of a field (tries 7 strategies). */
  function getLabelText(el) {
    const byIds = (ids) => clean(ids.split(/\s+/).map((id) => document.getElementById(id))
      .filter(Boolean).map((n) => n.textContent).join(' '));
    const a = el.getAttribute('aria-label');
    if (a) return clean(a).slice(0, 120);
    const lb = el.getAttribute('aria-labelledby');
    if (lb && byIds(lb)) return byIds(lb).slice(0, 120);
    if (el.labels && el.labels.length) {
      const t = textWithoutControls(el.labels[0]);
      if (t) return t.slice(0, 120);
    }
    // Label-like element right before the field (very common on Indian portals: <td>Name</td><td><input></td>)
    let prev = el.previousElementSibling;
    if (prev && /^(LABEL|SPAN|B|STRONG|DIV|P)$/.test(prev.tagName) && clean(prev.textContent).length < 80) {
      return clean(prev.textContent).slice(0, 120);
    }
    const cell = el.closest('td');
    if (cell && cell.previousElementSibling) {
      const t = clean(cell.previousElementSibling.textContent);
      if (t && t.length < 80) return t.slice(0, 120);
    }
    if (el.placeholder) return clean(el.placeholder).slice(0, 120);
    if (el.title) return clean(el.title).slice(0, 120);
    return '';
  }

  function hasErrorClass(n) {
    const c = typeof n.className === 'string' ? n.className : ''; // SVG elements have an object here
    return ERROR_CLASS_RE.test(c) || ERROR_CAMEL_RE.test(c);
  }

  function looksLikeError(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.matches('.help-block')) {          // Bootstrap 3 uses help-block for normal hints too
      return !!n.closest('.has-error') || isReddish(getComputedStyle(n).color);
    }
    return n.matches(ERROR_SELECTOR) || hasErrorClass(n) || isReddish(getComputedStyle(n).color);
  }

  // Red "*" or "(Mandatory)" next to a field is a hint, not an error.
  const STATIC_HINT_RE = /^[*\s]*(\(?\s*(mandatory|required|compulsory|optional)\s*\)?)?[*\s]*$/i;

  function usable(n, field) {
    if (!n || n.contains(field) || n.matches(FIELD_SELECTOR) || !isVisible(n)) return false;
    const t = clean(n.textContent);
    return t.length >= 2 && t.length < 300 && !STATIC_HINT_RE.test(t);
  }

  /** "strong" = matched by class/role/aria (reliable); weak = only red text colour. */
  const result = (n) => ({ text: clean(n.textContent).slice(0, 200), strong: n.matches(ERROR_SELECTOR) || hasErrorClass(n) });

  /**
   * Find the site's error message for a field.
   * Order: aria-errormessage -> aria-describedby -> next siblings -> nearby container.
   * @returns {{text: string, strong: boolean} | null}
   */
  function findErrorText(el) {
    const em = el.getAttribute('aria-errormessage');
    if (em) {
      const n = document.getElementById(em);
      if (usable(n, el)) return { text: clean(n.textContent).slice(0, 200), strong: true };
    }
    const db = el.getAttribute('aria-describedby');
    if (db) {
      for (const id of db.split(/\s+/)) {
        const n = document.getElementById(id);
        if (usable(n, el) && looksLikeError(n)) return result(n);
      }
    }
    // Siblings after the field (and after its wrapper)
    for (const start of [el, el.parentElement]) {
      let n = start && start.nextElementSibling;
      for (let i = 0; n && i < 3; i++, n = n.nextElementSibling) {
        if (n.matches(FIELD_SELECTOR) || n.querySelector(FIELD_SELECTOR)) break; // next field reached
        if (usable(n, el) && looksLikeError(n)) return result(n);
        const inner = n.querySelector(ERROR_SELECTOR);
        if (usable(inner, el) && looksLikeError(inner)) return result(inner);
      }
    }
    // Nearby container that holds ONLY this field (so we don't steal another field's error)
    let c = el.parentElement;
    for (let depth = 0; c && depth < 3; depth++, c = c.parentElement) {
      if (c.querySelectorAll(FIELD_SELECTOR).length > 1) break;
      for (const n of c.querySelectorAll(ERROR_SELECTOR)) {
        if (usable(n, el) && looksLikeError(n)) return result(n);
      }
    }
    return null;
  }

  // Words that make a red message an *error* rather than a promo/heading.
  const ERROR_WORDS_RE = /\b(incorrect|invalid|wrong|failed|failure|error|not valid|not match|mismatch|try again|attempts?|expired|denied|unable|cannot|can't|locked|required|mandatory)\b/i;

  /**
   * Form-level error banner: a message ABOVE or around the fields that belongs to no single field
   * (e.g. IRCTC "Incorrect UserName or Password. You have 3 attempts remaining.").
   * Returns it only for the FIRST visible field of the container, so one banner = one tooltip.
   * Needs red text or an error class, AND error-like wording, so ordinary red text is ignored.
   */
  function findFormError(field) {
    let c = field.parentElement;
    for (let depth = 0; c && depth < 7; depth++, c = c.parentElement) {
      const fields = c.querySelectorAll(FIELD_SELECTOR);
      if (fields.length > 8) return null;                       // page-level: too wide to be one form
      const first = [...fields].find((f) => isVisible(f));
      if (first !== field) continue;                            // another field owns this container
      let seen = 0;
      for (const n of c.querySelectorAll(ERROR_SELECTOR + ',div,p,span,li,h4,h5,h6')) {
        if (++seen > 200) break;
        if (n.childElementCount > 2 || n.contains(field) || n.querySelector(FIELD_SELECTOR)) continue;
        const t = clean(n.textContent);
        if (t.length < 15 || t.length > 300 || !ERROR_WORDS_RE.test(t)) continue;
        if (!isVisible(n)) continue;
        if (n.matches(ERROR_SELECTOR) || hasErrorClass(n) || isReddish(getComputedStyle(n).color)) {
          return { text: t.slice(0, 200), strong: true };
        }
      }
    }
    return null;
  }

  /** Hint text around a field (used by file assistant to find "Max 50 KB"). */
  function getHintText(el) {
    const parts = [getLabelText(el), el.title || ''];
    const db = el.getAttribute('aria-describedby');
    if (db) db.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) parts.push(n.textContent); });
    let c = el.parentElement;
    for (let depth = 0; c && depth < 3; depth++, c = c.parentElement) {
      if (c.querySelectorAll(FIELD_SELECTOR).length > 1) break;
      parts.push(textWithoutControls(c));
    }
    return clean(parts.join(' ')).slice(0, 600);
  }

  FG.Dom = { FIELD_SELECTOR, isVisible, isReddish, hasRedBorder, getLabelText, findErrorText, findFormError, getHintText };
})(globalThis);
