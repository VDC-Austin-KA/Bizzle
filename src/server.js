import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, upsertLead, updateLead, rowToLead, STAGES } from './db.js';
import { createUser, verifyPassword, createSession, userForToken, destroySession, throttled, recordFailure } from './auth.js';
import { PERMISSIONS as P, ROLES, can } from './rbac.js';
import { scoreLead, strategyFor, SEGMENTS } from './scoring.js';
import { PLAYBOOKS } from './playbooks.js';
import { parseCsv } from './csv.js';
import { placesEnabled, searchPlaces } from './sources/places.js';
import { COUNTIES, fetchOutlets, fetchOutletStats } from './sources/comptroller.js';
import { enrichLead, needsEnrichment } from './enrich.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const MAX_BODY = 2_000_000;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

const cookie = (req, name) => (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('='))
  .find(([k]) => k === name)?.[1];

async function readJson(req) {
  // JSON-only bodies + SameSite=Strict cookie = CSRF protection for this API.
  if (!String(req.headers['content-type']).startsWith('application/json')) fail(415, 'Content-Type must be application/json');
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) fail(413, 'Body too large'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { fail(400, 'Invalid JSON'); }
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

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export function createApp(db, { fetchImpl } = {}) {
  const allLeads = () => db.prepare('SELECT * FROM leads').all().map(withScore);
  const getLead = (id) => { const r = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id)); return r ? withScore(r) : fail(404, 'Lead not found'); };
  const logActivity = (leadId, userId, kind, body) => db.prepare('INSERT INTO activities (lead_id, user_id, kind, body) VALUES (?,?,?,?)').run(leadId, userId, kind, body);

  // [method, path regex, permission | null (auth only) | 'public', handler]
  const routes = [
    ['POST', /^\/api\/login$/, 'public', async ({ req, res }) => {
      const ip = req.socket.remoteAddress;
      if (throttled(ip)) fail(429, 'Too many attempts, try again later');
      const { email, password } = await readJson(req);
      const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').toLowerCase().trim());
      if (!u || !verifyPassword(String(password ?? ''), u.password_hash)) { recordFailure(ip); fail(401, 'Invalid credentials'); }
      const token = createSession(db, u.id);
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
      return { id: u.id, name: u.name, role: u.role };
    }],
    ['POST', /^\/api\/logout$/, null, ({ req, res }) => {
      destroySession(db, cookie(req, 'sid'));
      res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return { ok: true };
    }],
    ['GET', /^\/api\/me$/, null, ({ user }) => ({ ...user, permissions: ROLES[user.role] })],
    ['GET', /^\/api\/meta$/, null, () => ({
      stages: STAGES, segments: SEGMENTS, counties: COUNTIES, placesEnabled: placesEnabled(),
      industries: Object.fromEntries(Object.entries(PLAYBOOKS).map(([k, v]) => [k, v.label])),
      cities: db.prepare('SELECT DISTINCT city FROM leads WHERE city IS NOT NULL ORDER BY city').all().map((r) => r.city),
    })],

    // Lead Finder zone
    ['GET', /^\/api\/leads$/, P.LEADS_READ, ({ url, user }) => {
      const q = url.searchParams;
      const text = q.get('q')?.toLowerCase();
      const min = Number(q.get('minScore') ?? 0);
      return allLeads().filter((l) =>
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
    ['GET', /^\/api\/leads\/(\d+)$/, P.LEADS_READ, ({ params: [id], user }) => {
      const lead = getLead(id);
      const activities = db.prepare(`SELECT a.kind, a.body, a.created_at, u.name AS user FROM activities a
        LEFT JOIN users u ON u.id = a.user_id WHERE lead_id = ? ORDER BY a.id DESC`).all(lead.id);
      return { ...lead, activities, strategy: can(user, P.STRATEGY_READ) ? strategyFor(lead) : undefined };
    }],
    ['POST', /^\/api\/leads$/, P.LEADS_WRITE, async ({ req, user }) => {
      const { lead, error } = manualLead(await readJson(req));
      if (error) fail(400, error);
      const { id, created } = upsertLead(db, { ...lead, source: 'manual' });
      logActivity(id, user.id, created ? 'created' : 'updated', created ? 'Lead added manually' : 'Merged manual entry');
      return getLead(id);
    }],
    ['POST', /^\/api\/leads\/import$/, P.LEADS_WRITE, async ({ req }) => {
      const rows = parseCsv(String((await readJson(req)).csv ?? ''));
      const errors = []; let created = 0, merged = 0;
      db.exec('BEGIN');
      try {
        rows.forEach((r, i) => {
          const { lead, error } = manualLead(r);
          if (error) return errors.push(`Row ${i + 2}: ${error}`);
          upsertLead(db, { ...lead, source: 'csv' }).created ? created++ : merged++;
        });
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return { created, merged, errors };
    }],

    // Discovery — real sources
    ['POST', /^\/api\/discover\/registry$/, P.LEADS_WRITE, async ({ req }) => {
      const { counties, industry, openedWithinYears, sort, includeSoleProprietors, limit } = await readJson(req);
      if (!PLAYBOOKS[industry]) fail(400, 'Choose an industry');
      if (counties != null && (!Array.isArray(counties) || counties.some((c) => !COUNTIES[c]))) fail(400, 'Unknown county');
      const outlets = await fetchOutlets({ counties, industry, openedWithinYears, sort, includeSoleProprietors: !!includeSoleProprietors, limit }, fetchImpl);
      const stats = await fetchOutletStats(outlets.map((o) => o.taxpayer_number), fetchImpl);
      let created = 0;
      db.exec('BEGIN');
      try { for (const o of outlets) created += upsertLead(db, { ...o, ...stats[o.taxpayer_number] }).created; db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
      return { found: outlets.length, created, updated: outlets.length - created };
    }],
    ['POST', /^\/api\/discover\/places$/, P.LEADS_WRITE, async ({ req }) => {
      if (!placesEnabled()) fail(501, 'Set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) to search Google');
      const { query, city, industry } = await readJson(req);
      if (!query || !city) fail(400, 'query and city are required');
      if (industry && !PLAYBOOKS[industry]) fail(400, 'Unknown industry');
      const found = await searchPlaces({ query: String(query).slice(0, 100), city: String(city).slice(0, 60) }, fetchImpl);
      let created = 0;
      for (const p of found) created += upsertLead(db, { ...p, industry }).created;
      return { found: found.length, created, updated: found.length - created };
    }],

    // Enrichment — anyone who can view a lead can refresh it; bulk runs need leads:write.
    ['POST', /^\/api\/leads\/(\d+)\/enrich$/, P.LEADS_READ, async ({ params: [id], user }) => {
      getLead(id);
      const { log } = await enrichLead(db, Number(id), { fetchImpl });
      logActivity(Number(id), user.id, 'enriched', log.join('\n'));
      return { log, lead: getLead(id) };
    }],
    ['POST', /^\/api\/enrich$/, P.LEADS_WRITE, async ({ req, user }) => {
      const { limit = 10, industry } = await readJson(req);
      const n = Math.min(Math.max(1, Number(limit) || 10), 50);
      const todo = allLeads().filter((l) => needsEnrichment(l) && (!industry || l.industry === industry))
        .sort((a, b) => b.score - a.score).slice(0, n);
      const results = await pool(todo, 4, async (l) => {
        const { log } = await enrichLead(db, l.id, { fetchImpl });
        logActivity(l.id, user.id, 'enriched', log.join('\n'));
        return { id: l.id, name: l.name, log };
      });
      return { enriched: results.length, results };
    }],

    // Pipeline zone
    ['PATCH', /^\/api\/leads\/(\d+)$/, P.PIPELINE_WRITE, async ({ req, params: [id], user }) => {
      const lead = getLead(id);
      // Non-owners can only work unassigned leads (auto-claimed) or their own.
      if (user.role !== 'owner' && lead.assigned_to && lead.assigned_to !== user.id) fail(403, 'Lead is assigned to another rep');
      const body = await readJson(req);
      const stage = body.stage ?? lead.stage;
      if (!STAGES.includes(stage)) fail(400, 'Invalid stage');
      const estValue = body.est_value != null ? Math.max(0, Math.round(Number(body.est_value)) || 0) : lead.est_value;
      let assigned = lead.assigned_to ?? user.id;
      if (user.role === 'owner' && body.assigned_to !== undefined) {
        assigned = body.assigned_to === null ? null : Number(body.assigned_to);
        if (assigned !== null && !db.prepare('SELECT 1 FROM users WHERE id = ?').get(assigned)) fail(400, 'Unknown user');
      }
      db.prepare('UPDATE leads SET stage = ?, est_value = ?, assigned_to = ? WHERE id = ?').run(stage, estValue, assigned, lead.id);
      if (stage !== lead.stage) logActivity(lead.id, user.id, 'stage', `${lead.stage} → ${stage}`);
      if (body.note) logActivity(lead.id, user.id, 'note', String(body.note).slice(0, 2000));
      return getLead(id);
    }],

    // Analytics zone
    ['GET', /^\/api\/analytics$/, P.ANALYTICS_READ, () => {
      const leads = allLeads().filter((l) => !l.segments.includes('closed'));
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
    ['GET', /^\/api\/users$/, P.ADMIN_USERS, () => db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY id').all()],
    ['POST', /^\/api\/users$/, P.ADMIN_USERS, async ({ req }) => {
      const b = await readJson(req);
      if (!ROLES[b.role]) fail(400, 'Invalid role');
      try { createUser(db, b); } catch (e) { fail(400, e.message.includes('UNIQUE') ? 'Email already exists' : e.message); }
      return { ok: true };
    }],
  ];

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) return await serveStatic(url.pathname, res);
      const route = routes.find(([m, re]) => m === req.method && re.test(url.pathname));
      if (!route) fail(404, 'Not found');
      const [, re, perm, fn] = route;
      const user = perm === 'public' ? null : userForToken(db, cookie(req, 'sid'));
      if (perm !== 'public' && !user) fail(401, 'Not signed in');
      if (perm && perm !== 'public' && !can(user, perm)) fail(403, 'Your role cannot access this zone');
      const result = await fn({ req, res, url, user, params: url.pathname.match(re).slice(1) });
      send(res, 200, result);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      send(res, e.status ?? 502, { error: e instanceof HttpError ? e.message : `Data source error: ${e.message}` });
    }
  };
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveStatic(pathname, res) {
  const rel = normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
  if (rel.startsWith('..')) fail(404, 'Not found');
  try {
    const data = await readFile(join(PUBLIC_DIR, rel));
    res.writeHead(200, {
      'Content-Type': MIME[extname(rel)] ?? 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    });
    res.end(data);
  } catch { fail(404, 'Not found'); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  if (!db.prepare('SELECT COUNT(*) AS n FROM users').get().n) console.warn('No users yet — run `npm run seed` first.');
  const port = Number(process.env.PORT ?? 3000);
  createServer(createApp(db)).listen(port, () => console.log(`Bizzle running at http://localhost:${port}`));
}
