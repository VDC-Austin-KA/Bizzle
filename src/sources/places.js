// Google Places API (New) — Text Search. Key from GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY.
// Note: requesting rating/website fields bills at the Text Search "Enterprise" SKU — see Google pricing.
import { addressKey } from './comptroller.js';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = ['id', 'displayName', 'formattedAddress', 'addressComponents', 'nationalPhoneNumber', 'websiteUri',
  'rating', 'userRatingCount', 'businessStatus', 'googleMapsUri', 'primaryTypeDisplayName', 'types'].map((f) => `places.${f}`).join(',');

const apiKey = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
export const placesEnabled = () => !!apiKey();

async function textSearch(textQuery, max, fetchImpl = fetch) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST', signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey(), 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery, maxResultCount: max, regionCode: 'US' }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).places ?? [];
}

const component = (p, type) => p.addressComponents?.find((c) => c.types?.includes(type));

export function placeFields(p) {
  return {
    places_id: p.id,
    google_name: p.displayName?.text ?? null,
    rating: p.rating ?? null,
    review_count: p.userRatingCount ?? 0,
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? null,
    business_status: p.businessStatus ?? null,
    maps_url: p.googleMapsUri ?? null,
    google_category: p.primaryTypeDisplayName?.text ?? null,
    places_checked_at: new Date().toISOString(),
  };
}

// Discovery: businesses Google returns for "<query> in <city>, TX".
export async function searchPlaces({ query, city }, fetchImpl) {
  const places = await textSearch(`${query} in ${city}, TX`, 20, fetchImpl);
  return places.filter((p) => component(p, 'administrative_area_level_1')?.shortText === 'TX').map((p) => {
    const num = component(p, 'street_number')?.longText, route = component(p, 'route')?.shortText;
    return {
      external_id: `gplaces:${p.id}`, name: p.displayName?.text,
      address: num && route ? `${num} ${route}` : p.formattedAddress?.split(',')[0],
      city: component(p, 'locality')?.longText ?? city, zip: component(p, 'postal_code')?.longText,
      source: 'google_places', ...placeFields(p),
    };
  });
}

const GENERIC = new Set(['PLUMBING', 'PLUMBER', 'ELECTRIC', 'ELECTRICAL', 'SERVICES', 'SERVICE', 'HEATING', 'COOLING', 'AIR', 'AC',
  'HVAC', 'CONDITIONING', 'MECHANICAL', 'HOME', 'RESTAURANT', 'CAFE', 'PIZZA', 'GRILL', 'BAR', 'KITCHEN', 'SALON', 'SPA', 'AUTO',
  'REPAIR', 'CONSTRUCTION', 'ROOFING', 'DENTAL', 'LAW', 'FIRM', 'INSURANCE', 'FITNESS', 'GYM', 'TEXAS', 'AUSTIN', 'CENTRAL', 'GROUP']);
const STOP = new Set(['LLC', 'INC', 'CO', 'CORP', 'COMPANY', 'LTD', 'PLLC', 'LP', 'THE', 'AND', 'OF', 'DBA']);
const nameTokens = (s) => String(s ?? '').toUpperCase().replace(/['’]/g, '').replace(/&/g, ' AND ').replace(/[^A-Z0-9 ]/g, ' ')
  .split(/\s+/).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t)); // drop store numbers like "#5"
const stem = (t) => (t.length > 3 && t.endsWith('S') ? t.slice(0, -1) : t);
// Every distinctive word of the registry name must appear in Google's name (city names and trade words don't count).
// One-directional on purpose: "KS Southwest Austin LLC" must NOT match Google's "Southwest".
export function namesMatch(registryName, googleName, city = '') {
  const cityWords = new Set(nameTokens(city));
  const distinct = nameTokens(registryName).filter((t) => !GENERIC.has(t) && !cityWords.has(t)).map(stem);
  const google = new Set(nameTokens(googleName).map(stem));
  return distinct.length > 0 && distinct.some((t) => t.length >= 3) && distinct.every((t) => google.has(t));
}

// Enrichment: find the Google listing for an existing lead. Accept only if (a) street number + street and ZIP
// agree, or (b) the business names match and it's in the same city. A wrong match is worse than no match.
const ADDRESS_TYPES = new Set(['premise', 'subpremise', 'street_address', 'route', 'geocode', 'postal_code', 'locality']);
const RESIDENTIAL = new Set(['apartment_building', 'apartment_complex', 'condominium_complex', 'housing_complex', 'lodging', 'real_estate_agency']);
const suiteOf = (addr) => String(addr ?? '').toUpperCase().match(/(?:STE|SUITE|UNIT|BLDG|#)\s*([A-Z0-9-]+)/)?.[1] ?? null;
const shareToken = (a, b) => { const y = new Set(nameTokens(b)); return nameTokens(a).some((t) => y.has(t)); };

export function pickMatch(lead, results) {
  const key = addressKey(lead.address);
  const leadNum = key?.split(' ')[0];
  const leadSuite = suiteOf(lead.address);
  const mailbox = /#|\bPMB\b|\bBOX\b|\bAPT\b/i.test(lead.address ?? ''); // mailbox or apartment: the building is someone else's
  const legalName = /\b(LLC|INC|CORP|LTD|LP|PLLC)\.?$/i.test(lead.name);
  const places = results.filter((p) => !p.types?.some((t) => ADDRESS_TYPES.has(t))); // drop bare-address results
  const facts = (p) => {
    const sub = component(p, 'subpremise')?.longText;
    return { num: component(p, 'street_number')?.longText, route: component(p, 'route')?.shortText ?? '', zip: component(p, 'postal_code')?.longText,
      suite: sub ? (suiteOf(sub) ?? sub.toUpperCase()) : suiteOf(p.formattedAddress), city: component(p, 'locality')?.longText?.toUpperCase() };
  };
  const zipOk = (f) => !lead.zip || !f.zip || f.zip === lead.zip;
  return places.find((p) => { // (a) same street address (+ suite, ZIP) and a shared name word — or a lone legal-entity DBA
    const f = facts(p);
    return key && f.num && addressKey(`${f.num} ${f.route}`) === key && zipOk(f) && (!leadSuite || !f.suite || leadSuite === f.suite) &&
      (shareToken(lead.name, p.displayName?.text) || (legalName && !mailbox && places.length === 1 && !p.types?.some((t) => RESIDENTIAL.has(t))));
  }) ?? places.find((p) => { // (b) same street number + suite + ZIP (road has two names) and a shared name word
    const f = facts(p);
    return leadNum && f.num === leadNum && leadSuite && f.suite === leadSuite && lead.zip && f.zip === lead.zip && shareToken(lead.name, p.displayName?.text);
  }) ?? places.find((p) => namesMatch(lead.name, p.displayName?.text, lead.city) && facts(p).city === String(lead.city ?? '').toUpperCase()); // (c)
}

// Enrichment: find the Google listing for an existing lead. Tries the full address first, then name + city.
export async function matchPlace(lead, fetchImpl) {
  const queries = [`${lead.name} ${lead.address ?? ''} ${lead.city ?? ''} TX ${lead.zip ?? ''}`, `${lead.name} ${lead.city ?? ''} TX`];
  for (const q of queries) {
    const hit = pickMatch(lead, await textSearch(q, 5, fetchImpl));
    if (hit) return placeFields(hit);
  }
  return null;
}
