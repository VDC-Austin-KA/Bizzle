// Client portal API + staff client-management API + public client sites.
// Separation: Bizzle's database (D1) keeps only an index row per client (id, slug, business name, services, status).
// Everything the client enters lives in the client's own workspace database (see workspace.js).
import { fail, cookie, readJson } from './http.js';
import { PERMISSIONS as P } from './rbac.js';
import { WORKFLOWS } from '../public/pricing.js';
import { WORKFLOW_DEFS, fieldsFor } from '../public/workflows.js';
import { renderSite } from '../public/site-template.js';
import { buildRunbook } from './runbook.js';
import { throttled, recordFailure } from './auth.js';

const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const slugify = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'site';
const SITE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const scanHits = new Map();

export function portalRoutes({ db, workspaces, secureCookies, origin }) {
  // Workspace errors (bad input, expired invite…) become 400s with the workspace's plain-language message.
  const ws = (id) => ({ call: async (m, ...a) => { try { return await workspaces(id).call(m, ...a); } catch (e) { fail(400, e.message); } } });
  const clientCookie = (v, maxAge) => `csid=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  const clientRow = async (id) => (await db.get('SELECT * FROM clients WHERE id = ?', id)) ?? fail(404, 'Client not found');
  // Client session: cookie "csid=<clientId>.<token>", checked against the client's own workspace.
  async function clientAuth(req) {
    const [id, token] = String(cookie(req, 'csid') ?? '').split('.');
    if (!/^[0-9a-f]{32}$/.test(id ?? '') || !(await ws(id).call('checkSession', token))) fail(401, 'Please sign in');
    return { id, w: ws(id), token };
  }
  const setStatus = (id, status) => db.run('UPDATE clients SET status = ? WHERE id = ?', status, id);
  const inviteUrl = (req, id, token) => `${origin ?? new URL(req.url).origin}/portal#invite=${id}.${token}`;

  return [
    // ---------- client portal ----------
    ['POST', /^\/api\/portal\/accept$/, 'public', async ({ req, headers }) => {
      const { invite, email, password } = await readJson(req);
      const [id, token] = String(invite ?? '').split('.');
      if (!/^[0-9a-f]{32}$/.test(id ?? '')) fail(400, 'This invite link is invalid');
      const row = await clientRow(id);
      const s = await ws(id).call('acceptInvite', token, email, password);
      if (row.status === 'invited') await setStatus(id, 'active');
      headers.set('Set-Cookie', clientCookie(`${id}.${s.token}`, 43200));
      return { ok: true, slug: row.slug };
    }],
    ['POST', /^\/api\/portal\/login$/, 'public', async ({ req, ip, headers }) => {
      if (throttled(ip)) fail(429, 'Too many attempts, try again later');
      const { slug, email, password } = await readJson(req);
      const row = await db.get("SELECT id FROM clients WHERE slug = ? AND status != 'deleted'", String(slug ?? ''));
      const s = row && await ws(row.id).call('login', email, password);
      if (!s) { recordFailure(ip); fail(401, 'Email or password is incorrect'); }
      headers.set('Set-Cookie', clientCookie(`${row.id}.${s.token}`, 43200));
      return { ok: true };
    }],
    ['POST', /^\/api\/portal\/logout$/, 'public', async ({ req, headers }) => {
      const [id, token] = String(cookie(req, 'csid') ?? '').split('.');
      if (/^[0-9a-f]{32}$/.test(id ?? '')) await ws(id).call('logout', token).catch(() => {});
      headers.set('Set-Cookie', clientCookie('', 0));
      return { ok: true };
    }],
    ['GET', /^\/api\/portal\/state$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      const s = await w.call('state');
      return { ...s, siteUrl: `/s/${s.slug}`, fields: fieldsFor(s.workflows),
        services: s.workflows.map((id) => ({ id, label: WORKFLOWS[id]?.label ?? id, access: WORKFLOW_DEFS[id].access, security: WORKFLOW_DEFS[id].security, steps: WORKFLOW_DEFS[id].steps })) };
    }],
    ['POST', /^\/api\/portal\/profile$/, 'public', async ({ req }) => {
      const { id, w } = await clientAuth(req);
      const { profile, publish } = await readJson(req);
      const r = await w.call('saveProfile', profile ?? {}, { publish: !!publish });
      if (!r.ok) fail(400, r.errors.join(' · '));
      if (r.published) await setStatus(id, 'live');
      if (r.first) await w.call('runSecurityScan', 'Setup system').catch(() => {}); // first launch: check their existing domain
      return r;
    }],
    ['POST', /^\/api\/portal\/asset$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      const { name, data, remove } = await readJson(req);
      return remove ? w.call('removeAsset', name === 'hero' ? 'hero' : 'logo') : w.call('putAsset', name, data);
    }],
    ['POST', /^\/api\/portal\/secrets$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      const { name, value } = await readJson(req);
      return w.call('putSecret', name, value);
    }],
    ['POST', /^\/api\/portal\/secrets\/delete$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      return w.call('deleteSecret', (await readJson(req)).name);
    }],
    ['POST', /^\/api\/portal\/secrets\/verify$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      return w.call('verifySecret', (await readJson(req)).name);
    }],
    ['POST', /^\/api\/portal\/scan$/, 'public', async ({ req }) => {
      const { id, w } = await clientAuth(req);
      if (Date.now() - (scanHits.get(id) ?? 0) < 60_000) fail(429, 'Please wait a minute between checks');
      scanHits.set(id, Date.now());
      const r = await w.call('runSecurityScan');
      if (!r.ok) fail(400, r.errors.join(' · '));
      return r;
    }],
    ['GET', /^\/api\/portal\/export$/, 'public', async ({ req }) => {
      const { w } = await clientAuth(req);
      const data = await w.call('exportData');
      return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="my-business-data.json"', 'Cache-Control': 'no-store' } });
    }],
    ['POST', /^\/api\/portal\/delete$/, 'public', async ({ req, headers }) => {
      const { id, w } = await clientAuth(req);
      const row = await clientRow(id);
      if ((await readJson(req)).confirm !== row.business) fail(400, 'Type your business name exactly to confirm');
      await w.call('destroy');
      await setStatus(id, 'deleted');
      headers.set('Set-Cookie', clientCookie('', 0));
      return { ok: true };
    }],

    // ---------- public client sites ----------
    ['GET', /^\/s\/([a-z0-9-]{1,40})\/?$/, 'public', async ({ params: [slug] }) => {
      const row = await db.get("SELECT id FROM clients WHERE slug = ? AND status = 'live'", slug);
      const pub = row && await ws(row.id).call('published');
      if (!pub) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      const html = renderSite(pub.profile, { logoSrc: pub.hasLogo ? `/s/${slug}/logo` : null, heroSrc: pub.hasHero ? `/s/${slug}/hero` : null, workflows: pub.workflows });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': SITE_CSP, 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'public, max-age=60' } });
    }],
    ['GET', /^\/s\/([a-z0-9-]{1,40})\/(logo|hero)$/, 'public', async ({ params: [slug, which] }) => {
      const row = await db.get("SELECT id FROM clients WHERE slug = ? AND status = 'live'", slug);
      const logo = row && await ws(row.id).call('asset', which);
      if (!logo) return new Response('Not found', { status: 404 });
      return new Response(Uint8Array.from(atob(logo.data), (c) => c.charCodeAt(0)), { headers: { 'Content-Type': logo.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=300' } });
    }],

    // ---------- staff: onboarding & oversight (never key values) ----------
    ['POST', /^\/api\/clients$/, P.CLIENTS_MANAGE, async ({ req, user }) => {
      const b = await readJson(req);
      const business = String(b.business ?? '').trim().slice(0, 120);
      const workflows = [...new Set((b.workflows ?? []).filter((w) => WORKFLOW_DEFS[w]))];
      if (!business) fail(400, 'Business name is required');
      if (!workflows.length) fail(400, 'Choose at least one service');
      const id = randomId();
      let slug = slugify(business);
      for (let i = 2; await db.get('SELECT 1 AS ok FROM clients WHERE slug = ?', slug); i++) slug = `${slugify(business).slice(0, 36)}-${i}`;
      await ws(id).call('init', { clientId: id, business, slug, workflows });
      const { token } = await ws(id).call('createInvite');
      await db.run('INSERT INTO clients (id, slug, business, lead_id, quote_id, workflows, created_by) VALUES (?,?,?,?,?,?,?)',
        id, slug, business, b.lead_id ? Number(b.lead_id) : null, b.quote_id ? Number(b.quote_id) : null, JSON.stringify(workflows), user.id);
      return { id, slug, inviteUrl: inviteUrl(req, id, token) };
    }],
    ['GET', /^\/api\/clients$/, P.CLIENTS_MANAGE, () => db.all(`SELECT c.id, c.slug, c.business, c.lead_id, c.workflows, c.status, c.created_at, u.name AS created_by
      FROM clients c LEFT JOIN users u ON u.id = c.created_by ORDER BY c.created_at DESC LIMIT 200`)],
    ['GET', /^\/api\/clients\/([0-9a-f]{32})$/, P.CLIENTS_MANAGE, async ({ params: [id] }) => {
      const row = await clientRow(id);
      if (row.status === 'deleted') return { ...row, summary: null };
      return { ...row, summary: await ws(id).call('staffSummary') };
    }],
    ['POST', /^\/api\/clients\/([0-9a-f]{32})\/invite$/, P.CLIENTS_MANAGE, async ({ req, params: [id] }) => {
      const row = await clientRow(id);
      if (row.status === 'deleted') fail(400, 'This client deleted their workspace');
      const { token } = await ws(id).call('createInvite');
      return { inviteUrl: inviteUrl(req, id, token) };
    }],
    ['POST', /^\/api\/clients\/([0-9a-f]{32})\/scan$/, P.CLIENTS_MANAGE, async ({ params: [id] }) => {
      await clientRow(id);
      const r = await ws(id).call('runSecurityScan', 'Bizzle team');
      if (!r.ok) fail(400, r.errors.join(' · '));
      return r;
    }],
    ['GET', /^\/api\/clients\/([0-9a-f]{32})\/runbook\.md$/, P.CLIENTS_MANAGE, async ({ params: [id] }) => {
      const row = await clientRow(id);
      const s = row.status === 'deleted' ? null : await ws(id).call('staffSummary');
      const md = buildRunbook(JSON.parse(row.workflows), s && { clientRef: id.slice(0, 8), provided: Object.keys(s.draft ?? {}), secrets: s.secrets.filter((x) => x.set).map((x) => x.name) });
      return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="runbook-${row.slug}.md"`, 'Cache-Control': 'no-store' } });
    }],
  ];
}
