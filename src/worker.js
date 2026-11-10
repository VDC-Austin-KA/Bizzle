// Cloudflare Workers entry: serves the embedded UI (built by scripts/build-static.js), the /api handler,
// public client sites (/s/<slug>) and the per-client workspace Durable Objects.
import { d1Db } from './db.js';
import { createApp } from './app.js';
import { doWorkspaces } from './workspace-do.js';
import ASSETS from './static-assets.js';

export { ClientWorkspace } from './workspace-do.js';

const STATIC_HEADERS = {
  'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=31536000', 'Cache-Control': 'no-cache',
};
// The portal's live preview renders the client's site in a sandboxed srcdoc iframe (inline styles + data: images).
const PORTAL_CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

let app;
const fontCache = {};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/')) {
      app ??= createApp(d1Db(env.DB), { secureCookies: true, alpha: env.ALPHA_MODE === 'true', workspaces: doWorkspaces(env) });
      const res = await app(request, { ip: request.headers.get('CF-Connecting-IP') ?? 'unknown' });
      if (url.pathname.startsWith('/s/')) res.headers.set('Strict-Transport-Security', 'max-age=31536000');
      return res;
    }
    const portal = url.pathname === '/portal' || url.pathname.startsWith('/portal/');
    const file = ASSETS[portal ? '/portal.html' : url.pathname];
    if (!file || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
    if (file.binary) { // self-hosted fonts: long-lived cache; CORS so the sandboxed preview can load them
      fontCache[url.pathname] ??= Uint8Array.from(atob(file.body), (c) => c.charCodeAt(0));
      return new Response(request.method === 'HEAD' ? null : fontCache[url.pathname], { headers: { 'Content-Type': file.type,
        'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' } });
    }
    return new Response(request.method === 'HEAD' ? null : file.body,
      { headers: { 'Content-Type': file.type, ...STATIC_HEADERS, ...(portal ? { 'Content-Security-Policy': PORTAL_CSP } : {}) } });
  },
};
