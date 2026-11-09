// Live website scan: fetch the homepage and detect which customer-facing tools the business already uses.
// The URL is untrusted (from Google or user input), so only public http(s) hosts are fetched (SSRF guard).
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const VENDORS = {
  booking: {
    Calendly: /calendly\.com/i, Acuity: /acuityscheduling\.com|(?<![a-z])as\.me\//i, 'Square Appointments': /squareup\.com\/appointments|square\.site\/book|book\.squareup/i,
    Vagaro: /vagaro\.com/i, Booksy: /booksy\.com/i, Mindbody: /mindbodyonline\.com|healcode/i, GlossGenius: /glossgenius\.com/i,
    Fresha: /fresha\.com/i, Boulevard: /joinblvd\.com|(?<![a-z])blvd\.co\//i, Schedulicity: /schedulicity\.com/i, Setmore: /setmore\.com/i,
    SimplyBook: /simplybook\.(me|it)/i, Zocdoc: /zocdoc\.com/i, NexHealth: /nexhealth\.com/i, LocalMed: /localmed\.com/i,
    'Housecall Pro': /housecallpro\.com/i, ServiceTitan: /servicetitan\.com|st-scheduler/i, Jobber: /getjobber\.com|clienthub\.getjobber/i,
    Workiz: /workiz\.com/i, OpenTable: /opentable\.com/i, Resy: /resy\.com/i, Tock: /exploretock\.com/i, Yelp: /yelp\.com\/reservations/i,
    Clio: /clio\.com|app\.clio/i, 'Tekmetric': /tekmetric\.com/i, 'Shopmonkey': /shopmonkey\.io/i, PetDesk: /petdesk\.com/i,
    'Vet appointments (Vetstoria)': /vetstoria\.com/i, Wellnessliving: /wellnessliving\.com/i, Zenoti: /zenoti\.com/i,
    'Wix Bookings': /13d21c63-b5ec-5912-8397-c3a5ddb27a97|wix-bookings/i, 'Schedule Engine': /scheduleengine\.(com|net)/i,
    'Weave Scheduling': /book\.getweave\.com/i, Modento: /modento\.io/i, 'Flex Dental': /flexbook\.me|getflex\.io/i, Adit: /(?<![a-z])adit\.com/i,
    'Smile Generation': /smilegenerationmychart\.com/i, Yapi: /yapiapp\.com/i, RevenueWell: /revenuewell\.com/i,
    Phorest: /phorest\.com/i, 'Tripleseat (events)': /tripleseat\.com/i, SevenRooms: /sevenrooms\.com/i,
    FieldEdge: /fieldedge\.com/i, 'Service Fusion': /servicefusion\.com/i, Kickserv: /kickserv\.com/i, Arrivy: /arrivy\.com/i,
  },
  ordering: {
    Toast: /toasttab\.com/i, ChowNow: /chownow\.com/i, 'DoorDash storefront': /order\.online|doordash\.com\/store/i,
    'Square Online': /square\.site|squareup\.com\/store/i, Popmenu: /popmenu\.com/i, BentoBox: /getbento\.com/i,
    Clover: /clover\.com\/online-ordering/i, Olo: /(?<![a-z])olo\.com/i, 'Grubhub': /grubhub\.com/i, 'Uber Eats': /ubereats\.com/i,
  },
  chat: {
    Intercom: /widget\.intercom\.io|intercomcdn/i, Drift: /js\.driftt\.com|drift\.com/i, 'tawk.to': /embed\.tawk\.to/i,
    LiveChat: /livechatinc\.com/i, Tidio: /tidio\.co/i, Crisp: /client\.crisp\.chat/i, Zendesk: /zdassets\.com|zopim/i,
    'HubSpot chat': /usemessages\.com/i, Podium: /podium\.com/i, Birdeye: /birdeye\.com/i,
    Olark: /olark\.com/i, 'Smith.ai': /smith\.ai/i, Ngage: /ngagelive\.com/i, ApexChat: /apexchat\.(com|net)/i,
    'GoHighLevel/LeadConnector': /leadconnectorhq\.com|msgsndr\.com/i, 
    'Facebook Messenger': /fb-customerchat|customerchat\.js/i, Hatch: /usehatchapp\.com/i, Kenect: /kenect\.com/i, Freshchat: /wchat\.freshchat\.com/i, Gorgias: /gorgias\.chat/i,
  },
  reviews: {
    Birdeye: /birdeye\.com/i, Podium: /podium\.com/i, NiceJob: /nicejob\.(co|com)/i, 'Grade.us': /grade\.us/i,
    Trustindex: /trustindex\.io/i, Broadly: /broadly\.com/i, Reviewwave: /reviewwave/i,
  },
};

