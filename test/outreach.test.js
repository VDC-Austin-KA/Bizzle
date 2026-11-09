import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutreach, briefMarkdown } from '../src/outreach.js';
import { strategyFor } from '../src/scoring.js';
import { candidateDomains, pageMatchesBusiness, aggregateRating } from '../src/sources/website.js';
import { takeGoogle } from '../src/app.js';
import { openDb } from '../src/db-node.js';

const scan = (o = {}) => ({ reachable: true, https: true, mobile_friendly: true, booking: [], ordering: [], chat: [], reviews: [], ...o });
const brief = (b) => buildOutreach(b, strategyFor(b));

test('busy popular business with gaps → done-with-you, hook cites their real reviews', () => {
  const o = brief({ name: 'Hambone Plumbing', google_name: 'Hambone Plumbing and Septic', industry: 'hvac_plumbing', places_id: 'p', rating: 4.9, review_count: 184, website: 'x', web_signals: scan() });
  assert.equal(o.recommendedPath, 'done_with_you');
  const why = o.script.find((s) => s.step.startsWith('Why'));
  assert.match(why.say, /4\.9 stars from 184 Google reviews/);
  assert.ok(o.evidence.some((e) => /online booking/.test(e)));
  assert.ok(o.script.find((s) => s.ask)?.ask.some((q) => /after-hours/.test(q))); // industry discovery questions
});

test('business already using tools → one-on-one training, objection names their tool', () => {
  const o = brief({ name: 'Juan & Only Plumber', industry: 'hvac_plumbing', places_id: 'p', rating: 4.9, review_count: 489, website: 'x',
    web_signals: scan({ booking: ['Housecall Pro'], chat: ['Podium'], reviews: ['Trustindex'] }) });
  assert.equal(o.recommendedPath, 'training');
  assert.ok(o.paths.training.why[0].includes('Housecall Pro'));
  assert.ok(o.objections.some((x) => x.objection.includes('Housecall Pro')));
});

test('no invented numbers: only stats from the lead appear; brief exports to markdown', () => {
  const o = brief({ name: 'Acme Dental', industry: 'dental', website: 'x', web_signals: scan() });
  const md = briefMarkdown(o);
  assert.doesNotMatch(md, /\d+\s?%/); // no percentage claims
  for (const h of ['## What we know', '## Call script', '## Voicemail', '## Handling hesitation', '## Building confidence', 'Done-with-you setup', 'One-on-one training']) assert.ok(md.includes(h), h);
});

test('website discovery: candidate domains and strict page verification', () => {
  assert.deepEqual(candidateDomains('GTX Plumbing LLC', { city: 'Georgetown' }), ['https://gtxplumbing.com/', 'https://gtx-plumbing.com/', 'https://gtxplumbingtx.com/', 'https://gtxplumbingatx.com/', 'https://gtxplumbinggeorgetown.com/']);
  const lead = { name: 'Hambone Plumbing', city: 'Taylor', zip: '76574' };
  assert.ok(pageMatchesBusiness('<title>Hambone Plumbing</title><p>Serving Taylor, TX</p>', lead));
  assert.ok(!pageMatchesBusiness('<title>Hambone Plumbing</title><p>Serving Denver, CO</p>', lead)); // wrong city
  assert.ok(!pageMatchesBusiness('<p>Best plumbing in Taylor</p>', lead)); // name missing
  assert.ok(!pageMatchesBusiness('<script>var a="Hambone Taylor"</script>', lead)); // scripts ignored
});

test('self-reported rating from schema.org JSON-LD', () => {
  const html = '<script type="application/ld+json">{"@type":"Plumber","aggregateRating":{"ratingValue":"4.8","reviewCount":"212"}}</script>';
  assert.deepEqual(aggregateRating(html), { rating: 4.8, count: 212 });
  assert.equal(aggregateRating('<script type="application/ld+json">{bad json</script>'), null);
});

test('daily Google call cap', async () => {
  process.env.GOOGLE_DAILY_LIMIT = '3';
  const db = openDb(':memory:');
  assert.equal(await takeGoogle(db, 2), true);
  assert.equal(await takeGoogle(db, 2), false);
  assert.equal(await takeGoogle(db, 1), true);
  delete process.env.GOOGLE_DAILY_LIMIT;
});
