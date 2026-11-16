/**
 * imageResize.js — compresses an image LOCALLY so it fits a size limit.
 *
 * Nothing is uploaded: the image is decoded with createImageBitmap(), drawn on
 * an OffscreenCanvas (or a normal <canvas> fallback) and re-encoded.
 *
 * Strategy (keeps aspect ratio):
 *   1. Encode at quality 0.92.
 *   2. While too big and quality > 0.5  -> lower quality by 0.08.
 *   3. Still too big                    -> shrink width & height by the
 *      square-root of (target / current size), reset quality to 0.85, repeat.
 *   Stops after 15 attempts.
 */
(function (root) {
  'use strict';
  const FG = (root.FormGuard = root.FormGuard || {});

  /** Pick an output format the input's `accept` attribute allows. */
  function pickOutputType(accept, originalType) {
    const a = String(accept || '').toLowerCase();
    const allows = (mime, exts) => !a || a.includes('image/*') || a.includes(mime) || exts.some((e) => a.includes(e));
    if (allows('image/jpeg', ['.jpg', '.jpeg'])) return 'image/jpeg';
    if (allows('image/webp', ['.webp'])) return 'image/webp';
    if (allows('image/png', ['.png'])) return 'image/png'; // PNG ignores quality; only scaling helps
    return originalType || 'image/jpeg';
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function encode(canvas, type, quality) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encoding failed'))), type, quality));
  }

  function draw(bitmap, w, h, type) {
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // JPEG has no transparency
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas;
  }

  /**
   * @param {File} file          the original image (stays in memory, never sent)
   * @param {number} maxBytes    target size limit in bytes
   * @param {object} [opt]       { accept, minBytes }
   * @returns {Promise<{file: File, attempts: number, ms: number, width: number, height: number}>}
   */
  async function compressToLimit(file, maxBytes, opt = {}) {
    const t0 = performance.now();
    const type = pickOutputType(opt.accept, file.type);
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width, h = bitmap.height;
    const target = Math.floor(maxBytes * 0.97); // small safety margin
    const MIN_Q = 0.4, MAX_Q = 0.92;
    const lossy = type !== 'image/png';
    let best = null, attempts = 0;

    for (let round = 0; round < 8 && !best; round++) {
      const canvas = draw(bitmap, w, h, type);
      // 1. Can this resolution fit at all (at the lowest acceptable quality)?
      const low = await encode(canvas, type, MIN_Q); attempts++;
      if (low.size > target) {
        // No -> shrink width AND height by the same ratio (keeps aspect ratio).
        // File size scales roughly with pixel count, hence the square root.
        const ratio = Math.min(0.9, Math.max(0.2, Math.sqrt(target / low.size) * 0.92));
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        continue;
      }
      if (!lossy) { best = low; break; }
      // 2. Yes -> binary-search the HIGHEST quality that still fits (best-looking result,
      //    and closest to the limit, which also helps forms that have a minimum size).
      best = low;
      const top = await encode(canvas, type, MAX_Q); attempts++;
      if (top.size <= target) { best = top; break; }
      let lo = MIN_Q, hi = MAX_Q;
      for (let i = 0; i < 5; i++) {
        const mid = (lo + hi) / 2;
        const b = await encode(canvas, type, mid); attempts++;
        if (b.size <= target) { best = b; lo = mid; } else hi = mid;
      }
    }
    bitmap.close && bitmap.close();
    if (!best) throw new Error('Could not compress the image enough. Try a smaller photo.');
    const blob = best;

    const ext = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }[type];
    const name = file.name.replace(/\.[^.]+$/, '') + '_resized.' + ext;
    const out = new File([blob], name, { type, lastModified: Date.now() });
    return { file: out, attempts, ms: Math.round(performance.now() - t0), width: w, height: h };
  }

  /** Put a File back into an <input type=file> and tell the page it changed. */
  function replaceInputFile(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    // Sites (and frameworks like React/Angular) listen for these events.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  FG.ImageResize = { compressToLimit, replaceInputFile, pickOutputType };
})(globalThis);
