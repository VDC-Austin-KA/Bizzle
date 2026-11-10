import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db-node.js';
import { createUser } from '../src/auth.js';
import { createApp } from '../src/app.js';
import { nodeWorkspaces } from '../src/workspace-node.js';
import { nodeHandler } from '../src/server.js';
import { WorkspaceStore, sniffImage } from '../src/workspace.js';
import { buildRunbook } from '../src/runbook.js';
import { renderSite } from '../public/site-template.js';

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const SECRET = 'fake-test-key-value-not-a-real-credential-123';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pngB64 = btoa(String.fromCharCode(...PNG));

// A recording fake for outbound calls (vendor tests, security scan) — nothing leaves the test.
const outbound = [];
const fakeFetch = async (url, opts = {}) => {
  outbound.push({ url: String(url), auth: opts.headers?.Authorization });
  const u = new URL(url);
  if (u.hostname === 'connect.squareup.com') return { ok: opts.headers.Authorization === `Bearer ${SECRET}`, status: 401 };
  if (u.hostname === 'cloudflare-dns.com') return { ok: true, json: async () => ({ Answer: u.searchParams.get('type') === 'MX' ? [{ data: '10 mx.example.com' }] : [{ data: '"v=spf1 include:_spf.example.com ~all"' }] }) };
  return { ok: true, status: 200, headers: new Headers({ 'strict-transport-security': 'max-age=1' }), text: async () => '' };
};

test('vault: encrypted at rest, write-only, only allowed names, decrypted only for a read-only vendor test', async () => {
  const raw = new DatabaseSync(':memory:');
  const exec = (sql, ...p) => { const st = raw.prepare(sql); return /^\s*SELECT/i.test(sql) ? st.all(...p) : (st.run(...p), []); };
  const ws = new WorkspaceStore(exec, { masterKey: KEY, fetchImpl: fakeFetch });
  ws.init({ clientId: 'a'.repeat(32), business: 'Acme', slug: 'acme', workflows: ['booking'] });
  await ws.putSecret('SQUARE_ACCESS_TOKEN', SECRET);
  const stored = JSON.stringify(raw.prepare('SELECT * FROM secrets').all());
  assert.ok(!stored.includes(SECRET), 'plaintext must not be stored');
  assert.ok(!JSON.stringify(ws.state()).includes(SECRET));
  assert.ok(!JSON.stringify(ws.staffSummary()).includes(SECRET));
  assert.ok(!JSON.stringify(ws.exportData()).includes(SECRET));
  await assert.rejects(ws.putSecret('TWILIO_AUTH_TOKEN', 'x'), /not needed/); // not one of this client's services
  await assert.rejects(ws.putSecret('ANYTHING_ELSE', 'x'), /not needed/);
  const r = await ws.verifySecret('SQUARE_ACCESS_TOKEN');
  assert.equal(r.ok, true);
  assert.deepEqual(outbound.filter((o) => o.auth?.includes(SECRET)).map((o) => new URL(o.url).hostname), ['connect.squareup.com']); // sent only to the vendor
  assert.ok(ws.state().audit.some((a) => /read-only connection test/.test(a.action)), 'every use is logged');
  // a different client's key cannot decrypt this ciphertext
  const other = new WorkspaceStore(exec, { masterKey: KEY });
  other.setMeta({ client_id: 'b'.repeat(32) });
  await assert.rejects(other.decrypt('SQUARE_ACCESS_TOKEN'));
});

test('logo uploads are checked by content', () => {
  assert.equal(sniffImage(PNG), 'image/png');
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);
});

test('published site escapes client input and contains no scripts', () => {
  const html = renderSite({ 'business.name': '<script>alert(1)</script>', 'business.tagline': '"><img src=x onerror=alert(1)>', 'brand.palette': 'red;}</style><script>', 'links.booking': 'javascript:alert(1)' });
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('#f6f1e9')); // invalid palette fell back to the default (Atelier / Ivory)
});

test('runbooks contain placeholders only — never client values', () => {
  const md = buildRunbook(['booking', 'textback'], { clientRef: 'abcd1234', provided: ['business.name'], secrets: ['SQUARE_ACCESS_TOKEN'] });
  assert.ok(md.includes('{{secret:SQUARE_ACCESS_TOKEN}}'));
  assert.ok(md.includes('{{business.phone}}'));
  assert.ok(md.includes('Never ask for, guess, print or store'));
});

test('client-facing code never talks to AI services', () => {
  const files = ['src/workspace.js', 'src/workspace-node.js', 'src/workspace-do.js', 'src/portal.js', 'src/vault-verify.js', 'src/security-scan.js', 'src/runbook.js',
    'public/portal.js', 'public/site-template.js', 'public/workflows.js'];
  const AI = /anthropic|openai|api\.mistral|generativelanguage|cohere\.ai|huggingface|replicate\.com|together\.xyz|groq\.com|x\.ai\b|openrouter/i;
  for (const f of files) assert.ok(!AI.test(readFileSync(f, 'utf8')), `${f} references an AI service`);
  const all = readdirSync('src', { recursive: true }).filter((f) => f.endsWith('.js'));
  assert.ok(all.length > 10 && all.every((f) => !AI.test(readFileSync(`src/${f}`, 'utf8'))), 'no AI service anywhere in the server');
});

