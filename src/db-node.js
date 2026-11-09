// Local-dev adapter: node:sqlite behind the same async interface as D1.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA } from './db.js';

export function openDb(path = process.env.BIZZLE_DB ?? 'data/bizzle.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  raw.exec(SCHEMA);
  return {
    get: async (sql, ...p) => raw.prepare(sql).get(...p) ?? null,
    all: async (sql, ...p) => raw.prepare(sql).all(...p),
    run: async (sql, ...p) => { const r = raw.prepare(sql).run(...p); return { lastId: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
  };
}
