import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressKey, outletToLead, fetchMixedBevRevenue, titleCase } from '../src/sources/comptroller.js';
import { namesMatch, pickMatch } from '../src/sources/places.js';
import { detectSignals, scanWebsite } from '../src/sources/website.js';

// Shapes below mirror real responses from data.texas.gov and places.googleapis.com.
const place = (name, { num, route, zip = '78664', city = 'Round Rock', sub, types = ['restaurant', 'establishment'] } = {}) => ({
  displayName: { text: name }, types, formattedAddress: `${num} ${route}, ${city}, TX ${zip}, USA`,
  addressComponents: [
    num && { longText: num, types: ['street_number'] }, route && { shortText: route, types: ['route'] },
    sub && { longText: sub, types: ['subpremise'] }, { longText: zip, types: ['postal_code'] }, { longText: city, types: ['locality'] },
  ].filter(Boolean),
});

test('addressKey normalizes street addresses and ignores PO boxes', () => {
  assert.equal(addressKey('661 LOUIS HENNA BLVD STE 300'), '661 LOUIS');
  assert.equal(addressKey('661 Louis Henna Blvd Unit 300'), '661 LOUIS');
  assert.equal(addressKey('1100 E Palm Valley Blvd'), '1100 PALM');
  assert.equal(addressKey('PO BOX 234'), null);
});

test('registry row maps to a lead with real fields', () => {
  const l = outletToLead({ taxpayer_number: '32091262371', taxpayer_name: 'KYOKA ROUND ROCK, INC', taxpayer_organization_type: 'CT',
    taxpayer_city: 'CEDAR PARK', taxpayer_state: 'TX', taxpayer_county_code: '246', outlet_number: '1', outlet_name: 'KYOKA SUSHI & BAR',
    outlet_address: '661 LOUIS HENNA BLVD STE 300', outlet_city: 'ROUND ROCK', outlet_zip_code: '786643003', outlet_county_code: '246',
    outlet_naics_code: '722511', outlet_first_sales_date: '2024-01-22T00:00:00.000' });
  assert.equal(l.name, 'Kyoka Sushi & Bar'); assert.equal(l.industry, 'restaurant'); assert.equal(l.county, 'Williamson');
  assert.equal(l.zip, '78664'); assert.equal(l.hq_local, true); assert.equal(l.org_type, 'Texas corporation');
  assert.equal(l.external_id, 'txst:32091262371:1');
  assert.equal(titleCase('X-TECH AC AND HEATING LLC'), 'X-Tech AC And Heating LLC');
});

test('name matching requires a distinctive shared word', () => {
  assert.ok(namesMatch('Pardners', "Pardner's Bar"));
  assert.ok(namesMatch('Mr Gattis #5', "Mr Gatti's Pizza"));
  assert.ok(namesMatch('Hambone Plumbing', 'Hambone Plumbing and Septic'));
  assert.ok(!namesMatch('Plumbing', 'ABC Plumbing'));
  assert.ok(!namesMatch('Austin Plumbing', 'Austin Plumbing Pros'));
  assert.ok(!namesMatch('Ks Southwest Austin LLC', 'Southwest', 'Austin')); // real false match found in live testing
  assert.ok(namesMatch('Thundercloud Sub', 'ThunderCloud Subs'));
  assert.ok(namesMatch('Tomei Electric LLC', 'Tomei Electric'));
});

test('Google match: same address + shared name word', () => {
  const lead = { name: 'Kyoka Sushi & Bar', address: '661 Louis Henna Blvd Ste 300', city: 'Round Rock', zip: '78664' };
  assert.equal(pickMatch(lead, [place('Kyoka Sushi Bar & Grill', { num: '661', route: 'Louis Henna Blvd', sub: 'Unit 300' })])?.displayName.text, 'Kyoka Sushi Bar & Grill');
});