// ---------- end-to-end through the HTTP API ----------
let server, base;
before(async () => {
  const db = openDb(':memory:');
  await createUser(db, { email: 'sales@t.test', name: 'Sales', role: 'sales', password: 'password-123' });
  await createUser(db, { email: 'analyst@t.test', name: 'Analyst', role: 'analyst', password: 'password-123' });
  server = createServer(nodeHandler(createApp(db, { fetchImpl: fakeFetch, workspaces: nodeWorkspaces({ dir: ':memory:', masterKey: KEY, fetchImpl: fakeFetch }) }))).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

function agent() {
  let jar = '';
  const call = async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(`${base}${path}`, { method: body ? 'POST' : method, headers: { cookie: jar, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) jar = sc.split(';')[0];
    return r;
  };
  return call;
}

test('onboard → invite → client sets up, launches and edits → staff never see keys → client deletes', async () => {
  const staff = agent(), analyst = agent(), client = agent(), stranger = agent();
  await staff('/api/login', { body: { email: 'sales@t.test', password: 'password-123' } });
  await analyst('/api/login', { body: { email: 'analyst@t.test', password: 'password-123' } });
  assert.equal((await analyst('/api/clients')).status, 403);
  const created = await (await staff('/api/clients', { body: { business: "Pat's Plumbing", workflows: ['booking', 'website', 'bogus'] } })).json();
  assert.equal(created.slug, 'pats-plumbing');
  const invite = created.inviteUrl.split('#invite=')[1];

  assert.equal((await stranger('/api/portal/state')).status, 401);
  assert.equal((await stranger('/api/portal/accept', { body: { invite: invite.replace(/.$/, '0'), email: 'p@x.com', password: 'longpassword1' } })).status, 400);
  assert.equal((await client('/api/portal/accept', { body: { invite, email: 'pat@example.com', password: 'longpassword1' } })).status, 200);
  assert.equal((await stranger('/api/portal/accept', { body: { invite, email: 'evil@x.com', password: 'longpassword1' } })).status, 400); // one use

  let state = await (await client('/api/portal/state')).json();
  assert.deepEqual(state.workflows, ['booking', 'website']);
  const profile = { 'business.name': "Pat's Plumbing", 'business.phone': '512-555-0100', 'business.city': 'Kyle', 'business.services': 'Repairs\nWater heaters',
    'brand.template': 'midnight', 'brand.palette': 'gold', 'links.booking': 'https://book.example.com/pat', 'links.website': 'https://pats.example.com' };
  const bad = await client('/api/portal/profile', { body: { profile: { ...profile, 'links.booking': 'javascript:alert(1)' }, publish: true } });
  assert.equal(bad.status, 400);
  assert.equal((await client('/api/portal/asset', { body: { name: 'logo', data: btoa('<svg/>') } })).status, 400);
  assert.equal((await client('/api/portal/asset', { body: { name: 'logo', data: pngB64 } })).status, 200);
  assert.equal((await client('/api/portal/secrets', { body: { name: 'SQUARE_ACCESS_TOKEN', value: SECRET } })).status, 200);
  const launched = await (await client('/api/portal/profile', { body: { profile, publish: true } })).json();
  assert.equal(launched.first, true);

  const site = await fetch(`${base}/s/pats-plumbing`);
  assert.equal(site.status, 200);
  assert.match(site.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await site.text();
  assert.ok(html.includes('Pat&#39;s Plumbing') && html.includes('#d4b26a') && html.includes('/s/pats-plumbing/logo'));
  assert.equal((await fetch(`${base}/s/pats-plumbing/logo`)).headers.get('content-type'), 'image/png');
  await client('/api/portal/profile', { body: { profile: { ...profile, 'business.tagline': 'Now open Sundays' }, publish: true } });
  assert.ok((await (await fetch(`${base}/s/pats-plumbing`)).text()).includes('Now open Sundays'), 'client edits update the live site');

  // Staff see progress and which keys exist — never values
  const summary = await (await staff(`/api/clients/${created.id}`)).text();
  assert.ok(!summary.includes(SECRET));
  assert.ok(JSON.parse(summary).summary.secrets.find((k) => k.name === 'SQUARE_ACCESS_TOKEN').set);
  assert.ok(JSON.parse(summary).summary.report, 'first launch ran the security check');
  const runbook = await (await staff(`/api/clients/${created.id}/runbook.md`)).text();
  for (const v of [SECRET, '512-555-0100', 'book.example.com']) assert.ok(!runbook.includes(v), `runbook leaked ${v}`);
  const exported = await (await client('/api/portal/export')).text();
  assert.ok(!exported.includes(SECRET) && exported.includes('512-555-0100'));

  // the client deletes everything
  assert.equal((await client('/api/portal/delete', { body: { confirm: 'wrong' } })).status, 400);
  assert.equal((await client('/api/portal/delete', { body: { confirm: "Pat's Plumbing" } })).status, 200);
  assert.equal((await fetch(`${base}/s/pats-plumbing`)).status, 404);
  assert.equal((await client('/api/portal/state')).status, 401);
  assert.equal((await (await staff(`/api/clients/${created.id}`)).json()).summary, null);
});
