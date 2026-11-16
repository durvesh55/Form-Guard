/**
 * make-test-build.js — builds a copy of the extension for AUTOMATED browser tests (e2e/).
 *
 * The real extension only starts when a person clicks (activeTab) or grants "all websites", because
 * Chrome needs a human gesture for that. A robot cannot click the toolbar icon, so the test copy:
 *   - requests <all_urls> up front and starts the content scripts in every frame by itself
 *   - makes the tooltip's shadow root "open" so test code can read the tooltip text
 * Nothing else changes. The real extension/ folder is never modified.
 *
 *   node tools/make-test-build.js         -> e2e/.build/extension
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'extension');
const DST = path.join(__dirname, '..', 'e2e', '.build', 'extension');

fs.rmSync(DST, { recursive: true, force: true });
fs.cpSync(SRC, DST, { recursive: true });

// Take the file list from background.js so the test build can never drift from the real injection order.
const bg = fs.readFileSync(path.join(SRC, 'background.js'), 'utf8');
const list = /const CONTENT_FILES = \[([\s\S]*?)\];/.exec(bg);
if (!list) throw new Error('CONTENT_FILES not found in background.js');
const files = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const manifestPath = path.join(DST, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.host_permissions = ['<all_urls>'];
manifest.content_scripts = [{ matches: ['<all_urls>'], js: files, all_frames: true, run_at: 'document_idle' }];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const tipPath = path.join(DST, 'content', 'tooltip.js');
const tip = fs.readFileSync(tipPath, 'utf8');
if (!tip.includes("mode: 'closed'")) throw new Error("tooltip.js no longer uses mode: 'closed' — update make-test-build.js");
fs.writeFileSync(tipPath, tip.replace("mode: 'closed'", "mode: 'open'"));

console.log(`Test build ready: ${DST}\n  content scripts (${files.length}): ${files.join(', ')}`);
