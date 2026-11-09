// Local dev: creates the alpha demo accounts (one per access portal, password alpha2026!) and, if
// BIZZLE_OWNER_EMAIL + BIZZLE_OWNER_PASSWORD are set, a real owner. No business data is seeded.
import { openDb } from './db-node.js';
import { createUser } from './auth.js';
import { ensureDemoUsers, DEMO_ACCOUNTS, DEMO_PASSWORD } from './app.js';

const db = openDb();
await ensureDemoUsers(db);
for (const a of DEMO_ACCOUNTS) console.log(`${a.label.padEnd(14)} ${a.email}  /  ${DEMO_PASSWORD}`);
const { BIZZLE_OWNER_EMAIL: email, BIZZLE_OWNER_PASSWORD: password } = process.env;
if (email && password && !(await db.get('SELECT 1 AS ok FROM users WHERE email = ?', email.toLowerCase()))) {
  await createUser(db, { email, name: 'Owner', role: 'owner', password });
  console.log(`owner          ${email}  /  (password from env)`);
}
