// API handler shared by Cloudflare Workers (src/worker.js) and the local Node server (src/server.js).
// Standard Request → Response, async DB (see db.js).
import { upsertLead, rowToLead, STAGES } from './db.js';
import { createUser, changePassword, verifyPassword, createSession, userForToken, destroySession, purgeExpiredSessions, throttled, recordFailure } from './auth.js';
import { PERMISSIONS as P, ROLES, can } from './rbac.js';
import { scoreLead, strategyFor, SEGMENTS } from './scoring.js';
import { PLAYBOOKS } from './playbooks.js';
import { parseCsv } from './csv.js';
import { placesEnabled, searchPlaces } from './sources/places.js';
import { COUNTIES, fetchOutlets, fetchOutletStats } from './sources/comptroller.js';
import { enrichLead, needsEnrichment } from './enrich.js';
import { buildOutreach, briefMarkdown } from './outreach.js';

const MAX_BODY = 2_000_000;
const MAX_REGISTRY_IMPORT = 200;
// Alpha mode (ALPHA_MODE=true): shared demo logins, one per access portal, shown as buttons on the sign-in page.
export const DEMO_PASSWORD = 'alpha2026!';
export const DEMO_ACCOUNTS = [
  { label: 'Owner (admin)', email: 'owner@bizzle.test', name: 'Demo Owner', role: 'owner' },
  { label: 'Analyst', email: 'analyst@bizzle.test', name: 'Demo Analyst', role: 'analyst' },
  { label: 'Sales rep', email: 'sales@bizzle.test', name: 'Demo Sales Rep', role: 'sales' },
];
export async function ensureDemoUsers(db) {
  for (const a of DEMO_ACCOUNTS) {
    if (!(await db.get('SELECT 1 AS ok FROM users WHERE email = ?', a.email))) await createUser(db, { ...a, password: DEMO_PASSWORD }).catch(() => {});
  }
}
// Daily cap on billable Google calls (protects the key while alpha logins are public). GOOGLE_DAILY_LIMIT overrides.
export async function takeGoogle(db, n) {
  const limit = Number(globalThis.process?.env?.GOOGLE_DAILY_LIMIT) || 300;
  const day = new Date().toISOString().slice(0, 10);
  const used = (await db.get('SELECT google_calls FROM usage WHERE day = ?', day))?.google_calls ?? 0;
  if (used + n > limit) return false;
  await db.run('INSERT INTO usage (day, google_calls) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET google_calls = google_calls + ?', day, n, n);
  return true;
}
const HOME = { owner: 'leads', analyst: 'leads', sales: 'pipeline' }; // landing zone per role // keeps one request well under Workers' per-request subrequest limits

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

const cookie = (req, name) => (req.headers.get('cookie') ?? '').split(';').map((c) => c.trim().split('='))
  .find(([k]) => k === name)?.[1];

async function readJson(req) {
  // JSON-only bodies + SameSite=Strict cookie = CSRF protection for this API.
  if (!String(req.headers.get('content-type')).startsWith('application/json')) fail(415, 'Content-Type must be application/json');
  const text = await req.text();
  if (text.length > MAX_BODY) fail(413, 'Body too large');
  try { return JSON.parse(text || '{}'); } catch { fail(400, 'Invalid JSON'); }
}

