// Passwords: PBKDF2-SHA256 via WebCrypto (works on Node and Cloudflare Workers; 100k = Workers' max iterations).
const ITERATIONS = 100_000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPassword(pw) {
  const salt = randomHex(16);
  return `pbkdf2$${ITERATIONS}$${salt}$${await derive(pw, unhex(salt), ITERATIONS)}`;
}

export async function verifyPassword(pw, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2' || !hash) return false;
  const got = await derive(pw, unhex(salt), Number(iter));
  let diff = got.length ^ hash.length; // constant-time compare
  for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

const checkPassword = (pw) => { if (!pw || String(pw).length < 10) throw new Error('Password must be at least 10 characters'); };

export async function createUser(db, { email, name, role, password }) {
  if (!email || !name) throw new Error('email and name are required');
  checkPassword(password);
  return db.run('INSERT INTO users (email, name, role, password_hash) VALUES (?,?,?,?)',
    String(email).toLowerCase().trim(), name, role, await hashPassword(password));
}

export async function changePassword(db, userId, current, next) {
  const u = await db.get('SELECT password_hash FROM users WHERE id = ?', userId);
  if (!u || !(await verifyPassword(String(current ?? ''), u.password_hash))) throw new Error('Current password is incorrect');
  checkPassword(next);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(next), userId);
  await db.run('DELETE FROM sessions WHERE user_id = ?', userId); // sign out other sessions
}

export async function createSession(db, userId) {
  const token = randomHex(32);
  await db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)', token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export async function userForToken(db, token) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return db.get(`SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`, token, Date.now());
}

export const destroySession = (db, token) => db.run('DELETE FROM sessions WHERE token = ?', token ?? '');
export const purgeExpiredSessions = (db) => db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());

// Naive per-instance login throttle: 10 failures per IP per 15 min.
const failures = new Map();
export function throttled(ip) {
  const f = failures.get(ip);
  return !!f && f.count >= 10 && Date.now() - f.first < 15 * 60 * 1000;
}
export function recordFailure(ip) {
  const f = failures.get(ip);
  if (!f || Date.now() - f.first > 15 * 60 * 1000) failures.set(ip, { count: 1, first: Date.now() });
  else f.count++;
}
