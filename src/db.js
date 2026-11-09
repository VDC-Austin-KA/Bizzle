import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { addressKey } from './sources/comptroller.js';

export const STAGES = ['new', 'contacted', 'discovery', 'proposal', 'won', 'lost'];

// Columns any source may write. Pipeline fields (stage, est_value, assigned_to) are never touched by imports.
export const DATA_FIELDS = ['name', 'legal_name', 'org_type', 'industry', 'naics', 'address', 'city', 'zip', 'county', 'phone', 'website',
  'taxpayer_number', 'outlet_number', 'hq_city', 'hq_state', 'hq_local', 'first_sale_date', 'entity_formed_date', 'outlets_total', 'outlets_opened_12mo',
  'places_id', 'google_name', 'rating', 'review_count', 'business_status', 'maps_url', 'google_category', 'places_checked_at',
  'web_signals', 'web_checked_at', 'mb_revenue_12mo', 'mb_revenue_prev_12mo', 'mb_latest_month', 'mb_checked_at', 'source', 'external_id'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','analyst','sales')),
  password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, legal_name TEXT, org_type TEXT, industry TEXT, naics TEXT,
  address TEXT, city TEXT, zip TEXT, county TEXT, addr_key TEXT, phone TEXT, website TEXT,
  taxpayer_number TEXT, outlet_number TEXT, hq_city TEXT, hq_state TEXT, hq_local INTEGER,
  first_sale_date TEXT, entity_formed_date TEXT, outlets_total INTEGER, outlets_opened_12mo INTEGER,
  places_id TEXT, google_name TEXT, rating REAL, review_count INTEGER, business_status TEXT, maps_url TEXT, google_category TEXT, places_checked_at TEXT,
  web_signals TEXT, web_checked_at TEXT,
  mb_revenue_12mo INTEGER, mb_revenue_prev_12mo INTEGER, mb_latest_month TEXT, mb_checked_at TEXT,
  stage TEXT DEFAULT 'new', est_value INTEGER DEFAULT 0, assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT, external_id TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS leads_addr ON leads(addr_key, zip);
CREATE INDEX IF NOT EXISTS leads_places ON leads(places_id);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY, lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, kind TEXT NOT NULL, body TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`;

export function openDb(path = process.env.BIZZLE_DB ?? 'data/bizzle.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

const firstWord = (name) => String(name ?? '').toUpperCase().replace(/^THE\s+/, '').match(/[A-Z0-9]+/)?.[0];

// Insert, or merge into the existing record for the same storefront (same external id, Google place,
// or same street address + ZIP + first name word). Never overwrites known values with blanks.
export function upsertLead(db, input) {
  const lead = Object.fromEntries(Object.entries(input).filter(([k, v]) => DATA_FIELDS.includes(k) && v != null && v !== ''));
  if (typeof lead.hq_local === 'boolean') lead.hq_local = lead.hq_local ? 1 : 0;
  if (lead.web_signals && typeof lead.web_signals !== 'string') lead.web_signals = JSON.stringify(lead.web_signals);
  lead.addr_key = addressKey(lead.address);

  let existing = lead.external_id && db.prepare('SELECT id FROM leads WHERE external_id = ?').get(lead.external_id);
  existing ||= lead.places_id && db.prepare('SELECT id FROM leads WHERE places_id = ?').get(lead.places_id);
  if (!existing && lead.addr_key && lead.zip) {
    existing = db.prepare('SELECT id, name FROM leads WHERE addr_key = ? AND zip = ?').all(lead.addr_key, lead.zip)
      .find((r) => firstWord(r.name) === firstWord(lead.name));
  }
  if (existing) {
    const { external_id, source, ...rest } = lead; // keep the original record's identity
    updateLead(db, existing.id, rest);
    return { id: existing.id, created: false };
  }
  if (!lead.name) throw new Error('name is required');
  const cols = Object.keys(lead);
  const { lastInsertRowid } = db.prepare(`INSERT INTO leads (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => lead[c]));
  return { id: Number(lastInsertRowid), created: true };
}

// Column names are restricted to DATA_FIELDS (+ addr_key), so they are safe to interpolate.
export function updateLead(db, id, fields) {
  const cols = Object.keys(fields).filter((c) => DATA_FIELDS.includes(c) || c === 'addr_key');
  if (!cols.length) return;
  const val = (c) => (c === 'web_signals' && fields[c] && typeof fields[c] !== 'string' ? JSON.stringify(fields[c]) : fields[c]);
  db.prepare(`UPDATE leads SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map(val), id);
}

export function rowToLead(r) {
  return { ...r, hq_local: r.hq_local == null ? null : !!r.hq_local, web_signals: r.web_signals ? JSON.parse(r.web_signals) : null };
}
