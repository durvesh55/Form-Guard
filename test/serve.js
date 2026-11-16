/**
 * serve.js — tiny static server for the test page (no dependencies).
 * Run:  npm run test-page   then open http://localhost:8080/test-form.html
 *
 * Why not open the file directly?  Chrome does not let extensions touch
 * file:// pages unless you enable "Allow access to file URLs".
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const START_PORT = Number(process.env.PORT) || 8080;
const MAX_TRIES = 10;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(ROOT, urlPath === '/' ? 'test-form.html' : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// If the port is busy, try the next one (up to MAX_TRIES) instead of crashing.
function listen(port, triesLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      listen(port + 1, triesLeft - 1);
    } else {
      throw err;
    }
  });
  server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
  server.removeAllListeners('error');
  console.log(`Test page: http://localhost:${server.address().port}/test-form.html`);
});

listen(START_PORT, MAX_TRIES);
