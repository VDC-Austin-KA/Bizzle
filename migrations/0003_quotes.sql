CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('request','proposal')), selection TEXT NOT NULL, one_time INTEGER NOT NULL, monthly INTEGER NOT NULL,
  contact_name TEXT, business TEXT, email TEXT, phone TEXT, city TEXT, message TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
