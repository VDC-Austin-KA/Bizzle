-- Bizzle's index of client workspaces. Holds no client settings or keys — those live in each client's own workspace database.
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, business TEXT NOT NULL, lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  quote_id INTEGER, workflows TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'invited',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
