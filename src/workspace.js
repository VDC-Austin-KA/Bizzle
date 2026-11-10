// A client's private workspace: its OWN SQLite database (a Durable Object on Cloudflare, one file per client
// locally) — physically separate from Bizzle's sales/lead database. Holds the client's profile, logo, an encrypted
// key vault, sessions and an access log the client can read.
//
// Privacy guarantees enforced here:
//  • Keys are encrypted (AES-256-GCM) with a key derived per client (HKDF from WORKSPACE_KEY + client id).
//  • No method returns a key's value. Keys are decrypted only inside verifySecret() at the moment of use, and
//    every use is written to the access log.
//  • This module and the code it calls make no requests to AI services (enforced by test/privacy.test.js).
import { hashPassword, verifyPassword } from './auth.js';
import { SECRET_NAMES, WORKFLOW_DEFS, validateProfile, missingRequired } from '../public/workflows.js';
import { verifyCredential } from './vault-verify.js';
import { securityScan } from './security-scan.js';

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)',
  'CREATE TABLE IF NOT EXISTS login (id INTEGER PRIMARY KEY CHECK (id = 1), email TEXT NOT NULL, password_hash TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS invites (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS profile (kind TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS assets (name TEXT PRIMARY KEY, mime TEXT NOT NULL, data_b64 TEXT NOT NULL, updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY, iv TEXT NOT NULL, ciphertext TEXT NOT NULL, updated_at TEXT NOT NULL, verified_at TEXT, verify_result TEXT)',
  'CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT)',
  'CREATE TABLE IF NOT EXISTS reports (kind TEXT PRIMARY KEY, data TEXT NOT NULL, at TEXT NOT NULL)',
];
const INVITE_TTL = 14 * 864e5, SESSION_TTL = 12 * 3600e3;
const ASSET_LIMITS = { logo: 300_000, hero: 900_000 };
const nowIso = () => new Date().toISOString();
const b64 = {
  enc: (buf) => { const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); },
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

