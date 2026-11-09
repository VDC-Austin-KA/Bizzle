import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { upsertLead } from '../src/db.js';
import { openDb } from '../src/db-node.js';
import { createUser } from '../src/auth.js';
import { createApp, manualLead } from '../src/app.js';
import { nodeHandler } from '../src/server.js';

delete process.env.GOOGLE_PLACES_API_KEY; delete process.env.GOOGLE_MAPS_API_KEY;

// Fake data.texas.gov: one registry outlet, then the outlet-count queries.
const outlet = { taxpayer_number: '32012345678', taxpayer_name: 'HAMBONE PLUMBING LLC', taxpayer_organization_type: 'CL', taxpayer_city: 'GEORGETOWN',
  taxpayer_state: 'TX', taxpayer_county_code: '246', outlet_number: '1', outlet_name: 'HAMBONE PLUMBING', outlet_address: '818 W 2ND ST',
  outlet_city: 'TAYLOR', outlet_zip_code: '76574', outlet_county_code: '246', outlet_naics_code: '238220', outlet_first_sales_date: '2019-03-01T00:00:00.000' };
const seenUrls = [];
const fetchImpl = async (url) => {
  seenUrls.push(String(url));
  const u = new URL(url);
  const body = u.pathname.includes('9cir-efmm') ? [{ taxpayer_number: outlet.taxpayer_number, sos_charter_date: '2019-10-22T00:00:00.000' }]
    : u.searchParams.get('$select') ? [{ taxpayer_number: outlet.taxpayer_number, n: '2' }] : [outlet];
  return { ok: true, json: async () => body };
};

