// Read-only connection tests for keys in a client's vault. Each test calls ONE fixed vendor endpoint that only
// reads account info. The key is sent only to that vendor's API host — never anywhere else.
export const VERIFY_HOSTS = { square: 'connect.squareup.com', calendly: 'api.calendly.com', twilio: 'api.twilio.com' };

export async function verifyCredential(kind, value, { sid } = {}, fetchImpl = fetch) {
  const call = async (url, headers) => {
    if (new URL(url).hostname !== VERIFY_HOSTS[kind]) throw new Error('Unexpected verification host');
    try { return await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) }); } catch (e) { return { ok: false, status: 0, error: e.message }; }
  };
  let res;
  if (kind === 'square') res = await call('https://connect.squareup.com/v2/locations', { Authorization: `Bearer ${value}`, 'Square-Version': '2025-01-23' });
  else if (kind === 'calendly') res = await call('https://api.calendly.com/users/me', { Authorization: `Bearer ${value}` });
  else if (kind === 'twilio') {
    if (!/^AC[0-9a-f]{32}$/i.test(sid ?? '')) return { ok: false, message: 'Save your Twilio Account SID first (starts with AC)' };
    res = await call(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { Authorization: `Basic ${btoa(`${sid}:${value}`)}` });
  } else return { ok: false, message: 'Unknown connection test' };
  if (res.ok) return { ok: true, message: 'Connected ✓' };
  if (res.status === 401 || res.status === 403) return { ok: false, message: 'The vendor rejected this key — check it or create a new one' };
  return { ok: false, message: res.status ? `Couldn't confirm (vendor replied ${res.status}) — try again later` : "Couldn't reach the vendor — try again later" };
}
