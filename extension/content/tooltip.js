/**
 * tooltip.js — shows suggestions under a field, isolated inside a Shadow DOM.
 *
 * Why Shadow DOM?  The page's CSS cannot reach inside it, and our CSS cannot
 * leak out — so we never break the host page's layout or styles.
 *
 * One host element (<formguard-root>) holds all tooltips. Each tooltip is
 * absolutely positioned using getBoundingClientRect() + window scroll offset,
 * and is re-positioned on scroll / resize (throttled with requestAnimationFrame).
 */
(function (root) {
  'use strict';
  const FG = (root.FormGuard = root.FormGuard || {});
  if (FG.Tooltip) return; // already loaded in this page

  const STYLE = `
    :host { all: initial; }
    .tip {
      position: absolute; z-index: 2147483647; box-sizing: border-box;
      max-width: 360px; min-width: 220px; padding: 10px 12px 8px;
      background: #fffdf5; color: #1f2328; border: 1px solid #e3b341;
      border-left: 4px solid #d4a72c; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,.18);
      font: 14px/1.5 system-ui, -apple-system, "Segoe UI", "Nirmala UI", Roboto, sans-serif;
      pointer-events: auto; animation: fade .12s ease-out;
    }
    .tip.file { border-color: #54aeff; border-left-color: #0969da; background: #f6fbff; }
    .tip::before {            /* small arrow pointing up at the field */
      content: ""; position: absolute; top: -7px; left: 16px; width: 12px; height: 12px;
      background: inherit; border-left: 1px solid #e3b341; border-top: 1px solid #e3b341;
      transform: rotate(45deg);
    }
    .tip.file::before { border-color: #54aeff; }
    .head { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 4px; }
    .head .icon { font-size: 15px; }
    .close { margin-left: auto; border: 0; background: none; cursor: pointer; font-size: 16px;
             line-height: 1; color: #57606a; padding: 0 2px; }
    .close:hover { color: #1f2328; }
    .summary { margin: 0 0 4px; }
    /* Simple card: big main sentence, highlighted "do this" lines, help hidden until asked */
    .line { margin: 0 0 6px; }
    .line.main { font-size: 15px; font-weight: 600; }
    .line.action { font-size: 14px; font-weight: 600; padding: 6px 8px; border-radius: 6px; background: rgba(212,167,44,.18); }
    .more[hidden] { display: none; }
    .speak { border: 1px solid #d0d7de; background: #fff; color: #1f2328; border-radius: 14px; padding: 3px 10px;
             cursor: pointer; font: 600 13px system-ui, "Nirmala UI", sans-serif; }
    .speakrow { margin: 2px 0 4px; }
    .morebtn { border: 0; background: none; padding: 4px 0; cursor: pointer; font: 600 13px system-ui, sans-serif;
               color: #0969da; text-decoration: underline; }
    ul { margin: 4px 0; padding-left: 18px; }
    li { margin: 2px 0; }
    .example { margin: 4px 0; color: #57606a; }
    .example code { background: #eef1f4; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, Consolas, monospace; }
    .actions { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .btn { border: 0; border-radius: 6px; padding: 6px 10px; cursor: pointer;
           font: 600 12px system-ui, sans-serif; background: #0969da; color: #fff; }
    .btn:disabled { opacity: .6; cursor: progress; }
    .status { font-size: 12px; color: #1a7f37; margin-top: 4px; }
    .status.err { color: #cf222e; }
    .foot { margin-top: 6px; font-size: 11px; color: #6e7781; display: flex; gap: 6px; }
    .badge { background: #dafbe1; color: #1a7f37; border-radius: 10px; padding: 0 6px; }
    .badge.ai { background: #fff1e5; color: #bc4c00; }

    /* Compact chip: used when several fields have errors so cards don't cover the form.
       Hover or click the chip to expand it into the full card. */
    .tip:not(.compact) { z-index: 2; }
    .tip.compact { z-index: 1; min-width: 0; max-width: var(--w, 320px); padding: 2px 8px;
                   border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.15); cursor: pointer; }
    .tip.compact::before { top: -5px; left: 12px; width: 8px; height: 8px; }
    .tip.compact .head { margin: 0; font-weight: 500; font-size: 12px; }
    .tip.compact .ttl, .tip.compact .body { display: none; }
    .tip:not(.compact) .chip { display: none; }
    .chip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .head { cursor: default; } .tip.compact .head { cursor: pointer; }
    .head:focus-visible { outline: 2px solid #0969da; outline-offset: 2px; border-radius: 4px; }
    @keyframes fade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; } }
    @media (prefers-color-scheme: dark) {
      .tip { background: #2d2a1e; color: #e6edf3; border-color: #9e6a03; }
      .tip.file { background: #0d1f33; border-color: #1f6feb; }
      .example { color: #9da7b3; } .example code { background: #30363d; }
      .close { color: #9da7b3; } .foot { color: #9da7b3; }
      .morebtn { color: #58a6ff; }
    }
  `;

  let host = null, shadow = null;
  const tips = new Map(); // field element -> { box, signature }
  let rafPending = false;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('formguard-root');
    // Host is a zero-size box at the page origin; tooltips use page coordinates.
    host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
    shadow = host.attachShadow({ mode: 'closed' }); // closed: page scripts cannot read our UI
    const style = document.createElement('style');
    style.textContent = STYLE;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
    try { root.speechSynthesis.getVoices(); } catch (e) { /* no speech support: the read-aloud button just won't show */ } // starts loading voices
    window.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
    window.addEventListener('resize', schedulePosition, { passive: true });
  }

  /**
   * "🔊 Read aloud" for people who find reading hard. Uses ONLY voices installed on this device
   * (localService): Chrome's online voices would send the text to a server, and FormGuard
   * promises nothing leaves the device. No local voice for the language -> a short message.
   */
  function speakControl(s, ui) {
    const wrap = el('div', 'speakrow');
    const synth = root.speechSynthesis;
    if (!synth || typeof root.SpeechSynthesisUtterance === 'undefined') return wrap;
    const label = () => '🔊 ' + (ui.read || 'Read aloud');
    const btn = el('button', 'speak', label());
    const msg = el('div', 'status err');
    btn.addEventListener('click', () => {
      if (synth.speaking) { synth.cancel(); btn.textContent = label(); return; }
      msg.textContent = '';
      const want = s.lang === 'hi' ? 'hi' : 'en';
      const local = synth.getVoices().filter((v) => v.localService && v.lang.toLowerCase().startsWith(want));
      const voice = local.find((v) => /-in$/i.test(v.lang)) || local[0];
      if (!voice) { msg.textContent = ui.noVoice || 'This device has no offline voice for this language.'; return; }
      const u = new root.SpeechSynthesisUtterance(s.lines.map((l) => l.text).join(' '));
      u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
      u.onend = u.onerror = () => { btn.textContent = label(); };
      btn.textContent = '⏹ ' + (ui.stop || 'Stop');
      synth.speak(u);
    });
    wrap.append(btn, msg);
    return wrap;
  }

  /** Small helper to build elements safely (textContent only — never innerHTML). */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * Show (or update) the tooltip for a field.
   * @param {HTMLElement} field
   * @param {object} s  suggestion from the rule engine / file assistant
   * @param {object} [opts] { signature, kind: 'error'|'file', anchor, actions: [{label, onClick}], onDismiss }
   */
  function show(field, s, opts = {}) {
    ensureHost();
    const existing = tips.get(field);
    if (existing && existing.signature === opts.signature) return existing.box; // nothing changed
    if (existing) existing.box.remove();

    const kind = opts.kind || 'error';
    const box = el('div', 'tip' + (kind === 'file' ? ' file' : ''));
    box.setAttribute('role', 'note');
    const entry = { box, signature: opts.signature, anchor: opts.anchor || field, kind, pinned: false, hover: false, startCompact: !!opts.compact };

    const head = el('div', 'head');
    head.tabIndex = 0;
    const title = s.title || 'Fix this field';
    head.append(el('span', 'icon', kind === 'file' ? '📎' : '💡'), el('span', 'ttl', title),
      el('span', 'chip', s.headline ? `${title}: ${s.headline}` : title));
    head.title = 'Click to pin / unpin the full explanation';
    const close = el('button', 'close', '×');
    close.title = (s.ui && s.ui.dismiss) || 'Dismiss';
    close.setAttribute('aria-label', (s.ui && s.ui.dismiss) || 'Dismiss suggestion');
    close.addEventListener('click', (e) => { e.stopPropagation(); hide(field); if (opts.onDismiss) opts.onDismiss(); });
    head.append(close);
    box.append(head);
    // Expand on hover, pin on click / Enter
    const toggle = () => { entry.pinned = !entry.pinned; layout(); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    box.addEventListener('mouseenter', () => { entry.hover = true; layout(); });
    box.addEventListener('mouseleave', () => { entry.hover = false; layout(); });

    const ui = s.ui || {};
    const simple = Array.isArray(s.lines) && s.lines.length > 0;
    const body = el('div', 'body');
    box.append(body);
    // Simple cards (field suggestions): big "what to do" lines first, everything else behind "More help".
    // Plain cards (file assistant): show everything at once, as before.
    const more = simple ? el('div', 'more') : body;
    if (simple) {
      const lines = el('div', 'lines');
      s.lines.forEach((l) => lines.append(el('p', 'line ' + l.kind, l.text)));
      body.append(lines, speakControl(s, ui));
    }
    const addExample = (parent) => {
      if (!s.example) return;
      const ex = el('div', 'example', (ui.example || 'Example') + ': ');
      ex.append(el('code', null, s.example));
      parent.append(ex);
    };
    if (simple) addExample(body);
    if (s.summary) more.append(el('p', 'summary', s.summary));
    if (s.points && s.points.length) {
      const ul = el('ul');
      s.points.forEach((p) => ul.append(el('li', null, p)));
      more.append(ul);
    }
    if (!simple) addExample(body);
    if (opts.actions && opts.actions.length) {
      const bar = el('div', 'actions');
      const status = el('div', 'status');
      opts.actions.forEach((a) => {
        const b = el('button', 'btn', a.label);
        b.addEventListener('click', async () => {
          b.disabled = true; status.className = 'status'; status.textContent = ui.working || 'Working…';
          try { status.textContent = (await a.onClick()) || 'Done.'; }
          catch (e) { status.className = 'status err'; status.textContent = e.message || String(e); b.disabled = false; }
        });
        bar.append(b);
      });
      body.append(bar, status);
    }
    const foot = el('div', 'foot');
    const isAI = String(s.source || '').startsWith('ai');
    if (simple && !isAI) {
      foot.append(el('span', null, '✓ ' + (ui.onDevice || 'Checked on your device — nothing was sent anywhere.')));
    } else {
      foot.append(el('span', 'badge' + (isAI ? ' ai' : ''), isAI ? 'AI fallback (sanitised metadata)' : 'On-device'));
      foot.append(el('span', null, 'FormGuard · ' + (s.source || 'rule')));
    }
    // AI use must always be visible; the reassuring on-device note can stay in "More help"
    (simple && !isAI ? more : body).append(foot);
    if (simple && more.childNodes.length) {
      more.hidden = true;
      const moreBtn = el('button', 'morebtn', ui.more || 'More help');
      moreBtn.addEventListener('click', () => {
        more.hidden = !more.hidden;
        moreBtn.textContent = more.hidden ? (ui.more || 'More help') : (ui.less || 'Hide help');
      });
      body.append(moreBtn, more);
    }

    if (existing) { entry.pinned = existing.pinned; entry.hover = existing.hover; }
    shadow.appendChild(box);
    tips.set(field, entry);
    layout();
    return box;
  }

  /**
   * One tooltip on the page -> full card.  Several -> compact one-line chips
   * (so cards don't cover the rest of the form); hovered / pinned chips expand.
   */
  function layout() {
    for (const t of tips.values()) {
      // startCompact: long messages (e.g. a form-level banner) stay a one-line chip even when alone,
      // so they don't cover the next field. Hover or click expands them.
      const compact = (tips.size > 1 || t.startCompact) && !t.pinned && !t.hover;
      t.box.classList.toggle('compact', compact);
    }
    for (const t of tips.values()) position(t.anchor, t.box); // width changed -> re-clamp
  }

  function position(field, box) {
    const r = field.getBoundingClientRect();
    if (!field.isConnected || (r.width === 0 && r.height === 0)) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.style.setProperty('--w', Math.max(r.width, 200) + 'px');
    const maxLeft = document.documentElement.clientWidth - box.offsetWidth - 8;
    const left = Math.max(8, Math.min(r.left, maxLeft)) + window.scrollX;
    box.style.left = left + 'px';
    box.style.top = r.bottom + window.scrollY + 8 + 'px';
  }

  function schedulePosition() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      for (const t of tips.values()) position(t.anchor, t.box);
    });
  }

  function hide(field) {
    const t = tips.get(field);
    if (t) { t.box.remove(); tips.delete(field); layout(); }
  }

  /** Remove tooltips whose field was removed from the page (SPA re-render). */
  function cleanup() {
    for (const field of [...tips.keys()]) if (!field.isConnected) hide(field);
  }

  function hideAll() { for (const f of [...tips.keys()]) hide(f); }

  FG.Tooltip = {
    show, hide, hideAll, cleanup, reposition: schedulePosition,
    isShown: (f) => tips.has(f),
    count: () => tips.size,
    isOurNode: (n) => n === host,
    // For automated tests only. Content scripts run in an isolated world, so the page can't call this.
    _debug: () => [...tips].map(([field, t]) => ({ field, box: t.box })),
  };
})(globalThis);
