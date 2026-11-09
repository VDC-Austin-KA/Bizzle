// Local development server: node:http + node:sqlite around the shared fetch-style handler in app.js.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db-node.js';
import { createApp } from './app.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const STATIC_HEADERS = { 'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' };

export function nodeHandler(app) {
  return async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) {
      const rel = normalize(url.pathname === '/' ? 'index.html' : url.pathname === '/quote' ? 'quote.html' : url.pathname.slice(1));
      try {
        if (rel.startsWith('..')) throw 0;
        const data = await readFile(join(PUBLIC_DIR, rel));
        res.writeHead(200, { 'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream', ...STATIC_HEADERS });
        return res.end(data);
      } catch { res.writeHead(404); return res.end('Not found'); }
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await app(request, { ip: req.socket.remoteAddress });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  if (!(await db.get('SELECT COUNT(*) AS n FROM users')).n) console.warn('No users yet — run `npm run seed` first.');
  const port = Number(process.env.PORT ?? 3000);
  createServer(nodeHandler(createApp(db, { alpha: process.env.ALPHA_MODE !== 'false' }))).listen(port, () => console.log(`Bizzle running at http://localhost:${port}`));
}
