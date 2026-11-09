import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const STAGES = ['new', 'contacted', 'discovery', 'proposal', 'won', 'lost'];
export const BOOL_FIELDS = ['hiring', 'new_location', 'locally_headquartered', 'has_website', 'has_online_booking', 'has_chat'];
export const NUM_FIELDS = ['employees', 'years_in_business', 'rating', 'review_count', 'reviews_last_90d', 'review_response_rate'];
export const TEXT_FIELDS = ['name', 'industry', 'city', 'address', 'phone', 'website', 'source', 'external_id'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','analyst','sales')),
  password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, industry TEXT, city TEXT, address TEXT, phone TEXT, website TEXT,
  employees INTEGER DEFAULT 1, years_in_business INTEGER DEFAULT 0, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0,
  reviews_last_90d INTEGER DEFAULT 0, review_response_rate REAL DEFAULT 0,
  hiring INTEGER DEFAULT 0, new_location INTEGER DEFAULT 0, locally_headquartered INTEGER DEFAULT 1,
  has_website INTEGER DEFAULT 0, has_online_booking INTEGER DEFAULT 0, has_chat INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'new', est_value INTEGER DEFAULT 0, assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual', external_id TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL, body TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`;

export function openDb(path = process.env.BIZZLE_DB ?? 'data/bizzle.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

// Coerce untrusted input into a clean lead row. Returns { lead } or { error }.
export function normalizeLead(input) {
  const lead = {};
  for (const f of TEXT_FIELDS) if (input[f] != null && input[f] !== '') lead[f] = String(input[f]).trim().slice(0, 300);
  for (const f of NUM_FIELDS) if (input[f] != null && input[f] !== '') {
    const n = Number(input[f]);
    if (!Number.isFinite(n) || n < 0) return { error: `${f} must be a non-negative number` };
    lead[f] = n;
  }
  if (lead.rating > 5) return { error: 'rating must be 0–5' };
  if (lead.review_response_rate > 1) return { error: 'review_response_rate must be 0–1' };
  for (const f of BOOL_FIELDS) if (input[f] != null && input[f] !== '') lead[f] = ['true', '1', 'yes', 'y'].includes(String(input[f]).toLowerCase()) ? 1 : 0;
  if (lead.has_website == null && lead.website) lead.has_website = 1;
  if (!lead.name) return { error: 'name is required' };
  return { lead };
}

export function insertLead(db, lead) {
  const cols = Object.keys(lead); // keys come only from the whitelisted field lists above
  const sql = `INSERT INTO leads (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
    ON CONFLICT(external_id) DO NOTHING`;
  return db.prepare(sql).run(...cols.map((c) => lead[c]));
}

export function rowToLead(r) {
  const lead = { ...r };
  for (const f of BOOL_FIELDS) lead[f] = !!r[f];
  return lead;
}
