import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceQuote, suggestSelection, normalizeSelection } from '../public/pricing.js';

test('flat workflow prices, bundle discount, extra locations', () => {
  assert.equal(priceQuote({ workflows: ['booking'] }).oneTime, 750);
  const two = priceQuote({ workflows: ['booking', 'receptionist'] }); // 750 + 1200 = 1950, 10% off
  assert.equal(two.oneTime, 1950 - 195);
  const three = priceQuote({ workflows: ['booking', 'reviews', 'website'] }); // 750+750+2000 = 3500, 15% off
  assert.equal(three.oneTime, 3500 - 525);
  assert.equal(priceQuote({ workflows: ['booking'], locations: 3 }).oneTime, 750 + 2 * 250);
});

test('training, care plan and payment options', () => {
  const q = priceQuote({ training: { pack: 1, session: 2 }, care: 'plus' });
  assert.equal(q.oneTime, 500 + 300);
  assert.equal(q.monthly, 0); // care plans only apply with a setup
  const withCare = priceQuote({ workflows: ['chat'], care: 'plus', payment: 'full' });
  assert.equal(withCare.monthly, 349);
  assert.equal(withCare.oneTime, 1200 - 60); // 5% off for paying in full
  assert.deepEqual(withCare.schedule, [{ when: 'Before we start', amount: 1140 }]);
  const split = priceQuote({ workflows: ['receptionist'] });
  assert.deepEqual(split.schedule.map((s) => s.amount), [600, 600]);
  const monthly = priceQuote({ workflows: ['receptionist', 'booking'], payment: 'monthly' });
  assert.equal(monthly.schedule.reduce((t, s) => t + s.amount, 0), monthly.oneTime);
  assert.equal(priceQuote({ workflows: ['booking'], payment: 'monthly' }).selection.payment, 'split'); // under $1,000 minimum
});

test('Essentials care covers up to 2 workflows; larger setups use Plus', () => {
  assert.equal(priceQuote({ workflows: ['booking', 'reviews'], care: 'essentials' }).monthly, 149);
  assert.equal(priceQuote({ workflows: ['booking', 'reviews', 'chat'], care: 'essentials' }).monthly, 349);
});

test('untrusted selections are normalized (no injected prices or ids)', () => {
  const s = normalizeSelection({ workflows: ['booking', 'free_stuff', 'booking'], training: { pack: -5, session: 999 }, locations: 0, care: 'gold', payment: 'never', price: 1 });
  assert.deepEqual(s, { training: { session: 20, pack: 0, workshop: 0 }, workflows: ['booking'], locations: 1, care: 'none', payment: 'split' });
});

test('third-party software is listed separately, never in our totals', () => {
  const q = priceQuote({ workflows: ['receptionist'] });
  assert.equal(q.software[0].estimate, '$50–$300/mo (typical AI receptionist plans)');
  assert.equal(q.oneTime, 1200);
});

test('suggested selection follows observed gaps and the recommended path', () => {
  assert.deepEqual(suggestSelection({ gaps: ['booking', 'chat', 'reviews'], industry: 'hvac_plumbing' }).workflows, ['booking', 'receptionist', 'reviews']);
  assert.deepEqual(suggestSelection({ gaps: ['chat'], industry: 'dental' }).workflows, ['textback']);
  const t = suggestSelection({ gaps: ['booking'], recommendedPath: 'training' });
  assert.deepEqual(t.workflows, []); assert.equal(t.training.pack, 1);
});
