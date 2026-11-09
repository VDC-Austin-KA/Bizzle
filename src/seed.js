// Creates the owner account (and demo analyst/sales logins outside production). Idempotent.
// No business data is seeded — leads come only from real sources (Lead Finder → Source new leads).
import { openDb } from './db.js';
import { createUser } from './auth.js';

const db = openDb();
const ensureUser = (u, showPw = true) => {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(u.email)) return;
  createUser(db, u);
  console.log(`user ${u.role.padEnd(7)} ${u.email}  /  ${showPw ? u.password : '(password from env)'}`);
};

ensureUser({ email: process.env.BIZZLE_OWNER_EMAIL ?? 'owner@bizzle.local', name: 'Owner', role: 'owner',
  password: process.env.BIZZLE_OWNER_PASSWORD ?? 'change-me-owner' }, !process.env.BIZZLE_OWNER_PASSWORD);
if (process.env.NODE_ENV !== 'production') {
  ensureUser({ email: 'analyst@bizzle.local', name: 'Demo Analyst', role: 'analyst', password: 'change-me-analyst' });
  ensureUser({ email: 'sales@bizzle.local', name: 'Demo Rep', role: 'sales', password: 'change-me-sales' });
}
