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

  /**
   * Evaluate the file input and show a tooltip if something is wrong.
   * @param {HTMLInputElement} input
   * @param {string} errorText    the site's error text ('' if none)
   * @param {function} audit      audit logger from detector.js
   * @returns {boolean} true if a problem was shown
   */
  function evaluate(input, errorText, audit) {
    const file = input.files && input.files[0];
    if (!file) { Tooltip.hide(input); return false; }
    const accept = input.getAttribute('accept') || '';
    const lim = getLimits(input, errorText);
    const problems = [];
    const typeOk = acceptOk(file, accept);
    const sizeLabel = `${(extOf(file.name) || file.type || 'unknown').toUpperCase()}, ${fmt(file.size)}`;

    if (!typeOk) problems.push(`This field accepts only ${describeAccept(accept)}. Your file is ${(extOf(file.name) || file.type).toUpperCase()}.`);
    let max = lim.max;
    if (!max && lim.errorMentionsSize && errorText) max = DEFAULT_GUESS; // site said "too big" without a number
    if (max && file.size > max) problems.push(`Your file is ${fmt(file.size)}, but the limit is ${fmt(max)}${lim.max ? '' : ' (guessed — the site did not state a limit)'}.`);
    if (lim.min && file.size < lim.min) problems.push(`Your file is ${fmt(file.size)}, but it must be at least ${fmt(lim.min)}. Use a clearer / higher-resolution scan.`);
    if (!problems.length && errorText) {
      problems.push(`Size (${fmt(file.size)}) and type look fine, so the site may check something else — for example photo dimensions (width × height in pixels) or the file name.`);
    }

    audit({ kind: 'read', field: Dom.getLabelText(input) || 'file upload', items: ['file size', 'file type', 'accept attribute', errorText ? 'error text' : null].filter(Boolean), blocked: ['file contents', 'file name'] });

    if (!problems.length) {
      const st = FG._lastResize && FG._lastResize.get(input);
      if (st && Date.now() - st.at < 5000) {
        Tooltip.show(input, { title: 'File fixed', summary: st.message, source: 'on-device canvas' }, { kind: 'file', signature: 'ok' + st.at, anchor: anchorFor(input) });
        setTimeout(() => Tooltip.hide(input), 6000);
      } else Tooltip.hide(input);
      return false;
    }

    const actions = [];
    const needsSmaller = max && file.size > max;
    const outType = ImageResize.pickOutputType(accept, file.type);
    const convertible = !typeOk && resizable(file) && acceptOk({ name: 'x.' + outType.split('/')[1].replace('jpeg', 'jpg'), type: outType }, accept);
    if (resizable(file) && (needsSmaller || convertible)) {
      const label = needsSmaller ? `Resize for me (to under ${fmt(max)})` : `Convert to ${outType.split('/')[1].toUpperCase()}`;
      actions.push({
        label,
        onClick: async () => {
          const r = await ImageResize.compressToLimit(file, needsSmaller ? max : Infinity, { accept });
          const msg = `Resized on your device: ${fmt(file.size)} → ${fmt(r.file.size)} (${r.width}×${r.height}px, ${r.attempts} step${r.attempts > 1 ? 's' : ''}, ${r.ms} ms). Nothing was uploaded by FormGuard.`;
          FG._lastResize = FG._lastResize || new WeakMap();
          FG._lastResize.set(input, { at: Date.now(), message: msg });
          audit({ kind: 'local', field: Dom.getLabelText(input) || 'file upload', detail: `Image compressed locally ${fmt(file.size)} → ${fmt(r.file.size)} in ${r.ms} ms. 0 bytes sent.`, resizeMs: r.ms });
          ImageResize.replaceInputFile(input, r.file); // triggers 'change' -> evaluate() runs again
          return msg;
        },
      });
    }

    Tooltip.show(input, {
      title: 'File not accepted',
      headline: !typeOk ? `only ${describeAccept(accept)} allowed` + (actions.length ? ' — open to fix' : '')
        : needsSmaller ? `${fmt(file.size)}, limit ${fmt(max)}` + (actions.length ? ' — open to resize' : '')
        : problems[0],
      summary: `Selected file: ${sizeLabel}.`,
      points: problems,
      example: accept ? `Allowed: ${describeAccept(accept)}${lim.max ? ` · max ${fmt(lim.max)}` : ''}${lim.min ? ` · min ${fmt(lim.min)}` : ''}` : '',
      source: 'file-check',
    }, { kind: 'file', signature: [file.size, file.type, errorText, max].join('|'), actions, anchor: anchorFor(input) });
    return true;
  }

  FG.FileAssist = { evaluate, parseSizeText, acceptOk, fmt };
})(globalThis);
