// Security check of a client's existing website and email domain — read-only, no logins, honest User-Agent.
// Web: HTTPS + redirect, security headers, version disclosure. Email: SPF, DMARC, MX via DNS-over-HTTPS (Cloudflare).
// Each finding has a plain-language explanation and fix, so the client can understand it.
import { assertPublic } from './sources/website.js';

const UA = 'Mozilla/5.0 (compatible; BizzleSiteCheck/1.0; security check requested by the site owner)';
const finding = (id, title, status, detail, fix = null) => ({ id, title, status, detail, fix });

async function head(url, fetchImpl) {
  await assertPublic(url);
  return fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': UA } });
}

async function dns(name, type, fetchImpl) {
  const r = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
  return ((await r.json()).Answer ?? []).map((a) => String(a.data).replace(/^"|"$/g, '').replace(/" "/g, ''));
}

export async function securityScan(target, fetchImpl = fetch) {
  const url = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
  const host = url.hostname.replace(/^www\./, '');
  const findings = [];

  // --- HTTPS & redirect
  let res = null;
  try {
    let u = new URL(`https://${url.hostname}/`);
    for (let i = 0; i < 5; i++) { res = await head(u, fetchImpl); if (res.status >= 300 && res.status < 400 && res.headers.get('location')) u = new URL(res.headers.get('location'), u); else break; }
    findings.push(res.status < 400 || [401, 403].includes(res.status)
      ? finding('https', 'Secure connection (HTTPS)', 'pass', 'Your site loads over an encrypted connection.')
      : finding('https', 'Secure connection (HTTPS)', 'warn', `Your site answered with an error (${res.status}).`, 'Check your hosting — the site may be down or misconfigured.'));
  } catch (e) {
    findings.push(finding('https', 'Secure connection (HTTPS)', 'fail', `We couldn't open your site securely (${e.cause?.code ?? e.message}).`, 'Turn on HTTPS (an SSL certificate) with your web host — most offer it free.'));
  }
  try {
    const plain = await head(new URL(`http://${url.hostname}/`), fetchImpl);
    const loc = plain.headers.get('location') ?? '';
    findings.push(plain.status >= 300 && plain.status < 400 && loc.startsWith('https://')
      ? finding('redirect', 'Visitors are sent to the secure version', 'pass', 'Typing your address without https:// still lands on the secure site.')
      : finding('redirect', 'Visitors are sent to the secure version', 'warn', 'The non-secure (http://) address doesn\'t redirect to https://.', 'Ask your host to "force HTTPS".'));
  } catch { findings.push(finding('redirect', 'Visitors are sent to the secure version', 'unknown', 'We couldn\'t check the http:// address.')); }

  // --- Security headers & version disclosure
  if (res && res.status < 500) {
    const h = (n) => res.headers.get(n);
    const headerChecks = [
      ['hsts', 'Browsers remember to always use HTTPS (HSTS)', !!h('strict-transport-security'), 'Add the Strict-Transport-Security header.'],
      ['frame', 'Protection against your site being framed by others', !!h('x-frame-options') || /frame-ancestors/i.test(h('content-security-policy') ?? ''), 'Add X-Frame-Options: SAMEORIGIN (or a CSP frame-ancestors rule).'],
      ['nosniff', 'Files are served as the right type (nosniff)', /nosniff/i.test(h('x-content-type-options') ?? ''), 'Add X-Content-Type-Options: nosniff.'],
      ['csp', 'Content Security Policy', !!h('content-security-policy'), 'Add a Content-Security-Policy so only your own scripts can run.'],
      ['referrer', 'Referrer policy', !!h('referrer-policy'), 'Add Referrer-Policy: strict-origin-when-cross-origin.'],
    ];
    for (const [id, title, ok, fix] of headerChecks) findings.push(ok ? finding(id, title, 'pass', 'In place.') : finding(id, title, 'warn', 'Missing.', fix));
    const leak = [h('server'), h('x-powered-by')].filter((v) => v && /\d/.test(v));
    findings.push(leak.length ? finding('versions', 'Software versions hidden', 'warn', `Your site reveals software versions (${leak.join(', ')}), which helps attackers target known bugs.`, 'Ask your host to hide version numbers and keep the software updated.')
      : finding('versions', 'Software versions hidden', 'pass', 'Your site doesn\'t advertise software versions.'));
  }

  // --- Email domain protection
  try {
    const txt = await dns(host, 'TXT', fetchImpl);
    const spf = txt.find((t) => /^v=spf1/i.test(t));
    findings.push(spf ? finding('spf', 'Email sender list (SPF)', /[-~]all/.test(spf) ? 'pass' : 'warn', spf, /[-~]all/.test(spf) ? null : 'End your SPF record with ~all or -all.')
      : finding('spf', 'Email sender list (SPF)', 'fail', 'No SPF record — anyone can send email pretending to be your domain.', 'Add an SPF record at your domain provider (we can give you the exact value).'));
    const dmarc = (await dns(`_dmarc.${host}`, 'TXT', fetchImpl)).find((t) => /^v=DMARC1/i.test(t));
    const policy = dmarc?.match(/p=(\w+)/i)?.[1]?.toLowerCase();
    findings.push(!dmarc ? finding('dmarc', 'Email spoofing protection (DMARC)', 'fail', 'No DMARC record.', 'Add a DMARC record — start with p=none to monitor, then move to quarantine.')
      : finding('dmarc', 'Email spoofing protection (DMARC)', policy === 'none' ? 'warn' : 'pass', dmarc, policy === 'none' ? 'Your DMARC only monitors. Move to p=quarantine once reports look clean.' : null));
    const mx = await dns(host, 'MX', fetchImpl);
    findings.push(mx.length ? finding('mx', 'Email delivery (MX)', 'pass', `${mx.length} mail server record(s).`) : finding('mx', 'Email delivery (MX)', 'warn', 'No mail servers found for this domain.', 'If you use email at this domain, check your MX records.'));
  } catch (e) { findings.push(finding('dns', 'Email domain checks', 'unknown', `DNS lookup didn't complete (${e.message}).`)); }

  const counted = findings.filter((f) => f.status !== 'unknown');
  const score = counted.length ? Math.round(100 * counted.reduce((t, f) => t + (f.status === 'pass' ? 1 : f.status === 'warn' ? 0.5 : 0), 0) / counted.length) : null;
  return { target: url.hostname, score, findings };
}