// Logo files are checked by content, not by name: PNG, JPEG or WebP only (SVG can carry scripts).
export function sniffImage(bytes) {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export class WorkspaceStore {
  // exec(sql, ...params) → array of rows. masterKey: base64 32-byte secret (WORKSPACE_KEY).
  constructor(exec, { masterKey, fetchImpl = (...a) => fetch(...a), onDestroy } = {}) {
    this.exec = exec; this.masterKey = masterKey; this.fetchImpl = fetchImpl; this.onDestroy = onDestroy;
    for (const s of SCHEMA) exec(s);
  }

  // ---------- internals ----------
  meta() { return Object.fromEntries(this.exec('SELECT key, value FROM meta').map((r) => [r.key, r.value])); }
  setMeta(obj) { for (const [k, v] of Object.entries(obj)) this.exec('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v)); }
  workflows() { return JSON.parse(this.meta().workflows ?? '[]'); }
  log(actor, action, detail = null) { this.exec('INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)', nowIso(), actor, action, detail); }
  profileOf(kind) { const r = this.exec('SELECT data FROM profile WHERE kind = ?', kind)[0]; return r ? JSON.parse(r.data) : null; }
  async cryptoKey() {
    if (!this.masterKey) throw new Error('Workspace encryption key is not configured');
    const base = await crypto.subtle.importKey('raw', b64.dec(this.masterKey), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('bizzle-workspace-v1'), info: new TextEncoder().encode(this.meta().client_id) },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  assertActive() { if (this.meta().status === 'deleted') throw new Error('This workspace was deleted'); }

  // ---------- lifecycle (called by Bizzle staff tools) ----------
  init({ clientId, business, slug, workflows }) {
    if (!this.meta().client_id) this.setMeta({ client_id: clientId, created_at: nowIso(), status: 'invited' });
    this.setMeta({ business, slug, workflows: JSON.stringify(workflows.filter((w) => WORKFLOW_DEFS[w])) });
    if (!this.profileOf('draft')) this.exec('INSERT INTO profile (kind, data, updated_at) VALUES (?, ?, ?)', 'draft', JSON.stringify({ 'business.name': business }), nowIso());
    return { ok: true };
  }
  async createInvite() {
    this.assertActive();
    const token = randomHex(24);
    this.exec('INSERT INTO invites (token_hash, expires_at) VALUES (?, ?)', await sha256(token), Date.now() + INVITE_TTL);
    this.log('Bizzle team', 'Invite link created');
    return { token };
  }

  // ---------- client sign-in ----------
  async acceptInvite(token, email, password) {
    this.assertActive();
    const row = this.exec('SELECT * FROM invites WHERE token_hash = ?', await sha256(String(token)))[0];
    if (!row || row.used || row.expires_at < Date.now()) throw new Error('This invite link is invalid or has expired — ask us for a new one');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) throw new Error('Please enter a valid email');
    if (!password || password.length < 10) throw new Error('Choose a password of at least 10 characters');
    this.exec('INSERT INTO login (id, email, password_hash) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash',
      email.toLowerCase().trim(), await hashPassword(password));
    this.exec('UPDATE invites SET used = 1 WHERE token_hash = ?', row.token_hash);
    this.exec('DELETE FROM sessions'); // a new password signs out old sessions
    if (this.meta().status === 'invited') this.setMeta({ status: 'active' });
    this.log('You', 'Set your portal password');
    return this.newSession();
  }
  async login(email, password) {
    this.assertActive();
    const u = this.exec('SELECT * FROM login WHERE id = 1')[0];
    if (!u || u.email !== String(email ?? '').toLowerCase().trim() || !(await verifyPassword(String(password ?? ''), u.password_hash))) return null;
    this.log('You', 'Signed in');
    return this.newSession();
  }
  async newSession() {
    const token = randomHex(32);
    this.exec('DELETE FROM sessions WHERE expires_at < ?', Date.now());
    this.exec('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)', await sha256(token), Date.now() + SESSION_TTL);
    return { token };
  }
  async checkSession(token) {
    if (!/^[0-9a-f]{64}$/.test(token ?? '') || this.meta().status === 'deleted') return false;
    return !!this.exec('SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND expires_at > ?', await sha256(token), Date.now())[0];
  }
  async logout(token) { this.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256(String(token))); return { ok: true }; }

  // ---------- what the client sees ----------
  state() {
    const m = this.meta();
    const asset = (n) => { const r = this.exec('SELECT mime, data_b64 FROM assets WHERE name = ?', n)[0]; return r ? `data:${r.mime};base64,${r.data_b64}` : null; };
    return {
      business: m.business, slug: m.slug, status: m.status, workflows: this.workflows(), publishedAt: m.published_at ?? null,
      draft: this.profileOf('draft') ?? {}, live: !!this.profileOf('published'),
      logo: asset('logo'), hero: asset('hero'),
      secrets: this.secretsList(), report: this.report(), audit: this.exec('SELECT at, actor, action, detail FROM audit ORDER BY id DESC LIMIT 100'),
      missing: missingRequired(this.profileOf('draft'), this.workflows()),
    };
  }
  // What Bizzle staff can see: progress, non-secret settings, which keys exist (never their values), the security report.
  staffSummary() {
    const s = this.state();
    return { status: s.status, workflows: s.workflows, live: s.live, publishedAt: s.publishedAt, draft: s.draft, hasLogo: !!s.logo, hasPhoto: !!s.hero,
      missing: s.missing, secrets: s.secrets, report: s.report, audit: s.audit.slice(0, 30) };
  }
  report() { const r = this.exec('SELECT data, at FROM reports WHERE kind = ?', 'security')[0]; return r ? { ...JSON.parse(r.data), at: r.at } : null; }

  saveProfile(input, { publish = false, actor = 'You' } = {}) {
    this.assertActive();
    const { profile, errors } = validateProfile(input, this.workflows());
    if (errors.length) return { ok: false, errors };
    this.exec('INSERT INTO profile (kind, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(kind) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at', 'draft', JSON.stringify(profile), nowIso());
    if (!publish) { this.log(actor, 'Saved a draft'); return { ok: true, published: false }; }
    const missing = missingRequired(profile, this.workflows());
    if (missing.length) return { ok: false, errors: missing.map((m) => `${m} is required before launch`) };
    const first = !this.profileOf('published');
    this.exec('INSERT INTO profile (kind, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(kind) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at', 'published', JSON.stringify(profile), nowIso());
    this.setMeta({ status: 'live', published_at: nowIso() });
    this.log(actor, first ? 'Launched your site' : 'Published changes to your site');
    return { ok: true, published: true, first };
  }
  putAsset(name, dataB64) {
    this.assertActive();
    const max = ASSET_LIMITS[name];
    if (!max) throw new Error('Unknown upload');
    let bytes; try { bytes = b64.dec(String(dataB64)); } catch { throw new Error('That file could not be read'); }
    if (bytes.length > max) throw new Error(`${name === 'logo' ? 'Logo' : 'Photo'} must be under ${Math.round(max / 1000)} KB`);
    const mime = sniffImage(bytes);
    if (!mime) throw new Error('Please upload a PNG, JPEG or WebP image');
    this.exec('INSERT INTO assets (name, mime, data_b64, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, data_b64 = excluded.data_b64, updated_at = excluded.updated_at',
      name, mime, b64.enc(bytes), nowIso());
    this.log('You', name === 'logo' ? 'Uploaded a logo' : 'Uploaded a photo', mime);
    return { ok: true, mime };
  }
  removeAsset(name) { this.exec('DELETE FROM assets WHERE name = ?', String(name)); this.log('You', `Removed your ${name === 'logo' ? 'logo' : 'photo'}`); return { ok: true }; }
  // Public site: only the published snapshot, never drafts.
  published() {
    const p = this.profileOf('published');
    if (!p || this.meta().status !== 'live') return null;
    const has = (n) => !!this.exec('SELECT 1 AS ok FROM assets WHERE name = ?', n)[0];
    return { profile: p, workflows: this.workflows(), hasLogo: has('logo'), hasHero: has('hero') };
  }
  asset(name) { const r = this.exec('SELECT mime, data_b64 FROM assets WHERE name = ?', String(name))[0]; return r ? { mime: r.mime, data: r.data_b64 } : null; }

  // ---------- key vault (write-only) ----------
  allowedSecret(name) { const def = SECRET_NAMES[name]; return def && this.workflows().some((w) => WORKFLOW_DEFS[w].access.includes(def)) ? def : null; }
  secretsList() {
    const set = Object.fromEntries(this.exec('SELECT name, updated_at, verified_at, verify_result FROM secrets').map((r) => [r.name, r]));
    return this.workflows().flatMap((w) => WORKFLOW_DEFS[w].access.filter((a) => a.kind === 'secret').map((a) => ({
      name: a.name, label: a.label, detail: a.detail, optional: !!a.optional, canVerify: !!a.verify, workflow: w,
      set: !!set[a.name], updatedAt: set[a.name]?.updated_at ?? null, verifiedAt: set[a.name]?.verified_at ?? null,
      verifyResult: set[a.name]?.verify_result ?? null })));
  }
  async putSecret(name, value) {
    this.assertActive();
    if (!this.allowedSecret(name)) throw new Error('That key is not needed for your services');
    const v = String(value ?? '').trim();
    if (!v || v.length > 4096) throw new Error('Please paste the key (up to 4,096 characters)');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, await this.cryptoKey(), new TextEncoder().encode(v));
    this.exec(`INSERT INTO secrets (name, iv, ciphertext, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET iv = excluded.iv, ciphertext = excluded.ciphertext, updated_at = excluded.updated_at, verified_at = NULL, verify_result = NULL`,
      name, b64.enc(iv), b64.enc(ct), nowIso());
    this.log('You', 'Saved a key', name);
    return { ok: true };
  }
  deleteSecret(name) {
    this.exec('DELETE FROM secrets WHERE name = ?', String(name));
    this.log('You', 'Deleted a key', String(name));
    return { ok: true };
  }
  async decrypt(name) {
    const r = this.exec('SELECT iv, ciphertext FROM secrets WHERE name = ?', name)[0];
    if (!r) return null;
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(r.iv), additionalData: new TextEncoder().encode(name) }, await this.cryptoKey(), b64.dec(r.ciphertext));
    return new TextDecoder().decode(pt);
  }
  // Read-only connection test with the vendor. The decrypted value never leaves this function.
  async verifySecret(name, actor = 'You') {
    const def = this.allowedSecret(name);
    if (!def?.verify) throw new Error('This key has no connection test');
    const value = await this.decrypt(name);
    if (!value) throw new Error('Save the key first');
    const extra = def.verify === 'twilio' ? { sid: await this.decrypt('TWILIO_ACCOUNT_SID') } : {};
    const result = await verifyCredential(def.verify, value, extra, this.fetchImpl);
    this.exec('UPDATE secrets SET verified_at = ?, verify_result = ? WHERE name = ?', nowIso(), result.message, name);
    this.log(actor, `Used a key for a read-only connection test (${def.verify})`, `${name}: ${result.message}`);
    return result;
  }

  // A request the client made from the portal (e.g. upgrades) — recorded in their own access log.
  noteRequest(action, detail) { this.assertActive(); this.log('You', String(action).slice(0, 80), String(detail ?? '').slice(0, 300)); return { ok: true }; }

  // ---------- security check & data ownership ----------
  async runSecurityScan(actor = 'You') {
    const d = this.profileOf('draft') ?? {};
    const target = d['links.website'] || (d['wf.website.domain'] ? `https://${d['wf.website.domain']}` : null);
    if (!target) return { ok: false, errors: ['Add your current website (or domain) first'] };
    const report = await securityScan(target, this.fetchImpl);
    this.exec('INSERT INTO reports (kind, data, at) VALUES (?, ?, ?) ON CONFLICT(kind) DO UPDATE SET data = excluded.data, at = excluded.at', 'security', JSON.stringify(report), nowIso());
    this.log(actor, 'Ran the security check', report.target);
    return { ok: true, report };
  }
  exportData() {
    const s = this.state();
    this.log('You', 'Downloaded a copy of your data');
    return { exported_at: nowIso(), business: s.business, status: s.status, workflows: s.workflows, settings: s.draft, published_settings: this.profileOf('published'),
      logo: s.logo, photo: s.hero, keys: s.secrets.filter((k) => k.set).map((k) => ({ name: k.name, saved: k.updatedAt, note: 'Key values are never exported. You have the originals.' })),
      security_report: s.report, access_log: s.audit };
  }
  async destroy() {
    for (const t of ['login', 'invites', 'sessions', 'profile', 'assets', 'secrets', 'audit', 'reports']) this.exec(`DELETE FROM ${t}`);
    this.setMeta({ status: 'deleted', deleted_at: nowIso() });
    this.exec("DELETE FROM meta WHERE key NOT IN ('client_id', 'status', 'deleted_at')"); // business name, settings, etc. are gone too
    await this.onDestroy?.();
    return { ok: true };
  }
}

// Methods callable through the workspace boundary (Durable Object RPC / local adapter). Anything else is refused.
export const WORKSPACE_METHODS = new Set(['init', 'createInvite', 'acceptInvite', 'login', 'checkSession', 'logout', 'state', 'staffSummary', 'saveProfile',
  'putAsset', 'removeAsset', 'noteRequest', 'published', 'asset', 'putSecret', 'deleteSecret', 'verifySecret', 'runSecurityScan', 'exportData', 'destroy']);
