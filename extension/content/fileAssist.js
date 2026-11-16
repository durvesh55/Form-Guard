/**
 * fileAssist.js — checks a selected file against the field's rules.
 *
 * Reads only FILE METADATA: size (bytes) and MIME type, plus the extension of
 * the name (used locally, never logged). File contents are only touched when
 * the user clicks "Resize for me", and even then they stay in the browser.
 *
 * Where limits come from (in this order):
 *   data-max-size / data-maxsize / data-max-file-size / data-min-size attributes
 *   hint text near the field ("Max 50 KB", "20KB to 50KB")
 *   the site's error message ("File size should be less than 100kb")
 */
(function (root) {
  'use strict';
  const FG = (root.FormGuard = root.FormGuard || {});
  const { Dom, Tooltip, ImageResize } = FG;

  const UNIT = { b: 1, byte: 1, bytes: 1, k: 1024, kb: 1024, kilobyte: 1024, kilobytes: 1024, m: 1048576, mb: 1048576, megabyte: 1048576, megabytes: 1048576 };
  const SIZE_RE = /(\d+(?:\.\d+)?)\s*(kilobytes?|megabytes?|bytes?|kb|mb|k|m|b)\b/gi;
  const DEFAULT_GUESS = 100 * 1024; // used only when the site says "too large" but gives no number

  function fmt(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function parseAttrSize(v) {
    if (!v) return null;
    const m = /^\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(v);
    if (!m) return null;
    return Math.round(+m[1] * (UNIT[m[2].toLowerCase()] || 1));
  }

  /** Extract {min, max} byte limits from free text. */
  function parseSizeText(text) {
    const sizes = [];
    let m;
    SIZE_RE.lastIndex = 0;
    while ((m = SIZE_RE.exec(text))) {
      const unit = m[2].toLowerCase();
      sizes.push({ bytes: Math.round(+m[1] * UNIT[unit]), index: m.index });
    }
    if (!sizes.length) return {};
    if (sizes.length >= 2 && /(between|to|-|–|from)/i.test(text)) {
      const [a, b] = [sizes[0].bytes, sizes[1].bytes].sort((x, y) => x - y);
      return { min: a, max: b };
    }
    const before = text.slice(Math.max(0, sizes[0].index - 25), sizes[0].index).toLowerCase();
    if (/(min|at least|more than|greater than)/.test(before)) return { min: sizes[0].bytes };
    return { max: sizes[0].bytes };
  }

  function getLimits(input, errorText) {
    const d = input.dataset || {};
    const attrMax = parseAttrSize(d.maxSize || d.maxsize || d.maxFileSize);
    const attrMin = parseAttrSize(d.minSize || d.minsize);
    const fromHint = parseSizeText(Dom.getHintText(input));
    const fromErr = parseSizeText(errorText || '');
    return {
      max: attrMax || fromErr.max || fromHint.max || null,
      min: attrMin || fromErr.min || fromHint.min || null,
      errorMentionsSize: /size|large|big|exceed|kb|mb/i.test(errorText || ''),
      errorMentionsType: /format|type|extension|jpg|jpeg|png|pdf/i.test(errorText || ''),
    };
  }

  function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }

  /** Does the file match <input accept="...">? */
  function acceptOk(file, accept) {
    if (!accept) return true;
    const ext = '.' + extOf(file.name);
    return accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).some((tok) => {
      if (tok.startsWith('.')) return tok === ext || (tok === '.jpg' && ext === '.jpeg') || (tok === '.jpeg' && ext === '.jpg');
      if (tok.endsWith('/*')) return (file.type || '').startsWith(tok.slice(0, -1));
      return tok === (file.type || '').toLowerCase();
    });
  }

  function describeAccept(accept) {
    return accept.split(',').map((t) => t.trim().replace(/^\./, '').replace('image/', '').replace('application/', '').toUpperCase())
      .filter(Boolean).join(', ');
  }

  // Many sites hide the real <input type=file> behind a styled button: anchor to something visible
  const anchorFor = (input) => (Dom.isVisible(input) ? input : [...(input.labels || [])].find(Dom.isVisible) || input.parentElement);

  const resizable = (file) => /^image\/(jpeg|png|webp|bmp)$/.test(file.type);

  const hiddenInput = (input) => !Dom.isVisible(input);
  const shortName = (n) => (n.length > 28 ? n.slice(0, 14) + '…' + n.slice(-11) : n);

  /**
   * Evaluate the file input and show a tooltip if something is wrong.
   * Many sites hide the real <input type=file> behind a styled button, so the browser shows no file
   * name at all. FormGuard therefore keeps a small "✓ Attached: name (size)" chip so the user can SEE
   * that the file is chosen, and is told what to do next (click the site's own Upload / Submit).
   * @param {HTMLInputElement} input
   * @param {string} errorText    the site's error text ('' if none)
   * @param {function} audit      audit logger from detector.js
   * @returns {boolean} true if a problem was shown
   */
  function evaluate(input, errorText, audit) {
    const file = input.files && input.files[0];
    if (!file) { Tooltip.hide(input); return false; }
    const lang = FG.lang === 'hi' ? 'hi' : 'en';
    const T = (k, p) => FG.I18n.t(lang, k, p);
    const ui = FG.I18n.ui(lang);
    const accept = input.getAttribute('accept') || '';
    const lim = getLimits(input, errorText);
    const problems = [];
    const typeOk = acceptOk(file, accept);
    const sizeLabel = `${(extOf(file.name) || file.type || 'unknown').toUpperCase()}, ${fmt(file.size)}`;

    if (!typeOk) problems.push(T('faTypeBad', { allowed: describeAccept(accept), ext: (extOf(file.name) || file.type).toUpperCase() }));
    let max = lim.max;
    if (!max && lim.errorMentionsSize && errorText) max = DEFAULT_GUESS; // site said "too big" without a number
    if (max && file.size > max) problems.push(T('faTooBig', { size: fmt(file.size), max: fmt(max), guess: !lim.max }));
    if (lim.min && file.size < lim.min) problems.push(T('faTooSmall', { size: fmt(file.size), min: fmt(lim.min) }));
    if (!problems.length && errorText) problems.push(T('faLooksFine', { size: fmt(file.size) }));

    audit({ kind: 'read', field: Dom.getLabelText(input) || 'file upload', items: ['file size', 'file type', 'accept attribute', errorText ? 'error text' : null].filter(Boolean), blocked: ['file contents', 'file name'] });

    // "✓ Attached" chip — only for hidden inputs (a visible input already shows the name itself).
    // The name is shown on screen only, inside FormGuard's own box; it is never logged or sent.
    const showAttached = () => {
      if (input.files[0] !== file || !hiddenInput(input)) return;
      Tooltip.show(input, {
        title: T('faAttachedTitle'), headline: `${shortName(file.name)} (${fmt(file.size)})`,
        lines: [{ kind: 'main', text: T('faAttached', { name: shortName(file.name), size: fmt(file.size) }) }],
        source: 'on-device', ui, lang,
      }, { kind: 'file', compact: true, signature: ['att', file.name, file.size, lang].join('|'), anchor: anchorFor(input) });
    };

    if (!problems.length) {
      const st = FG._lastResize && FG._lastResize.get(input);
      if (st && Date.now() - st.at < 5000) {
        Tooltip.show(input, {
          title: T('faFixedTitle'), lines: [{ kind: 'main', text: st.message }],
          source: 'on-device canvas', ui, lang,
        }, { kind: 'file', signature: 'ok' + st.at + lang, anchor: anchorFor(input) });
        setTimeout(() => { if (hiddenInput(input)) showAttached(); else Tooltip.hide(input); }, 8000);
      } else if (hiddenInput(input)) showAttached();
      else Tooltip.hide(input);
      return false;
    }

    const actions = [];
    const needsSmaller = max && file.size > max;
    const outType = ImageResize.pickOutputType(accept, file.type);
    const convertible = !typeOk && resizable(file) && acceptOk({ name: 'x.' + outType.split('/')[1].replace('jpeg', 'jpg'), type: outType }, accept);
    if (resizable(file) && (needsSmaller || convertible)) {
      const label = needsSmaller ? T('faResizeBtn', { max: fmt(max) }) : T('faConvertBtn', { type: outType.split('/')[1].toUpperCase() });
      actions.push({
        label,
        onClick: async () => {
          const r = await ImageResize.compressToLimit(file, needsSmaller ? max : Infinity, { accept });
          const msg = T('faFixed', { from: fmt(file.size), to: fmt(r.file.size) });
          FG._lastResize = FG._lastResize || new WeakMap();
          FG._lastResize.set(input, { at: Date.now(), message: msg });
          audit({ kind: 'local', field: Dom.getLabelText(input) || 'file upload', detail: `Image compressed locally ${fmt(file.size)} → ${fmt(r.file.size)} in ${r.ms} ms (${r.width}×${r.height}px, ${r.attempts} steps). 0 bytes sent.`, resizeMs: r.ms });
          ImageResize.replaceInputFile(input, r.file); // triggers 'change' -> evaluate() runs again
          return msg;
        },
      });
    }

    const lines = [{ kind: 'main', text: problems[0] }];
    if (accept) lines.push({ kind: 'action', text: T('faAllowed', { types: describeAccept(accept), max: lim.max ? fmt(lim.max) : '', min: lim.min ? fmt(lim.min) : '' }) });
    Tooltip.show(input, {
      title: T('faNotOk'),
      headline: !typeOk ? T('faHeadType', { allowed: describeAccept(accept), fix: actions.length > 0 })
        : needsSmaller ? T('faHeadSize', { size: fmt(file.size), max: fmt(max), fix: actions.length > 0 })
        : problems[0],
      lines,
      summary: T('faSelected', { label: sizeLabel }),
      points: problems.slice(1),
      source: 'file-check', ui, lang,
    }, { kind: 'file', signature: [file.size, file.type, errorText, max, lang].join('|'), actions, anchor: anchorFor(input) });
    return true;
  }

  FG.FileAssist = { evaluate, parseSizeText, acceptOk, fmt };
})(globalThis);
