// Small HTTP helpers shared by the staff API (app.js) and the client portal API (portal.js).
const MAX_BODY = 2_000_000;
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export const fail = (status, msg) => { throw new HttpError(status, msg); };
export const cookie = (req, name) => (req.headers.get('cookie') ?? '').split(';').map((c) => c.trim().split('='))
  .find(([k]) => k === name)?.[1];

export async function readJson(req) {
  // JSON-only bodies + SameSite=Strict cookie = CSRF protection for this API.
  if (!String(req.headers.get('content-type')).startsWith('application/json')) fail(415, 'Content-Type must be application/json');
  const text = await req.text();
  if (text.length > MAX_BODY) fail(413, 'Body too large');
  try { return JSON.parse(text || '{}'); } catch { fail(400, 'Invalid JSON'); }
}