let server, base;
before(async () => {
  const db = openDb(':memory:');
  for (const role of ['owner', 'analyst', 'sales']) await createUser(db, { email: `${role}@t.test`, name: role, role, password: 'password-123' });
  await createUser(db, { email: 'sales2@t.test', name: 'sales2', role: 'sales', password: 'password-123' });
  await upsertLead(db, { name: 'Lead One', industry: 'dental', city: 'Austin', source: 'manual' });
  server = createServer(nodeHandler(createApp(db, { fetchImpl }))).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function login(role) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${role}@t.test`, password: 'password-123' }) });
  assert.equal(r.status, 200);
  const sid = r.headers.get('set-cookie').match(/sid=([^;]+)/)[1];
  return (path, { method = 'GET', body, type = 'application/json' } = {}) => fetch(`${base}${path}`, {
    method, headers: { cookie: `sid=${sid}`, 'Content-Type': type }, body: body && (typeof body === 'string' ? body : JSON.stringify(body)) });
}

test('unauthenticated API calls are rejected', async () => {
  assert.equal((await fetch(`${base}/api/leads`)).status, 401);
});

test('bad password is rejected', async () => {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"owner@t.test","password":"nope"}' });
  assert.equal(r.status, 401);
});

test('zones are enforced per role', async () => {
  const owner = await login('owner'), analyst = await login('analyst'), sales = await login('sales');
  assert.equal((await owner('/api/users')).status, 200);
  assert.equal((await analyst('/api/users')).status, 403);
  assert.equal((await analyst('/api/analytics')).status, 200);
  assert.equal((await sales('/api/analytics')).status, 403);
  assert.equal((await sales('/api/discover/registry', { method: 'POST', body: { industry: 'dental' } })).status, 403);
  assert.equal((await analyst('/api/leads/1', { method: 'PATCH', body: { stage: 'contacted' } })).status, 403);
});

test('registry discovery imports real-shaped outlets with outlet counts, and re-import merges', async () => {
  const analyst = await login('analyst');
  const r = await (await analyst('/api/discover/registry', { method: 'POST', body: { counties: ['246'], industry: 'hvac_plumbing', openedWithinYears: 3 } })).json();
  assert.deepEqual(r, { found: 1, created: 1, updated: 0 });
  const where = new URL(seenUrls[0]).searchParams.get('$where');
  assert.match(where, /outlet_county_code in\('246'\)/);
  assert.match(where, /outlet_naics_code between 238210 and 238229/);
  assert.match(where, /taxpayer_organization_type != 'IS'/);
  const again = await (await analyst('/api/discover/registry', { method: 'POST', body: { counties: ['246'], industry: 'hvac_plumbing' } })).json();
  assert.deepEqual(again, { found: 1, created: 0, updated: 1 });
  const [lead] = await (await analyst('/api/leads?q=hambone')).json();
  assert.equal(lead.outlets_total, 2);
  assert.equal(lead.entity_formed_date, '2019-10-22');
  assert.ok(lead.segments.includes('anchor') === false); // 2 outlets, < 10 yrs → not an anchor
});

test('discovery inputs are whitelisted', async () => {
  const owner = await login('owner');
  assert.equal((await owner('/api/discover/registry', { method: 'POST', body: { industry: "x' OR 1=1" } })).status, 400);
  assert.equal((await owner('/api/discover/registry', { method: 'POST', body: { industry: 'dental', counties: ["227') OR ('1'='1"] } })).status, 400);
});

test('Google discovery returns 501 without a key', async () => {
  const owner = await login('owner');
  assert.equal((await owner('/api/discover/places', { method: 'POST', body: { query: 'dentist', city: 'Austin' } })).status, 501);
});

test('lead detail includes evidence-based strategy for permitted roles', async () => {
  const sales = await login('sales');
  const lead = await (await sales('/api/leads/1')).json();
  assert.ok(Array.isArray(lead.strategy.recommended) && lead.coverage >= 0);
});

test('sales claims unassigned lead; other reps are blocked', async () => {
  const sales = await login('sales'), sales2 = await login('sales2');
  const r = await sales('/api/leads/1', { method: 'PATCH', body: { stage: 'contacted', note: 'Called owner' } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).stage, 'contacted');
  assert.equal((await sales2('/api/leads/1', { method: 'PATCH', body: { stage: 'won' } })).status, 403);
  const detail = await (await sales('/api/leads/1')).json();
  assert.deepEqual(detail.activities.map((a) => a.kind), ['note', 'stage']);
});

test('CSV import validates rows', async () => {
  const analyst = await login('analyst');
  const csv = 'name,address,city,zip,website,industry\nAcme Roofing,1 Main St,Kyle,78640,acmeroof.com,roofing_construction\n,x,Austin,,,\nBad,1 A St,Austin,7,,\nBad2,,,,,unknown_ind';
  const r = await (await analyst('/api/leads/import', { method: 'POST', body: { csv } })).json();
  assert.equal(r.created, 1);
  assert.equal(r.errors.length, 3);
});

test('manual lead validation', () => {
  assert.ok(manualLead({}).error);
  assert.ok(manualLead({ name: 'X', website: 'javascript:alert(1)' }).error);
  assert.equal(manualLead({ name: ' X ', website: 'acme.com' }).lead.website, 'https://acme.com/');
});

test('enrichment queue + password change', async () => {
  const owner = await login('owner');
  const q = await (await owner('/api/enrich/queue?limit=5')).json();
  assert.ok(Array.isArray(q));
  assert.equal((await owner('/api/me/password', { method: 'POST', body: { current: 'wrong-password', next: 'new-password-123' } })).status, 400);
  assert.equal((await owner('/api/me/password', { method: 'POST', body: { current: 'password-123', next: 'short' } })).status, 400);
  const sales = await login('sales');
  assert.equal((await sales('/api/enrich/queue')).status, 403);
});

test('alpha mode: demo accounts per portal, hidden when off', async () => {
  const off = await (await fetch(`${base}/api/auth/config`)).json();
  assert.deepEqual(off, { alpha: false });
  const db = openDb(':memory:');
  const alphaServer = createServer(nodeHandler(createApp(db, { alpha: true }))).listen(0);
  const ab = `http://localhost:${alphaServer.address().port}`;
  try {
    const cfg = await (await fetch(`${ab}/api/auth/config`)).json();
    assert.equal(cfg.alpha, true);
    assert.deepEqual(cfg.accounts.map((a) => a.label), ['Owner (admin)', 'Analyst', 'Sales rep']);
    for (const [email, home] of [['owner@bizzle.test', 'leads'], ['sales@bizzle.test', 'pipeline']]) {
      const r = await fetch(`${ab}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: cfg.password }) });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).home, home);
    }
  } finally { alphaServer.close(); }
});

test('non-JSON bodies are refused even with a valid session (CSRF guard)', async () => {
  const owner = await login('owner');
  assert.equal((await owner('/api/leads', { method: 'POST', body: 'name=x', type: 'text/plain' })).status, 415);
});

test('static files served; path traversal blocked', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);
});
