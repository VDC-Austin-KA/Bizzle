import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, segmentsFor, strategyFor } from '../src/scoring.js';
import { parseCsv } from '../src/csv.js';
import { normalizeLead } from '../src/db.js';

const base = { name: 'Test Co', industry: 'hvac_plumbing', city: 'Austin', employees: 20, years_in_business: 5, rating: 4.2,
  review_count: 100, reviews_last_90d: 5, hiring: false, new_location: false, locally_headquartered: true,
  has_website: true, has_online_booking: true, has_chat: true, review_response_rate: 0.9 };

test('segments: rising, popular, anchor, standard', () => {
  assert.deepEqual(segmentsFor({ ...base, years_in_business: 1, hiring: true }), ['rising']);
  assert.deepEqual(segmentsFor({ ...base, review_count: 800, rating: 4.8 }), ['popular']);
  assert.deepEqual(segmentsFor({ ...base, employees: 120, years_in_business: 25 }), ['anchor']);
  assert.deepEqual(segmentsFor(base), ['standard']);
});

test('digital gaps and momentum raise the score; breakdown sums to score', () => {
  const mature = scoreLead(base);
  const gappy = scoreLead({ ...base, has_online_booking: false, has_chat: false, review_response_rate: 0.1, hiring: true });
  assert.ok(gappy.score > mature.score);
  assert.equal(gappy.score, gappy.factors.reduce((t, f) => t + f.points, 0));
  assert.ok(gappy.score <= 100 && mature.score >= 0);
});

test('core-metro city outscores outer Central Texas on locality', () => {
  const loc = (city) => scoreLead({ ...base, city }).factors.find((f) => f.key === 'locality').points;
  assert.ok(loc('Round Rock') > loc('Waco'));
});

test('strategy prioritizes use cases matching gaps and computes ROI', () => {
  const s = strategyFor({ ...base, has_online_booking: false });
  assert.equal(s.useCases[0].gap, 'booking');
  assert.equal(s.pilot.length, 2);
  assert.ok(s.roi.annualSavings > 0 && s.roi.setup > 0);
});

test('unknown industry falls back to default playbook', () => {
  assert.equal(strategyFor({ ...base, industry: 'mystery' }).industry, 'General Local Business');
});

test('csv parser handles quotes, commas and CRLF', () => {
  const rows = parseCsv('name,city\r\n"Smith, ""Jr"" Plumbing",Austin\r\n\r\nB,Kyle');
  assert.deepEqual(rows, [{ name: 'Smith, "Jr" Plumbing', city: 'Austin' }, { name: 'B', city: 'Kyle' }]);
});

test('normalizeLead validates and coerces untrusted input', () => {
  assert.ok(normalizeLead({}).error);
  assert.ok(normalizeLead({ name: 'X', rating: 9 }).error);
  assert.ok(normalizeLead({ name: 'X', employees: 'abc' }).error);
  const { lead } = normalizeLead({ name: ' X ', hiring: 'yes', website: 'https://x.test', bogus: 'drop me' });
  assert.deepEqual(lead, { name: 'X', website: 'https://x.test', hiring: 1, has_website: 1 });
});
