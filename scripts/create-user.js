// Create a user in the Cloudflare D1 database.
//   node scripts/create-user.js <email> "<name>" <owner|analyst|sales> [--local]
// Password: BIZZLE_PASSWORD env var, or a random one printed once. Change it after first login (Account page).
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/auth.js';

const [email, name, role = 'owner', where = '--remote'] = process.argv.slice(2);
if (!/^[^\s'@]+@[^\s'@]+\.[^\s'@]+$/.test(email ?? '') || !name || !['owner', 'analyst', 'sales'].includes(role)) {
  console.error('usage: node scripts/create-user.js <email> "<name>" <owner|analyst|sales> [--local]'); process.exit(1);
}
const password = process.env.BIZZLE_PASSWORD ?? randomBytes(12).toString('base64url');
const hash = await hashPassword(password); // [0-9a-z$] only
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (email, name, role, password_hash) VALUES (${q(email.toLowerCase())}, ${q(name)}, ${q(role)}, ${q(hash)});`;
execFileSync('npx', ['wrangler', 'd1', 'execute', 'bizzle', where === '--local' ? '--local' : '--remote', '--command', sql], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`Created ${role} ${email}${process.env.BIZZLE_PASSWORD ? '' : `  password: ${password}`}`);