test('Google match rejects bare-address results, other suites, and same names in other cities', () => {
  const lead = { name: 'Parkhouse West Ventures LLC', address: '4098 Outpost Trce', city: 'Austin', zip: '78731' };
  assert.equal(pickMatch(lead, [place('4098 Outpost Trace', { num: '4098', route: 'Outpost Trace', zip: '78731', city: 'Austin', types: ['premise'] })]), undefined);
  // A different tenant in another suite of the same building must not match on address alone.
  const suite = { name: 'Centex Bas LLC', address: '5900 Balcones Dr Ste 33786', city: 'Austin', zip: '78731' };
  assert.equal(pickMatch(suite, [place('Balcones Family Law', { num: '5900', route: 'Balcones Dr', sub: '200', zip: '78731', city: 'Austin' })]), undefined);
  // A sole operator registered at their apartment must not match the apartment complex (real case from live testing).
  const apt = { name: 'Smitties Services LLC', address: '618 El Rio St Apt 2315', city: 'San Marcos', zip: '78666' };
  assert.equal(pickMatch(apt, [place('Emerson at Trace', { num: '618', route: 'El Rio St', zip: '78666', city: 'San Marcos', types: ['apartment_complex', 'establishment'] })]), undefined);
  // …but the same business that moved suites in the same city still matches by name.
  const moved = { name: 'Bruner Plumbing LLC', address: '5900 Balcones Dr Ste 100', city: 'Austin', zip: '78731' };
  assert.ok(pickMatch(moved, [place('Bruner Plumbing', { num: '5900', route: 'Balcones Dr', sub: '200', zip: '78731', city: 'Austin' })]));
  const neo = { name: 'Neo Electric LLC', address: '100 E Whitestone Blvd Ste 148 # 811', city: 'Cedar Park', zip: '78613' };
  assert.equal(pickMatch(neo, [place('Neo Electric', { num: '105', route: 'Venetian Blvd', zip: '32095', city: 'St. Augustine' })]), undefined);
});

test('Google match: road with two names, same number + suite + ZIP', () => {
  const lead = { name: "Reale's Pizza & Cafe, INC.", address: '13450 N Highway 183 Ste 230', city: 'Austin', zip: '78750' };
  const hit = pickMatch(lead, [place("Reale's Italian Cafe", { num: '13450', route: 'Research Blvd', sub: 'Suite 230', zip: '78750', city: 'Austin' })]);
  assert.equal(hit?.displayName.text, "Reale's Italian Cafe");
});

test('alcohol sales: trailing 12 vs prior 12 months, $0 pre-opening months ignored', async () => {
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 9 - i, 28));
    rows.push({ location_number: '1', location_address: '661 LOUIS HENNA BLVD STE 300', obligation_end_date: d.toISOString(), total_sales_receipts: i < 12 ? '1000' : i < 24 ? '800' : '0' });
  }
  const fetchImpl = async () => ({ ok: true, json: async () => rows });
  const r = await fetchMixedBevRevenue({ taxpayer_number: '32091262371', address: '661 Louis Henna Blvd Ste 300' }, fetchImpl);
  assert.deepEqual(r, { found: true, latestMonth: '2026-10', revenue12: 12000, revenuePrev12: 9600 });
  const young = rows.slice(0, 18);
  const r2 = await fetchMixedBevRevenue({ taxpayer_number: '32091262371', address: '661 Louis Henna Blvd' }, async () => ({ ok: true, json: async () => young }));
  assert.equal(r2.revenuePrev12, null); // not a full prior year → no YoY claim
});

test('site detection: real vendors only', () => {
  const fbLike = '<script>js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.8";</script><meta name="viewport" content="width=device-width">';
  const s = detectSignals(fbLike, 'https://x.com/');
  assert.deepEqual(s.chat, []); // Facebook SDK ≠ Messenger chat
  assert.equal(s.mobile_friendly, true);
  const wix = detectSignals('<link href="https://siteassets.parastorage.com/pages?appDefinitionIdToSiteRevision=%7B%2213d21c63-b5ec-5912-8397-c3a5ddb27a97%22">', 'http://e.com/');
  assert.deepEqual(wix.booking, ['Wix Bookings']); assert.equal(wix.https, false);
  const viaGtm = detectSignals('<html>© 2021 Acme</html>', 'https://a.com/', 'var u="https://connect.podium.com/widget.js"');
  assert.deepEqual(viaGtm.chat, ['Podium']); assert.equal(viaGtm.copyright_year, 2021);
  assert.deepEqual(detectSignals('call us at polo.com', 'https://a.com/').ordering, []);
});

test('scanner refuses private addresses (SSRF guard)', async () => {
  const r = await scanWebsite('http://127.0.0.1:3000/', async () => { throw new Error('should not fetch'); });
  assert.equal(r.reachable, false); assert.match(r.error, /private/);
});

test('scanner reports bot walls as blocked, not as a broken site', async () => {
  const fetchImpl = async () => ({ ok: true, status: 202, headers: new Headers(), text: async () => '<meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2F">' });
  const r = await scanWebsite('http://93.184.215.14/', fetchImpl);
  assert.equal(r.blocked, true);
});
