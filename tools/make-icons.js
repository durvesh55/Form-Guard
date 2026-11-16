/**
 * make-icons.js — generates the extension's PNG icons with no dependencies.
 * Run:  node tools/make-icons.js
 * Draws a blue shield with a white tick (anti-aliased by 4x4 supersampling).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Shape tests in unit coordinates (0..1)
function inShield(u, v) {
  if (v < 0.08 || v > 0.95) return false;
  if (v < 0.55) return u > 0.12 && u < 0.88;
  const half = 0.38 * Math.sqrt(Math.max(0, 1 - ((v - 0.55) / 0.4) ** 2));
  return Math.abs(u - 0.5) < half;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inTick(u, v) {
  const w = 0.07;
  return distToSeg(u, v, 0.3, 0.5, 0.45, 0.66) < w || distToSeg(u, v, 0.45, 0.66, 0.72, 0.34) < w;
}

const outDir = path.join(__dirname, '..', 'extension', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const S = 4;
  const buf = png(size, (x, y) => {
    let shield = 0, tick = 0;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const u = (x + (i + 0.5) / S) / size, v = (y + (j + 0.5) / S) / size;
      if (inShield(u, v)) { shield++; if (inTick(u, v)) tick++; }
    }
    const a = shield / (S * S), t = shield ? tick / shield : 0;
    const blend = (c1, c2) => Math.round(c1 * (1 - t) + c2 * t);
    return [blend(9, 255), blend(105, 255), blend(218, 255), Math.round(a * 255)];
  });
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), buf);
}
console.log('Icons written to', outDir);
