// Live website scan: fetch the homepage and detect which customer-facing tools the business already uses.
// The URL is untrusted (from Google or user input), so only public http(s) hosts are fetched (SSRF guard).
// node:dns exists in Node; on Cloudflare Workers the platform itself refuses requests to private networks.
let dnsMod;
const loadDns = async () => (dnsMod ??= await import('node:dns/promises').catch(() => ({})));
const isIP = (h) => (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) ? 4 : h.includes(':') ? 6 : 0);

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

export async function assertPublic(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are scanned');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('Refusing to scan a private address');
  const dns = isIP(host) ? null : await loadDns();
  const addrs = isIP(host) ? [{ address: host }] : dns.lookup ? await dns.lookup(host, { all: true }) : [];
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
    self_rating: aggregateRating(html),
  };
}

// schema.org AggregateRating the business publishes on its own site (self-reported; labelled as such in scoring).
export function aggregateRating(html) {
  for (const [, json] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(json); } catch { continue; }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      const ar = n.aggregateRating;
      if (ar && typeof ar === 'object') {
        const rating = Number(ar.ratingValue), count = Number(ar.reviewCount ?? ar.ratingCount);
        if (rating > 0 && rating <= 5 && count > 0) return { rating: Math.round(rating * 10) / 10, count: Math.round(count) };
      }
      stack.push(...Object.values(n));
    }
  }
  return null;
}

// We identify ourselves honestly and never try to get past bot protection: a blocked site is "unknown", not a gap.
const UA = 'Mozilla/5.0 (compatible; BizzleSiteCheck/1.0; +https://github.com/vdc-austin-ka/bizzle)';
const CHALLENGE = /sgcaptcha|cf-chl|challenge-platform|just a moment\.\.\.|attention required|ddos-guard|_incapsula_|px-captcha|captcha-delivery/i;
const BROKEN_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT']);

async function get(url, fetchImpl, max, timeoutMs = 15_000) {
  await assertPublic(url);
  const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': UA, Accept: '*/*' } });
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

// Fetch a homepage following redirects / meta-refresh, with the SSRF guard on every hop.
async function loadPage(rawUrl, fetchImpl, timeoutMs) {
  let url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  try {
    for (let hop = 0; hop < 6; hop++) {
      const { res, body } = await get(url, fetchImpl, 1_500_000, timeoutMs);
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
      if (CHALLENGE.test(body) || [202, 401, 403, 429].includes(res.status)) return { blocked: true, error: 'Site blocks automated checks — review manually', url };
      // Only a missing page proves the site is broken; 5xx (incl. Cloudflare 52x seen from Workers) may be temporary or a block.
      if (!res.ok) return { error: `HTTP ${res.status}`, broken: [404, 410].includes(res.status), url };
      const refresh = body.length < 3000 && body.match(/http-equiv=["']?refresh["']?[^>]*url=([^"'>\s]+)/i);
      if (refresh) { url = new URL(refresh[1], url); continue; }
      return { html: body, url };
    }
    return { error: 'Too many redirects', url };
  } catch (e) {
    const code = e.cause?.code ?? e.code;
    return { error: code ?? e.message, broken: BROKEN_CODES.has(code), url };
  }
}

export async function scanWebsite(rawUrl, fetchImpl = fetch) {
  const page = await loadPage(rawUrl, fetchImpl);
  if (page.blocked) return { reachable: false, blocked: true, error: page.error, checked_url: page.url.href };
  if (page.html == null) return { reachable: false, error: page.error, checked_url: page.url.href, ...(page.broken ? {} : { unknown: true }) };
  const scripts = await Promise.all(scriptUrls(page.html, page.url).map((u) => get(u, fetchImpl, 1_000_000).then((r) => r.body).catch(() => '')));
  return detectSignals(page.html, page.url.href, scripts.join('\n'));
}

// Website discovery without Google: try likely .com domains built from the business name and accept one
// only if the page itself names the business (every distinctive word) AND its city or ZIP.
const LEGAL = new Set(['llc', 'inc', 'co', 'corp', 'company', 'ltd', 'pllc', 'lp', 'the', 'dba', 'of']);
const GENERIC_WORDS = new Set(['services', 'service', 'plumbing', 'electric', 'electrical', 'heating', 'cooling', 'air', 'ac', 'hvac',
  'home', 'restaurant', 'cafe', 'grill', 'bar', 'salon', 'spa', 'auto', 'repair', 'construction', 'roofing', 'dental', 'law', 'and',
  'group', 'solutions', 'texas', 'tx', 'austin', 'llc', 'pros', 'professional', 'contractors', 'contracting', 'systems', 'mechanical']);
const words = (s) => String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter((w) => w && !LEGAL.has(w));

export function candidateDomains(name, { legalName, city } = {}) {
  const variants = (n) => {
    const w = words(n).filter((x) => !/^\d+$/.test(x));
    const core = w.filter((x) => !['services', 'service', 'company'].includes(x));
    return w.length ? [w.join(''), core.join(''), w.join('-'), `${core.join('')}tx`, `${core.join('')}atx`,
      city ? `${core.join('')}${words(city).join('')}` : ''] : [];
  };
  const out = [...variants(name), ...(legalName ? variants(legalName).slice(0, 2) : [])].filter((d) => d.length >= 6 && d.length <= 40);
  return [...new Set(out)].slice(0, 6).map((d) => `https://${d}.com/`);
}

export function pageMatchesBusiness(html, lead) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').toLowerCase();
  const has = (w) => new RegExp(`\\b${w.replace(/[^a-z0-9]/g, '')}\\b`).test(text);
  const distinct = words(lead.name).filter((x) => !GENERIC_WORDS.has(x) && !/^\d+$/.test(x));
  if (!distinct.length || !distinct.every(has)) return false;
  const places = [lead.city, lead.hq_city].filter(Boolean).map((c) => c.toLowerCase());
  return places.some((c) => text.includes(c)) || (!!lead.zip && text.includes(lead.zip));
}

export async function discoverWebsite(lead, fetchImpl = fetch) {
  // Candidates are checked in parallel (short timeout); the first verified one in priority order wins.
  const pages = await Promise.all(candidateDomains(lead.name, { legalName: lead.legal_name, city: lead.city }).map((u) => loadPage(u, fetchImpl, 8_000)));
  return pages.find((p) => p.html && pageMatchesBusiness(p.html, lead))?.url.href ?? null;
}
