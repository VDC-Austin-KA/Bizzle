// Local dev / tests: each client workspace is its OWN SQLite file (data/workspaces/<id>.db), or in-memory for tests.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { WorkspaceStore, WORKSPACE_METHODS } from './workspace.js';

// Dev master key: BIZZLE_WORKSPACE_KEY, else a random key persisted in data/.workspace-key (gitignored).
export function devMasterKey(dir = 'data') {
  if (process.env.BIZZLE_WORKSPACE_KEY) return process.env.BIZZLE_WORKSPACE_KEY;
  const f = `${dir}/.workspace-key`;
  if (!existsSync(f)) { mkdirSync(dir, { recursive: true }); writeFileSync(f, btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))), { mode: 0o600 }); }
  return readFileSync(f, 'utf8').trim();
}

export function nodeWorkspaces({ dir = 'data/workspaces', masterKey, fetchImpl } = {}) {
  const open = new Map();
  if (dir !== ':memory:') mkdirSync(dir, { recursive: true });
  const store = (id) => {
    if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Invalid workspace id');
    if (!open.has(id)) {
      const path = dir === ':memory:' ? ':memory:' : `${dir}/${id}.db`;
      const db = new DatabaseSync(path);
      const exec = (sql, ...p) => { const st = db.prepare(sql); return /^\s*(SELECT|WITH)/i.test(sql) ? st.all(...p) : (st.run(...p), []); };
      open.set(id, new WorkspaceStore(exec, { masterKey, fetchImpl,
        onDestroy: () => { db.close(); open.delete(id); if (path !== ':memory:') rmSync(path, { force: true }); } }));
    }
    return open.get(id);
  };
  return (id) => ({ call: async (m, ...a) => { if (!WORKSPACE_METHODS.has(m)) throw new Error('Not allowed'); return store(id)[m](...a); } });
}
