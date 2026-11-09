// Seeds users and FICTIONAL demo businesses. Idempotent: safe to re-run.
import { readFileSync } from 'node:fs';
import { openDb, normalizeLead, insertLead } from './db.js';
import { createUser } from './auth.js';

const db = openDb();
const ensureUser = (u) => {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(u.email)) return;
  createUser(db, u);
  console.log(`user ${u.role.padEnd(7)} ${u.email}  /  ${u.role === 'owner' && process.env.BIZZLE_OWNER_PASSWORD ? '(password from env)' : u.password}`);
};

const ownerPw = process.env.BIZZLE_OWNER_PASSWORD ?? 'change-me-owner';
ensureUser({ email: process.env.BIZZLE_OWNER_EMAIL ?? 'owner@bizzle.local', name: 'Owner', role: 'owner', password: ownerPw });
if (process.env.NODE_ENV !== 'production') {
  ensureUser({ email: 'analyst@bizzle.local', name: 'Demo Analyst', role: 'analyst', password: 'change-me-analyst' });
  ensureUser({ email: 'sales@bizzle.local', name: 'Demo Rep', role: 'sales', password: 'change-me-sales' });

  const seed = JSON.parse(readFileSync(new URL('../data/seed-businesses.json', import.meta.url)));
  let n = 0;
  for (const b of seed) {
    const { lead, error } = normalizeLead({ ...b, has_website: !!b.website, source: 'demo', external_id: `demo:${b.name}` });
    if (error) throw new Error(`${b.name}: ${error}`);
    n += insertLead(db, lead).changes;
  }
  console.log(`seeded ${n} demo leads (${seed.length - n} already present)`);
}
