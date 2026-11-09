-- Generated from SCHEMA in src/db.js
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
