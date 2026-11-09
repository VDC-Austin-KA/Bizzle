// Local dev: creates the owner account (and demo analyst/sales logins outside production). Idempotent.
// No business data is seeded — leads come only from real sources (Lead Finder → Source new leads).
// Production (D1) users are created with `npm run create-owner` — see README.
import { openDb } from './db-node.js';
import { createUser } from './auth.js';

const db = openDb();
const ensureUser = async (u, showPw = true) => {
  if (await db.get('SELECT 1 AS ok FROM users WHERE email = ?', u.email)) return;
  await createUser(db, u);
  console.log(`user ${u.role.padEnd(7)} ${u.email}  /  ${showPw ? u.password : '(password from env)'}`);
};

await ensureUser({ email: process.env.BIZZLE_OWNER_EMAIL ?? 'owner@bizzle.local', name: 'Owner', role: 'owner',
  password: process.env.BIZZLE_OWNER_PASSWORD ?? 'change-me-owner' }, !process.env.BIZZLE_OWNER_PASSWORD);
if (process.env.NODE_ENV !== 'production') {
  await ensureUser({ email: 'analyst@bizzle.local', name: 'Demo Analyst', role: 'analyst', password: 'change-me-analyst' });
  await ensureUser({ email: 'sales@bizzle.local', name: 'Demo Rep', role: 'sales', password: 'change-me-sales' });
}
