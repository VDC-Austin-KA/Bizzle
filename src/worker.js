// Cloudflare Workers entry: serves the embedded UI (built by scripts/build-static.js) and the /api handler.
import { d1Db } from './db.js';
import { createApp } from './app.js';
import ASSETS from './static-assets.js';

const STATIC_HEADERS = {
  'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=31536000', 'Cache-Control': 'no-cache',
};

let app;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      app ??= createApp(d1Db(env.DB), { secureCookies: true });
      return app(request, { ip: request.headers.get('CF-Connecting-IP') ?? 'unknown' });
    }
    const file = ASSETS[url.pathname];
    if (!file || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : file.body, { headers: { 'Content-Type': file.type, ...STATIC_HEADERS } });
  },
};
