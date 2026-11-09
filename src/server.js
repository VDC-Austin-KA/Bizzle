import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, normalizeLead, insertLead, rowToLead, STAGES } from './db.js';
import { createUser, verifyPassword, createSession, userForToken, destroySession, throttled, recordFailure } from './auth.js';
import { PERMISSIONS as P, ROLES, can } from './rbac.js';
import { scoreLead, strategyFor, SEGMENTS, CITY_COUNTY } from './scoring.js';
import { PLAYBOOKS } from './playbooks.js';
import { parseCsv } from './csv.js';
import { placesEnabled, searchPlaces } from './sources/places.js';

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

const enrich = (row) => { const lead = rowToLead(row); return { ...lead, ...scoreLead(lead) }; };

export function createApp(db) {
  const allLeads = () => db.prepare('SELECT * FROM leads').all().map(enrich);
  const getLead = (id) => { const r = db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(id)); return r ? enrich(r) : fail(404, 'Lead not found'); };
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
      stages: STAGES, segments: SEGMENTS, cities: Object.keys(CITY_COUNTY).sort(),
      industries: Object.fromEntries(Object.entries(PLAYBOOKS).map(([k, v]) => [k, v.label])),
      placesEnabled: placesEnabled(),
    })],

    // Lead Finder zone
    ['GET', /^\/api\/leads$/, P.LEADS_READ, ({ url, user }) => {
      const q = url.searchParams;
      const text = q.get('q')?.toLowerCase();
      const min = Number(q.get('minScore') ?? 0);
      return allLeads().filter((l) =>
        (!q.get('segment') || l.segments.includes(q.get('segment'))) &&
        (!q.get('city') || l.city === q.get('city')) &&
        (!q.get('industry') || l.industry === q.get('industry')) &&
        (!q.get('stage') || l.stage === q.get('stage')) &&
        (q.get('mine') !== '1' || l.assigned_to === user.id) &&
        l.score >= min &&
        (!text || l.name.toLowerCase().includes(text)),
      ).sort((a, b) => b.score - a.score);
    }],
    ['GET', /^\/api\/leads\/(\d+)$/, P.LEADS_READ, ({ params: [id], user }) => {
      const lead = getLead(id);
      const activities = db.prepare(`SELECT a.kind, a.body, a.created_at, u.name AS user FROM activities a
        LEFT JOIN users u ON u.id = a.user_id WHERE lead_id = ? ORDER BY a.id DESC`).all(lead.id);
      return { ...lead, activities, strategy: can(user, P.STRATEGY_READ) ? strategyFor(lead) : undefined };
    }],
    ['POST', /^\/api\/leads$/, P.LEADS_WRITE, async ({ req, user }) => {
      const { lead, error } = normalizeLead(await readJson(req));
      if (error) fail(400, error);
      const { lastInsertRowid } = insertLead(db, { source: 'manual', ...lead });
      logActivity(lastInsertRowid, user.id, 'created', 'Lead created');
      return getLead(lastInsertRowid);
    }],
    ['POST', /^\/api\/leads\/import$/, P.LEADS_WRITE, async ({ req }) => {
      const { csv } = await readJson(req);
      const rows = parseCsv(String(csv ?? ''));
      const errors = []; let imported = 0;
      db.exec('BEGIN');
      try {
        rows.forEach((r, i) => {
          const { lead, error } = normalizeLead({ source: 'csv', ...r });
          if (error) errors.push(`Row ${i + 2}: ${error}`);
          else imported += insertLead(db, lead).changes;
        });
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return { imported, skipped: rows.length - imported - errors.length, errors };
    }],
    ['POST', /^\/api\/discover$/, P.LEADS_WRITE, async ({ req }) => {
      if (!placesEnabled()) fail(501, 'Set GOOGLE_PLACES_API_KEY to enable live discovery');
      const { query, city, industry } = await readJson(req);
      if (!query || !CITY_COUNTY[city]) fail(400, 'query and a Central Texas city are required');
      let imported = 0;
      for (const p of await searchPlaces({ query: String(query).slice(0, 100), city })) {
        const { lead } = normalizeLead({ ...p, industry });
        if (lead) imported += insertLead(db, lead).changes;
      }
      return { imported };
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
      const leads = allLeads();
      const countBy = (fn) => leads.reduce((m, l) => { for (const k of [fn(l)].flat()) m[k] = (m[k] ?? 0) + 1; return m; }, {});
      const funnel = STAGES.map((s) => {
        const inStage = leads.filter((l) => l.stage === s);
        return { stage: s, count: inStage.length, value: inStage.reduce((t, l) => t + l.est_value, 0) };
      });
      return {
        total: leads.length,
        avgScore: leads.length ? Math.round(leads.reduce((t, l) => t + l.score, 0) / leads.length) : 0,
        byTier: countBy((l) => l.tier), bySegment: countBy((l) => l.segments),
        byCity: countBy((l) => l.city ?? 'Unknown'), byIndustry: countBy((l) => PLAYBOOKS[l.industry]?.label ?? 'Other'),
        funnel,
        topOpportunities: leads.filter((l) => !['won', 'lost'].includes(l.stage)).sort((a, b) => b.score - a.score).slice(0, 10)
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
      send(res, e.status ?? 500, { error: e instanceof HttpError ? e.message : 'Internal error' });
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
