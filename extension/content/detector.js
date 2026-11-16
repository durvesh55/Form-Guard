/**
 * detector.js — the main content script. Loaded LAST (after lib/* and the
 * other content/* files).
 *
 * Flow:
 *   page changes ──► MutationObserver / events ──► debounced scan()
 *   scan(): for every visible field ─► detectError() ─► buildContext()
 *         ─► RuleEngine.explain() ─► Tooltip.show()  (+ audit log entry)
 *         ─► (optional) AI fallback via background, only sanitised metadata
 *
 * No polling: scans only run after a DOM mutation or a user event, and are
 * debounced (250 ms, max wait 1 s).
 */
(function () {
  'use strict';
  if (window.__formGuardActive) return; // injected twice? do nothing
  window.__formGuardActive = true;

  const FG = globalThis.FormGuard;
  const { Dom, Tooltip, RuleEngine, Sanitizer, FileAssist } = FG;

  const DEFAULTS = { enabled: true, tooltips: true, aiEnabled: false, lang: 'en' };
  let settings = { ...DEFAULTS };

  const touched = new WeakSet();   // fields the user has interacted with
  const state = new WeakMap();     // field -> { editing, dismissedSig, aiSig }
  const aiCache = new Map();       // safe-payload JSON -> explanation
  const loggedKeys = new Set();    // avoid flooding the audit log
  let lastErrorCount = -1;
  const getState = (el) => { let s = state.get(el); if (!s) state.set(el, (s = {})); return s; };

  // ---------------- messaging helpers (safe if extension was reloaded) -------------
  function alive() { try { return !!chrome.runtime && !!chrome.runtime.id; } catch (e) { return false; } }
  function send(msg) {
    if (!alive()) { shutdown(); return Promise.resolve(null); }
    return chrome.runtime.sendMessage(msg).catch(() => null);
  }

  /** Audit log entry. Never contains typed values; label text is sanitised. */
  function audit(evt) {
    const entry = { ...evt, field: Sanitizer.sanitizeText(evt.field || '').clean, host: location.hostname };
    const key = JSON.stringify([entry.kind, entry.field, entry.items, entry.ruleId, entry.detail]);
    if (entry.kind === 'read' && loggedKeys.has(key)) return; // log each distinct read once
    loggedKeys.add(key);
    send({ type: 'AUDIT', entry });
  }

  // ---------------- error detection ------------------------------------------------
  function safeMatches(el, sel) { try { return el.matches(sel); } catch (e) { return false; } }

  /**
   * Is this field in an error state? Returns { reasons[], errorText } or null.
   * Signals: aria-invalid, :user-invalid / :invalid (after touch), red border
   * (after touch), nearby error element.
   */
  function detectError(el) {
    const reasons = [];
    const isTouched = touched.has(el);
    if (el.getAttribute('aria-invalid') === 'true') reasons.push('aria-invalid');
    if (safeMatches(el, ':user-invalid')) reasons.push(':user-invalid');
    else if (isTouched && safeMatches(el, ':invalid')) reasons.push(':invalid');
    if (isTouched && Dom.hasRedBorder(el)) reasons.push('red-border');
    // Framework state classes (Angular/PrimeNG/Bootstrap). Angular marks untouched required fields
    // ng-invalid on load, so require the framework's own "touched/dirty" flag or our own touch.
    const cl = el.classList;
    if (cl.contains('ng-invalid') && (cl.contains('ng-touched') || cl.contains('ng-dirty') || isTouched)) reasons.push('ng-invalid');
    else if (cl.contains('is-invalid') || cl.contains('p-invalid')) reasons.push('invalid-class');
    const err = Dom.findErrorText(el);
    if (err && (err.strong || isTouched)) reasons.push('error-element');
    // Nothing on the field itself: look for a banner for the whole form ("Incorrect username or password")
    if (!reasons.length && isTouched) {
      const fe = Dom.findFormError(el);
      if (fe) return { reasons: ['form-banner'], errorText: fe.text, formLevel: true };
    }
    if (!reasons.length) return null;
    return { reasons, errorText: err ? err.text : '' };
  }

  /** Collect SAFE context. Only the LENGTH of the value is read — never the value. */
  function buildContext(el, errorText) {
    const tag = el.tagName;
    const type = tag === 'SELECT' ? 'select' : tag === 'TEXTAREA' ? 'textarea' : (el.getAttribute('type') || 'text').toLowerCase();
    const v = el.validity || {};
    const isTextLike = !['checkbox', 'radio', 'select', 'file', 'range', 'color'].includes(type);
    return {
      label: Dom.getLabelText(el),
      nameAttr: [el.getAttribute('name'), el.id].filter(Boolean).join(' '),
      placeholder: el.getAttribute('placeholder') || '',
      type,
      pattern: el.getAttribute('pattern') || '',
      minLength: el.minLength >= 0 ? el.minLength : null,   // property is -1 when not set
      maxLength: el.maxLength >= 0 && el.maxLength < 524288 ? el.maxLength : null,
      minAttr: el.getAttribute('min'),
      maxAttr: el.getAttribute('max'),
      required: el.required || el.getAttribute('aria-required') === 'true',
      autocomplete: el.getAttribute('autocomplete') || '',
      errorText,
      valueLength: isTextLike ? String(el.value || '').length : 0, // LENGTH ONLY
      // Count of digit characters — still just a number, the value itself is never kept or sent.
      digitCount: isTextLike ? String(el.value || '').replace(/\D/g, '').length : 0,
      validity: {
        valueMissing: v.valueMissing, typeMismatch: v.typeMismatch, patternMismatch: v.patternMismatch,
        tooShort: v.tooShort, tooLong: v.tooLong, rangeUnderflow: v.rangeUnderflow,
        rangeOverflow: v.rangeOverflow, stepMismatch: v.stepMismatch, badInput: v.badInput,
      },
    };
  }

  // ---------------- the scan ------------------------------------------------------
  function scan() {
    scanTimer = null; firstPendingAt = 0;
    if (!alive()) return shutdown();
    if (!settings.enabled || !settings.tooltips) { Tooltip.hideAll(); return reportCount(0); }
    Tooltip.cleanup();

    let errors = 0;
    const fields = document.querySelectorAll(Dom.FIELD_SELECTOR);
    for (let i = 0; i < fields.length && i < 400; i++) {
      const el = fields[i];
      const t0 = performance.now();
      if (!Dom.isVisible(el) && el.type !== 'file') { Tooltip.hide(el); continue; }

      // File inputs with a chosen file -> file assistant
      if (el.type === 'file' && el.files && el.files.length) {
        const err = Dom.findErrorText(el);
        if (FileAssist.evaluate(el, err ? err.text : '', audit)) errors++;
        continue;
      }

      const det = detectError(el);
      const st = getState(el);
      if (!det) { if (Tooltip.isShown(el)) Tooltip.hide(el); continue; }
      errors++;

      const ctx = buildContext(el, det.errorText);
      if (det.formLevel) ctx.formLevel = true;
      ctx.lang = settings.lang;   // wording language only — never part of the AI payload (sanitiser whitelist)
      const sig = JSON.stringify([det.reasons, det.errorText, ctx.valueLength, ctx.digitCount, ctx.validity, ctx.lang]);
      if (st.dismissedSig === sig) continue;                        // user closed it
      if (st.editing && document.activeElement === el) continue;    // user is fixing it right now

      const s = RuleEngine.explain(ctx);
      if (st.aiSig === sig && st.aiResult) applyAI(s, st.aiResult);
      Tooltip.show(el, s, { signature: sig + (st.aiResult ? ':ai' : ''), compact: !!det.formLevel, onDismiss: () => { st.dismissedSig = sig; } });

      audit({
        kind: 'read', field: ctx.label || ctx.nameAttr || ctx.type, ruleId: s.ruleId || s.source,
        items: ['label', 'type', ctx.pattern && 'pattern', ctx.minLength != null && 'minlength', ctx.maxLength != null && 'maxlength', det.errorText && `site error text (${det.errorText.length} chars, shown only on screen)`, 'value length'].filter(Boolean),
        blocked: ['typed value'], signals: det.reasons, latencyMs: Math.round((performance.now() - t0) * 10) / 10,
      });

      if (s.needsAI && settings.aiEnabled && st.aiSig !== sig) requestAI(el, ctx, sig, s);
    }
    reportCount(errors);
  }

  /** How many form fields the user can see — lets the popup say "No form on this page". */
  function visibleFieldCount() {
    let n = 0;
    const fields = document.querySelectorAll(Dom.FIELD_SELECTOR);
    for (let i = 0; i < fields.length && i < 400; i++) if (Dom.isVisible(fields[i])) n++;
    return n;
  }

  function reportCount(n) {
    if (n === lastErrorCount) return;
    lastErrorCount = n;
    send({ type: 'ERROR_COUNT', count: n });
  }

  /** Optional AI fallback — only sanitised metadata goes to the background. */
  async function requestAI(el, ctx, sig, localSuggestion) {
    const st = getState(el);
    st.aiSig = sig; st.aiResult = null;
    const { payload } = Sanitizer.buildSafePayload(ctx);
    const key = JSON.stringify(payload);
    let explanation = aiCache.get(key);
    if (!explanation) {
      const res = await send({ type: 'AI_EXPLAIN', payload, host: location.hostname });
      if (!res || !res.ok) return; // keep the on-device suggestion
      explanation = res.explanation;
      aiCache.set(key, explanation);
    }
    if (!el.isConnected || st.aiSig !== sig) return;
    st.aiResult = { summary: explanation, source: 'ai:server' };
    Tooltip.show(el, applyAI({ ...localSuggestion }, st.aiResult), { signature: sig + ':ai', onDismiss: () => { st.dismissedSig = sig; } });
  }

  /** Put the AI explanation in the big "main" line of the card (the simple card only shows `lines`). */
  function applyAI(s, ai) {
    Object.assign(s, ai);
    if (s.lines) s.lines = [{ kind: 'main', text: ai.summary }, ...s.lines.filter((l) => l.kind === 'action')];
    return s;
  }

  // ---------------- scheduling (debounce, no polling) --------------------------------
  let scanTimer = null, firstPendingAt = 0;
  function scheduleScan(delay = 250) {
    const now = performance.now();
    if (!firstPendingAt) firstPendingAt = now;
    clearTimeout(scanTimer);
    // max-wait of 1 s so constant animations cannot starve the scan forever
    scanTimer = setTimeout(scan, now - firstPendingAt > 1000 ? 0 : delay);
  }

  const isField = (t) => t && t.nodeType === 1 && t.matches && t.matches(Dom.FIELD_SELECTOR);

  function markFormTouched(root) {
    (root || document).querySelectorAll(Dom.FIELD_SELECTOR).forEach((f) => touched.add(f));
  }

  const listeners = {
    focusout: (e) => { if (isField(e.target)) { touched.add(e.target); getState(e.target).editing = false; scheduleScan(); } },
    input: (e) => {
      if (!isField(e.target) || e.target.type === 'file') return;
      getState(e.target).editing = true;      // dismiss while the user fixes it
      Tooltip.hide(e.target);
      scheduleScan(400);
    },
    invalid: (e) => { if (isField(e.target)) { touched.add(e.target); scheduleScan(50); } },
    change: (e) => {
      if (!isField(e.target)) return;
      touched.add(e.target);
      if (e.target.type === 'file') {
        const err = Dom.findErrorText(e.target);
        FileAssist.evaluate(e.target, err ? err.text : '', audit);
        setTimeout(scheduleScan, 300); // the site's own validation may add an error later
      } else scheduleScan();
    },
    // Switching to this tab = "entering" this site: lets the background clear the previous site's activity.
    visibilitychange: () => { if (document.visibilityState === 'visible') send({ type: 'SITE_ENTER', host: location.hostname }); },
    submit: (e) => { markFormTouched(e.target); scheduleScan(50); setTimeout(() => scheduleScan(50), 600); },
    click: (e) => {
      // Custom-validation sites often validate on a plain <button> click (no <form> submit)
      const btn = e.target.closest && e.target.closest('button, input[type=submit], input[type=button], [role=button], a.btn');
      if (!btn) return;
      markFormTouched(btn.closest('form'));
      scheduleScan(100); setTimeout(() => scheduleScan(50), 700);
    },
  };

  const observer = new MutationObserver((mutations) => {
    const ours = (n) => Tooltip.isOurNode(n);
    const relevant = mutations.some((m) => !ours(m.target)
      && !(m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(ours)));
    if (relevant) scheduleScan();
  });

  function start() {
    // Tell the background which site this is BEFORE any audit entry is written (messages keep their order).
    // Pages loading in a background tab stay quiet until their tab is shown (see visibilitychange).
    if (document.visibilityState === 'visible') send({ type: 'SITE_ENTER', host: location.hostname });
    for (const [ev, fn] of Object.entries(listeners)) document.addEventListener(ev, fn, true);
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['aria-invalid', 'class', 'style', 'hidden', 'aria-describedby', 'aria-errormessage'],
    });
    scheduleScan(0);
  }

  function shutdown() {
    observer.disconnect();
    for (const [ev, fn] of Object.entries(listeners)) document.removeEventListener(ev, fn, true);
    Tooltip.hideAll();
    window.__formGuardActive = false;
  }

  // ---------------- settings + popup messages ---------------------------------------
  chrome.storage.local.get(DEFAULTS).then((s) => { settings = s; FG.lang = s.lang; start(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const k of Object.keys(DEFAULTS)) if (changes[k]) settings[k] = changes[k].newValue;
    FG.lang = settings.lang;   // the file helper reads the language from here
    scheduleScan(0);
  });
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'PING') reply({ active: true, errors: Math.max(0, lastErrorCount), fields: visibleFieldCount(), tooltips: Tooltip.count() });
    if (msg && msg.type === 'RESCAN') { markFormTouched(); scan(); reply({ errors: Math.max(0, lastErrorCount), fields: visibleFieldCount() }); }
  });
})();
