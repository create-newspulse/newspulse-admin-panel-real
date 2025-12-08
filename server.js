// Minimal static server for Render/Node hosting
// Serves the Vite build output from ./dist with SPA fallback
// ESM-compatible (package.json has "type":"module")

import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ct = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = (req.url || '/').split('?')[0];
    // Normalize and prevent directory traversal
    const safePath = path.normalize(urlPath).replace(/^\.+/, '');
    let filePath = path.join(distDir, safePath);

    // If path is a directory, serve index.html
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.isDirectory()) {
      // For SPA, always fall back to index.html
      filePath = path.join(distDir, 'index.html');
      await serveFile(res, filePath);
      return;
    }

    await serveFile(res, filePath);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`SPA server listening on http://0.0.0.0:${port} (serving ./dist)`);
});
