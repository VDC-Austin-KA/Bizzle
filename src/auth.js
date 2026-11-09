import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createUser(db, { email, name, role, password }) {
  if (!email || !name || !password || password.length < 10) throw new Error('email, name and a 10+ char password are required');
  return db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?,?,?,?)')
    .run(String(email).toLowerCase().trim(), name, role, hashPassword(password));
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

export function userForToken(db, token) {
  if (!token) return null;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  return db.prepare(`SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token) ?? null;
}

export const destroySession = (db, token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token);

// Naive in-memory login throttle: 10 failures per IP per 15 min.
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
