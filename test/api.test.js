import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDb, normalizeLead, insertLead } from '../src/db.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/server.js';

let server, base;
before(async () => {
  const db = openDb(':memory:');
  for (const role of ['owner', 'analyst', 'sales']) createUser(db, { email: `${role}@t.test`, name: role, role, password: 'password-123' });
  createUser(db, { email: 'sales2@t.test', name: 'sales2', role: 'sales', password: 'password-123' });
  insertLead(db, normalizeLead({ name: 'Lead One', industry: 'dental', city: 'Austin', employees: 30 }).lead);
  server = createServer(createApp(db)).listen(0);
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
  assert.equal((await sales('/api/leads', { method: 'POST', body: { name: 'x' } })).status, 403);
  assert.equal((await analyst('/api/leads/1', { method: 'PATCH', body: { stage: 'contacted' } })).status, 403);
});

test('lead detail includes score and strategy for permitted roles', async () => {
  const sales = await login('sales');
  const lead = await (await sales('/api/leads/1')).json();
  assert.ok(lead.score > 0 && lead.strategy.pilot.length === 2);
});

test('sales claims unassigned lead; other reps are blocked', async () => {
  const sales = await login('sales'), sales2 = await login('sales2');
  const r = await sales('/api/leads/1', { method: 'PATCH', body: { stage: 'contacted', note: 'Called owner' } });
  assert.equal(r.status, 200);
  const lead = await r.json();
  assert.equal(lead.stage, 'contacted');
  assert.equal((await sales2('/api/leads/1', { method: 'PATCH', body: { stage: 'won' } })).status, 403);
  const detail = await (await sales('/api/leads/1')).json();
  assert.deepEqual(detail.activities.map((a) => a.kind), ['note', 'stage']);
});

test('analyst imports CSV with per-row validation', async () => {
  const analyst = await login('analyst');
  const csv = 'name,industry,city,employees,rating\nAcme Roofing,roofing_construction,Kyle,12,4.6\n,dental,Austin,5,4\nBad Rating,legal,Austin,3,9';
  const r = await (await analyst('/api/leads/import', { method: 'POST', body: { csv } })).json();
  assert.equal(r.imported, 1);
  assert.equal(r.errors.length, 2);
});

test('discover returns 501 without a Places key', async () => {
  const owner = await login('owner');
  assert.equal((await owner('/api/discover', { method: 'POST', body: { query: 'hvac', city: 'Austin' } })).status, 501);
});

test('non-JSON bodies are refused even with a valid session (CSRF guard)', async () => {
  const owner = await login('owner');
  assert.equal((await owner('/api/leads', { method: 'POST', body: 'name=x', type: 'text/plain' })).status, 415);
});

test('static files served; path traversal blocked', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);
});