// Validate a manually entered / CSV lead. Only these fields are accepted from users.
export function manualLead(input) {
  const str = (v, max = 200) => (v == null ? undefined : String(v).trim().slice(0, max) || undefined);
  const lead = { name: str(input.name), address: str(input.address), city: str(input.city, 80), zip: str(input.zip, 10),
    phone: str(input.phone, 40), website: str(input.website, 300), industry: str(input.industry, 40) };
  if (!lead.name) return { error: 'name is required' };
  if (lead.industry && !PLAYBOOKS[lead.industry]) return { error: `unknown industry "${lead.industry}"` };
  if (lead.zip && !/^\d{5}$/.test(lead.zip)) return { error: 'zip must be 5 digits' };
  if (lead.website) {
    try { const u = new URL(/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`);
      if (!u.hostname.includes('.')) throw 0; lead.website = u.href; } catch { return { error: 'website is not a valid URL' }; }
  }
  return { lead };
}

const withScore = (row) => { const lead = rowToLead(row); return { ...lead, ...scoreLead(lead) }; };

export function createApp(db, { fetchImpl, secureCookies = false, alpha = false } = {}) {
  let demoReady = null;
  const demoUsers = () => (demoReady ??= ensureDemoUsers(db).catch((e) => { demoReady = null; throw e; }));
  const allLeads = async () => (await db.all('SELECT * FROM leads')).map(withScore);
  const getLead = async (id) => { const r = await db.get('SELECT * FROM leads WHERE id = ?', Number(id)); return r ? withScore(r) : fail(404, 'Lead not found'); };
  const logActivity = (leadId, userId, kind, body) => db.run('INSERT INTO activities (lead_id, user_id, kind, body) VALUES (?,?,?,?)', leadId, userId, kind, body);
  const sessionCookie = (value, maxAge) => `sid=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;

  // [method, path regex, permission | null (auth only) | 'public', handler]
  const routes = [
    ['GET', /^\/api\/auth\/config$/, 'public', async () => {
      if (!alpha) return { alpha: false };
      await demoUsers();
      return { alpha: true, password: DEMO_PASSWORD, accounts: DEMO_ACCOUNTS.map(({ label, email }) => ({ label, email })) };
    }],
    ['POST', /^\/api\/login$/, 'public', async ({ req, ip, headers }) => {
      if (throttled(ip)) fail(429, 'Too many attempts, try again later');
      if (alpha) await demoUsers();
      const { email, password } = await readJson(req);
      const u = await db.get('SELECT * FROM users WHERE email = ?', String(email ?? '').toLowerCase().trim());
      if (!u || !(await verifyPassword(String(password ?? ''), u.password_hash))) { recordFailure(ip); fail(401, 'Invalid credentials'); }
      await purgeExpiredSessions(db);
      headers.set('Set-Cookie', sessionCookie(await createSession(db, u.id), 43200));
      return { id: u.id, name: u.name, role: u.role, home: HOME[u.role] };
    }],
    ['POST', /^\/api\/logout$/, null, async ({ req, headers }) => {
      await destroySession(db, cookie(req, 'sid'));
      headers.set('Set-Cookie', sessionCookie('', 0));
      return { ok: true };
    }],
    ['GET', /^\/api\/me$/, null, ({ user }) => ({ ...user, permissions: ROLES[user.role] })],
    ['POST', /^\/api\/me\/password$/, null, async ({ req, user, headers }) => {
      const { current, next } = await readJson(req);
      if (alpha && DEMO_ACCOUNTS.some((d) => d.email === user.email)) fail(403, 'Demo accounts share a fixed password');
      try { await changePassword(db, user.id, current, next); } catch (e) { fail(400, e.message); }
      headers.set('Set-Cookie', sessionCookie(await createSession(db, user.id), 43200));
      return { ok: true };
    }],
    ['GET', /^\/api\/meta$/, null, async () => ({
      stages: STAGES, segments: SEGMENTS, counties: COUNTIES, placesEnabled: placesEnabled(), maxRegistryImport: MAX_REGISTRY_IMPORT,
      industries: Object.fromEntries(Object.entries(PLAYBOOKS).map(([k, v]) => [k, v.label])),
      cities: (await db.all('SELECT DISTINCT city FROM leads WHERE city IS NOT NULL ORDER BY city')).map((r) => r.city),
    })],

    // Lead Finder zone
    ['GET', /^\/api\/leads$/, P.LEADS_READ, async ({ url, user }) => {
      const q = url.searchParams;
      const text = q.get('q')?.toLowerCase();
      const min = Number(q.get('minScore') ?? 0);
      return (await allLeads()).filter((l) =>
        (q.get('segment') ? l.segments.includes(q.get('segment')) : !l.segments.includes('closed')) &&
        (!q.get('county') || l.county === q.get('county')) &&
        (!q.get('city') || l.city === q.get('city')) &&
        (!q.get('industry') || l.industry === q.get('industry')) &&
        (!q.get('stage') || l.stage === q.get('stage')) &&
        (q.get('enriched') !== '1' || l.places_checked_at) &&
        (q.get('mine') !== '1' || l.assigned_to === user.id) &&
        l.score >= min &&
        (!text || `${l.name} ${l.legal_name ?? ''} ${l.address ?? ''}`.toLowerCase().includes(text)),
      ).sort((a, b) => b.score - a.score).slice(0, Number(q.get('limit')) || 500);
    }],
    ['GET', /^\/api\/leads\/(\d+)$/, P.LEADS_READ, async ({ params: [id], user }) => {
      const lead = await getLead(id);
      const activities = await db.all(`SELECT a.kind, a.body, a.created_at, u.name AS user FROM activities a
        LEFT JOIN users u ON u.id = a.user_id WHERE lead_id = ? ORDER BY a.id DESC`, lead.id);
      const strategy = can(user, P.STRATEGY_READ) ? strategyFor(lead) : undefined;
      return { ...lead, activities, strategy: strategy && { ...strategy, outreach: buildOutreach(lead, strategy) } };
    }],
    ['GET', /^\/api\/leads\/(\d+)\/brief\.md$/, P.STRATEGY_READ, async ({ params: [id] }) => {
      const lead = await getLead(id);
      const md = briefMarkdown(buildOutreach(lead, strategyFor(lead)));
      const file = `brief-${lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.md`;
      return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'no-store' } });
    }],
    ['POST', /^\/api\/leads$/, P.LEADS_WRITE, async ({ req, user }) => {
      const { lead, error } = manualLead(await readJson(req));
      if (error) fail(400, error);
      const { id, created } = await upsertLead(db, { ...lead, source: 'manual' });
      await logActivity(id, user.id, created ? 'created' : 'updated', created ? 'Lead added manually' : 'Merged manual entry');
      return getLead(id);
    }],
    ['POST', /^\/api\/leads\/import$/, P.LEADS_WRITE, async ({ req }) => {
      const rows = parseCsv(String((await readJson(req)).csv ?? ''));
      if (rows.length > 300) fail(400, 'Import at most 300 rows at a time');
      const errors = []; let created = 0, merged = 0;
      for (const [i, r] of rows.entries()) {
        const { lead, error } = manualLead(r);
        if (error) { errors.push(`Row ${i + 2}: ${error}`); continue; }
        (await upsertLead(db, { ...lead, source: 'csv' })).created ? created++ : merged++;
      }
      return { created, merged, errors };
    }],

    // Discovery — real sources
    ['POST', /^\/api\/discover\/registry$/, P.LEADS_WRITE, async ({ req }) => {
      const { counties, industry, openedWithinYears, sort, includeSoleProprietors, limit } = await readJson(req);
      if (!PLAYBOOKS[industry]) fail(400, 'Choose an industry');
      if (counties != null && (!Array.isArray(counties) || counties.some((c) => !COUNTIES[c]))) fail(400, 'Unknown county');
      const outlets = await fetchOutlets({ counties, industry, openedWithinYears, sort, includeSoleProprietors: !!includeSoleProprietors,
        limit: Math.min(Number(limit) || 50, MAX_REGISTRY_IMPORT) }, fetchImpl);
      const stats = await fetchOutletStats(outlets.map((o) => o.taxpayer_number), fetchImpl);
      let created = 0;
      for (const o of outlets) created += (await upsertLead(db, { ...o, ...stats[o.taxpayer_number] })).created;
      return { found: outlets.length, created, updated: outlets.length - created };
    }],
    ['POST', /^\/api\/discover\/places$/, P.LEADS_WRITE, async ({ req }) => {
      if (!placesEnabled()) fail(501, 'Set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) to search Google');
      const { query, city, industry } = await readJson(req);
      if (!query || !city) fail(400, 'query and city are required');
      if (industry && !PLAYBOOKS[industry]) fail(400, 'Unknown industry');
      if (!(await takeGoogle(db, 1))) fail(429, 'Daily Google search limit reached — try again tomorrow');
      const found = await searchPlaces({ query: String(query).slice(0, 100), city: String(city).slice(0, 60) }, fetchImpl);
      let created = 0;
      for (const p of found) created += (await upsertLead(db, { ...p, industry })).created;
      return { found: found.length, created, updated: found.length - created };
    }],

    // Enrichment — one lead per request (bounded outbound calls); the UI works through the queue.
    ['POST', /^\/api\/leads\/(\d+)\/enrich$/, P.LEADS_READ, async ({ params: [id], user }) => {
      await getLead(id);
      const { log } = await enrichLead(db, Number(id), { fetchImpl, googleBudget: (n) => takeGoogle(db, n) });
      await logActivity(Number(id), user.id, 'enriched', log.join('\n'));
      return { log, lead: await getLead(id) };
    }],
    ['GET', /^\/api\/enrich\/queue$/, P.LEADS_WRITE, async ({ url }) => {
      const n = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 10), 100);
      const industry = url.searchParams.get('industry');
      return (await allLeads()).filter((l) => needsEnrichment(l) && (!industry || l.industry === industry))
        .sort((a, b) => b.score - a.score).slice(0, n).map(({ id, name }) => ({ id, name }));
    }],

    // Pipeline zone
    ['PATCH', /^\/api\/leads\/(\d+)$/, P.PIPELINE_WRITE, async ({ req, params: [id], user }) => {
      const lead = await getLead(id);
      // Non-owners can only work unassigned leads (auto-claimed) or their own.
      if (user.role !== 'owner' && lead.assigned_to && lead.assigned_to !== user.id) fail(403, 'Lead is assigned to another rep');
      const body = await readJson(req);
      const stage = body.stage ?? lead.stage;
      if (!STAGES.includes(stage)) fail(400, 'Invalid stage');
      const estValue = body.est_value != null ? Math.max(0, Math.round(Number(body.est_value)) || 0) : lead.est_value;
      let assigned = lead.assigned_to ?? user.id;
      if (user.role === 'owner' && body.assigned_to !== undefined) {
        assigned = body.assigned_to === null ? null : Number(body.assigned_to);
        if (assigned !== null && !(await db.get('SELECT 1 AS ok FROM users WHERE id = ?', assigned))) fail(400, 'Unknown user');
      }
      await db.run('UPDATE leads SET stage = ?, est_value = ?, assigned_to = ? WHERE id = ?', stage, estValue, assigned, lead.id);
      if (stage !== lead.stage) await logActivity(lead.id, user.id, 'stage', `${lead.stage} → ${stage}`);
      if (body.note) await logActivity(lead.id, user.id, 'note', String(body.note).slice(0, 2000));
      return getLead(id);
    }],

    // Analytics zone
    ['GET', /^\/api\/analytics$/, P.ANALYTICS_READ, async () => {
      const leads = (await allLeads()).filter((l) => !l.segments.includes('closed'));
      const countBy = (fn) => leads.reduce((m, l) => { for (const k of [fn(l)].flat()) m[k] = (m[k] ?? 0) + 1; return m; }, {});
      const funnel = STAGES.map((s) => {
        const inStage = leads.filter((l) => l.stage === s);
        return { stage: s, count: inStage.length, value: inStage.reduce((t, l) => t + l.est_value, 0) };
      });
      return {
        total: leads.length,
        enriched: leads.filter((l) => l.places_checked_at || l.web_checked_at).length,
        avgScore: leads.length ? Math.round(leads.reduce((t, l) => t + l.score, 0) / leads.length) : 0,
        byTier: countBy((l) => l.tier), bySegment: countBy((l) => l.segments),
        byCounty: countBy((l) => l.county ?? 'Unknown'), byIndustry: countBy((l) => PLAYBOOKS[l.industry]?.label ?? 'Other'),
        gaps: countBy((l) => (l.web_signals?.reachable ? ['booking', 'chat', 'reviews'].filter((g) => !l.web_signals[g].length).map((g) => `No ${g}`) : [])),
        funnel,
        topOpportunities: leads.filter((l) => !['won', 'lost'].includes(l.stage) && l.coverage >= 60).sort((a, b) => b.score - a.score).slice(0, 10)
          .map(({ id, name, city, score, tier, segments }) => ({ id, name, city, score, tier, segments })),
      };
    }],

    // Admin zone
    ['GET', /^\/api\/users$/, P.ADMIN_USERS, () => db.all('SELECT id, email, name, role, created_at FROM users ORDER BY id')],
    ['POST', /^\/api\/users$/, P.ADMIN_USERS, async ({ req }) => {
      const b = await readJson(req);
      if (!ROLES[b.role]) fail(400, 'Invalid role');
      try { await createUser(db, b); } catch (e) { fail(400, /UNIQUE/i.test(e.message) ? 'Email already exists' : e.message); }
      return { ok: true };
    }],
  ];

  return async function handle(req, { ip = 'unknown' } = {}) {
    const url = new URL(req.url);
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    try {
      const route = routes.find(([m, re]) => m === req.method && re.test(url.pathname));
      if (!route) fail(404, 'Not found');
      const [, re, perm, fn] = route;
      const user = perm === 'public' ? null : await userForToken(db, cookie(req, 'sid'));
      if (perm !== 'public' && !user) fail(401, 'Not signed in');
      if (perm && perm !== 'public' && !can(user, perm)) fail(403, 'Your role cannot access this zone');
      const result = await fn({ req, url, user, ip, headers, params: url.pathname.match(re).slice(1) });
      if (result instanceof Response) return result;
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      return new Response(JSON.stringify({ error: e instanceof HttpError ? e.message : `Data source error: ${e.message}` }), { status: e.status ?? 502, headers });
    }
  };
}