function isPrivateIp(ip) {
  if (isIP(ip) === 6) return /^(::1|::|f[cd]|fe80|::ffff:(10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\.)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are scanned');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('Refusing to scan a private address');
}

export function detectSignals(html, finalUrl, scripts = '') {
  const all = `${html}\n${scripts}`;
  const found = (group) => Object.entries(VENDORS[group]).filter(([, re]) => re.test(all)).map(([name]) => name);
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => Number(m[1]));
  return {
    reachable: true,
    final_url: finalUrl,
    https: finalUrl.startsWith('https:'),
    mobile_friendly: /<meta[^>]+name=["']?viewport/i.test(html),
    booking: found('booking'),
    ordering: found('ordering'),
    chat: found('chat'),
    reviews: found('reviews'),
    contact_form: /<form[\s>]/i.test(html),
    click_to_call: /href=["']tel:/i.test(html),
    copyright_year: years.length ? Math.max(...years) : null,
    title: html.match(/<title[^>]*>([^<]{0,140})/i)?.[1]?.trim() ?? null,
  };
}

// We identify ourselves honestly and never try to get past bot protection: a blocked site is "unknown", not a gap.
const UA = 'Mozilla/5.0 (compatible; BizzleSiteCheck/1.0; +https://github.com/vdc-austin-ka/bizzle)';
const CHALLENGE = /sgcaptcha|cf-chl|challenge-platform|just a moment\.\.\.|attention required|ddos-guard|_incapsula_|px-captcha|captcha-delivery/i;
const BROKEN_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT']);

async function get(url, fetchImpl, max) {
  await assertPublic(url);
  const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': UA, Accept: '*/*' } });
  return { res, body: res.status >= 300 && res.status < 400 ? '' : (await res.text()).slice(0, max) };
}

// Scripts that commonly inject booking/chat widgets: the page's Tag Manager container and its first-party bundles.
function scriptUrls(html, base) {
  const out = [];
  for (const [, src] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try { const u = new URL(src, base); if (u.hostname === base.hostname || /googletagmanager\.com\/gtm\.js/.test(u.href)) out.push(u); } catch {}
  }
  for (const [, id] of html.matchAll(/(GTM-[A-Z0-9]{4,10})/g)) out.push(new URL(`https://www.googletagmanager.com/gtm.js?id=${id}`));
  const gtmFirst = out.sort((x, y) => /googletagmanager/.test(y.href) - /googletagmanager/.test(x.href));
  return [...new Map(gtmFirst.map((u) => [u.href, u])).values()].slice(0, 6);
}

export async function scanWebsite(rawUrl, fetchImpl = fetch) {
  let url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  try {
    let html = null;
    for (let hop = 0; hop < 6 && html == null; hop++) {
      const { res, body } = await get(url, fetchImpl, 1_500_000);
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
      if (CHALLENGE.test(body) || [202, 401, 403, 429].includes(res.status)) return { reachable: false, blocked: true, error: 'Site blocks automated checks — review manually', checked_url: url.href };
      if (!res.ok) return { reachable: false, error: `HTTP ${res.status}`, checked_url: url.href };
      const refresh = body.length < 3000 && body.match(/http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i);
      if (refresh) { url = new URL(refresh[1], url); continue; }
      html = body;
    }
    if (html == null) return { reachable: false, error: 'Too many redirects', checked_url: url.href };
    const scripts = await Promise.all(scriptUrls(html, url).map((u) => get(u, fetchImpl, 1_000_000).then((r) => r.body).catch(() => '')));
    return detectSignals(html, url.href, scripts.join('\n'));
  } catch (e) {
    const code = e.cause?.code ?? e.code;
    if (BROKEN_CODES.has(code)) return { reachable: false, error: code, checked_url: url.href };
    return { reachable: false, unknown: true, error: code ?? e.message, checked_url: url.href };
  }
}
