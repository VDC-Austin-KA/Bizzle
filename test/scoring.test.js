import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, segmentsFor, strategyFor } from '../src/scoring.js';
import { parseCsv } from '../src/csv.js';
import { industryForNaics } from '../src/playbooks.js';

const NOW = new Date('2026-11-09').getTime();
const scan = (o = {}) => ({ reachable: true, https: true, mobile_friendly: true, booking: [], ordering: [], chat: [], reviews: [], copyright_year: 2026, ...o });
const base = { name: 'Test Co', industry: 'hvac_plumbing', naics: '238220', city: 'Round Rock' };

test('unchecked data scores 0 and lowers coverage — nothing is guessed', () => {
  const r = scoreLead(base, NOW);
  assert.equal(r.coverage, 25); // only industry fit is known
  assert.equal(r.score, r.factors.find((f) => f.key === 'fit').points);
  assert.ok(r.factors.filter((f) => f.key !== 'fit').every((f) => !f.known && f.points === 0));
});

test('website gaps come from the scan; tools found reduce the gap score', () => {
  const none = scoreLead({ ...base, website: 'x', web_signals: scan() }, NOW).factors.find((f) => f.key === 'gaps');
  const tooled = scoreLead({ ...base, website: 'x', web_signals: scan({ booking: ['Housecall Pro'], chat: ['Podium'], reviews: ['Podium'] }) }, NOW).factors.find((f) => f.key === 'gaps');
  assert.ok(none.points > tooled.points);
  assert.ok(tooled.reasons.includes('Books via Housecall Pro'));
});

test('a site that blocks bots is unknown, not a gap', () => {
  const g = scoreLead({ ...base, website: 'x', web_signals: { reachable: false, blocked: true, error: 'blocked' } }, NOW).factors.find((f) => f.key === 'gaps');
  assert.equal(g.known, false); assert.equal(g.points, 0);
  assert.deepEqual(strategyFor({ ...base, web_signals: { reachable: false, blocked: true } }).recommended, []);
});

test('segments from registry, Google and revenue data', () => {
  assert.deepEqual(segmentsFor({ first_sale_date: '2025-06-01' }, NOW), ['rising']);
  assert.deepEqual(segmentsFor({ first_sale_date: '2010-01-01', outlets_total: 3, outlets_opened_12mo: 1 }, NOW), ['rising']);
  // a single new permit is not a "new location"
  assert.deepEqual(segmentsFor({ entity_formed_date: '2019-07-29', first_sale_date: '2026-09-01', outlets_total: 1, outlets_opened_12mo: 1 }, NOW), ['standard']);
  assert.deepEqual(segmentsFor({ review_count: 489, rating: 4.9 }, NOW), ['popular']);
  assert.deepEqual(segmentsFor({ mb_revenue_12mo: 1_854_662, mb_revenue_prev_12mo: 2_012_616 }, NOW), ['popular']);
  assert.deepEqual(segmentsFor({ hq_local: true, outlets_total: 4 }, NOW), ['anchor']);
  assert.deepEqual(segmentsFor({ hq_local: false, outlets_total: 4 }, NOW), ['standard']);
  assert.deepEqual(segmentsFor({ business_status: 'CLOSED_PERMANENTLY', review_count: 900, rating: 5 }, NOW), ['closed']);
});

test('business age uses the entity charter date, and spots likely ownership changes', () => {
  // GTX Plumbing: entity 2019, new sales-tax permit 2026 → not a new business
  const gtx = scoreLead({ ...base, entity_formed_date: '2019-07-29', first_sale_date: '2026-09-01', outlets_total: 1, outlets_opened_12mo: 1 }, NOW);
  assert.match(gtx.factors.find((f) => f.key === 'momentum').reasons[0], /entity since 2019/);
  assert.ok(!gtx.segments.includes('rising'));
  // Woods Comfort Systems: entity formed 2026 but 3,257 Google reviews → established brand, likely new ownership
  const woods = { ...base, entity_formed_date: '2026-06-02', review_count: 3257, rating: 4.9, places_id: 'p' };
  assert.ok(!segmentsFor(woods, NOW).includes('rising'));
  assert.match(scoreLead(woods, NOW).factors.find((f) => f.key === 'momentum').reasons[0], /likely new ownership/);
});

test('closed businesses score 0', () => {
  assert.equal(scoreLead({ ...base, business_status: 'CLOSED_PERMANENTLY', places_id: 'x' }, NOW).score, 0);
});

test('future first-sale date is labelled as newly registered', () => {
  const m = scoreLead({ ...base, first_sale_date: '2027-01-01' }, NOW).factors.find((f) => f.key === 'momentum');
  assert.match(m.reasons[0], /Newly registered/);
});

test('strategy recommends only use cases backed by observed gaps', () => {
  const s = strategyFor({ ...base, places_id: 'p', review_count: 78, rating: 4.8, web_signals: scan({ chat: ['Podium'], reviews: ['Podium'] }) });
  assert.deepEqual(s.recommended.map((u) => u.gap), ['booking']);
  assert.ok(s.recommended[0].evidence);
  assert.deepEqual(s.alreadyUses, ['Podium', 'Podium']);
  assert.ok(!s.otherUseCases.some((u) => u.gap === 'website')); // they have a working site
});

test('no website on Google → website use case recommended', () => {
  const s = strategyFor({ ...base, places_id: 'p', places_checked_at: 't' });
  assert.equal(s.recommended[0].gap, 'website');
});

test('NAICS → industry mapping', () => {
  assert.equal(industryForNaics('238220'), 'hvac_plumbing');
  assert.equal(industryForNaics(722511), 'restaurant');
  assert.equal(industryForNaics('621210'), 'dental');
  assert.equal(industryForNaics('999999'), null);
});

test('csv parser handles quotes, commas and CRLF', () => {
  const rows = parseCsv('name,city\r\n"Smith, ""Jr"" Plumbing",Austin\r\n\r\nB,Kyle');
  assert.deepEqual(rows, [{ name: 'Smith, "Jr" Plumbing', city: 'Austin' }, { name: 'B', city: 'Kyle' }]);
});
