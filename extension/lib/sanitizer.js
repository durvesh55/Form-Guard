/**
 * sanitizer.js — strips anything that looks like personal data (PII) from text.
 *
 * Used in THREE places (same file, single source of truth):
 *   1. Content script  — before anything is written to the audit log.
 *   2. Background      — right before the optional AI request is sent.
 *   3. Node server     — again on arrival (defence in depth).
 *
 * Written as a "UMD-style" module so it works in a browser content script,
 * in the extension service worker (importScripts) and in Node (require).
 */
(function (root) {
  'use strict';

  // ORDER MATTERS: specific patterns first (email before long numbers, etc.)
  const PII_PATTERNS = [
    { name: 'email',     re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { name: 'upi-id',    re: /\b[\w.-]{2,}@[a-z]{2,}\b/gi },
    { name: 'card',      re: /\b(?:\d[ -]?){13,19}\b/g },
    { name: 'aadhaar',   re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
    { name: 'phone',     re: /(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g },
    { name: 'pan',       re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi },
    { name: 'ifsc',      re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi },
    { name: 'long-number', re: /\d{5,}/g },                       // any 5+ digit run
    // Sites often echo the typed value in quotes: 'abc@x' is not valid
    { name: 'quoted-text', re: /(["'‘“])(?:(?!\1).){1,80}\1/g },
  ];

  /**
   * Remove PII-looking substrings.
   * @param {string} text
   * @returns {{ clean: string, removed: Array<{type: string, count: number}> }}
   */
  function sanitizeText(text) {
    if (typeof text !== 'string' || !text) return { clean: '', removed: [] };
    let clean = text;
    const removed = [];
    for (const { name, re } of PII_PATTERNS) {
      let count = 0;
      clean = clean.replace(re, () => { count++; return `[${name.toUpperCase()} REMOVED]`; });
      if (count) removed.push({ type: name, count });
    }
    return { clean: clean.slice(0, 300), removed };
  }

  /**
   * Build the ONLY payload that may ever leave the device.
   * Whitelist approach: any key not listed here is dropped.
   */
  function buildSafePayload(ctx) {
    const label = sanitizeText(String(ctx.label || ''));
    const errorText = sanitizeText(String(ctx.errorText || ''));
    const payload = {
      label: label.clean.slice(0, 120),
      type: String(ctx.type || 'text').slice(0, 30),
      pattern: String(ctx.pattern || '').slice(0, 200),
      errorText: errorText.clean,
      valueLength: Number.isFinite(ctx.valueLength) ? ctx.valueLength : 0,
    };
    return { payload, removed: [...label.removed, ...errorText.removed] };
  }

  const api = { sanitizeText, buildSafePayload, PII_PATTERNS };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.Sanitizer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
