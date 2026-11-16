/**
 * auditLog.js — pure helpers for the privacy audit log (no chrome.* calls, so they are unit-tested).
 *
 * When the user moves to a different website the per-field "read" notes and on-device actions are
 * cleared automatically. Network activity — "sent" and "blocked" — is ALWAYS kept, so the log can
 * never hide that something left the device. Only the manual "Clear log" button removes those.
 */
(function (root) {
  'use strict';

  const KEEP_ON_SITE_SWITCH = ['sent', 'blocked'];

  /** @returns {{ kept: object[], removed: number }} */
  function pruneForSiteSwitch(log) {
    const all = Array.isArray(log) ? log : [];
    const kept = all.filter((e) => e && KEEP_ON_SITE_SWITCH.includes(e.kind));
    return { kept, removed: all.length - kept.length };
  }

  const api = { pruneForSiteSwitch, KEEP_ON_SITE_SWITCH };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.AuditLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
