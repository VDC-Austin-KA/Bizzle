// Explainable lead scoring from observed data only. A factor whose data hasn't been collected yet
// scores 0 and says so — nothing is guessed. `coverage` tells the rep how complete the picture is.
import { playbookFor } from './playbooks.js';

export const SEGMENTS = {
  rising: 'Up-and-coming',
  popular: 'Popular local favorite',
  anchor: 'Hometown anchor (HQ here)',
  closed: 'Closed per Google',
  standard: 'Standard',
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const yearsSince = (d, now) => (d ? (now - new Date(d)) / (365.25 * 864e5) : null);
const usd = (n) => `$${Math.round(n).toLocaleString()}`;
const growth = (b) => (b.mb_revenue_12mo != null && b.mb_revenue_prev_12mo > 0 ? b.mb_revenue_12mo / b.mb_revenue_prev_12mo - 1 : null);

// Business age: the entity's Texas charter date if known; else this location's first taxable sale.
const businessAge = (b, now) => yearsSince(b.entity_formed_date ?? b.first_sale_date, now);
const ESTABLISHED_REVIEWS = 300; // a young entity with this many reviews is an established brand under new paperwork
const newLocation = (b) => b.outlets_total >= 2 && b.outlets_opened_12mo > 0;
export const ownershipChange = (b, now = Date.now()) => b.entity_formed_date != null && yearsSince(b.entity_formed_date, now) <= 1.5 && b.review_count >= ESTABLISHED_REVIEWS;

export function segmentsFor(b, now = Date.now()) {
  if (b.business_status?.startsWith('CLOSED')) return ['closed'];
  const age = businessAge(b, now);
  const g = growth(b);
  const s = [];
  if ((age != null && age <= 3 && !(b.review_count >= ESTABLISHED_REVIEWS)) || newLocation(b) || (g != null && g >= 0.2)) s.push('rising');
  if ((b.review_count >= 250 && b.rating >= 4.5) || b.mb_revenue_12mo >= 1_000_000) s.push('popular');
  if (b.hq_local && (b.outlets_total >= 3 || (age != null && age >= 10))) s.push('anchor');
  return s.length ? s : ['standard'];
}

// Gaps observed on the business's own website (or absence of one on Google).
export function observedGaps(b) {
  const w = b.web_signals;
  if (!w) return b.places_id && !b.website ? ['website'] : [];
  if (w.blocked || w.unknown) return [];
  if (!w.reachable) return ['website'];
  return [
    !w.booking.length && 'booking',
    !w.chat.length && 'chat',
    !w.reviews.length && 'reviews',
    b.industry === 'restaurant' && !w.ordering.length && 'ordering',
  ].filter(Boolean);
}

export function scoreLead(b, now = Date.now()) {
  const factors = [];
  const add = (key, label, points, max, reasons, known = true) =>
    factors.push({ key, label, points: Math.round(clamp(points, 0, max)), max, reasons, known });

  const pb = playbookFor(b.industry);
  add('fit', 'Industry AI fit', pb.fit * 25, 25, [`${pb.label}${b.naics ? ` (NAICS ${b.naics})` : ''}: ${Math.round(pb.fit * 100)}% fit`], !!b.industry);

  // Digital gaps — from the live website scan.
  const w = b.web_signals;
  if (w?.reachable) {
    let pts = 0; const r = [];
    if (!w.booking.length) { pts += 9; r.push('No online booking/scheduling found'); } else r.push(`Books via ${w.booking.join(', ')}`);
    if (!w.chat.length) { pts += 7; r.push('No chat/text widget found'); } else r.push(`Chat via ${w.chat.join(', ')}`);
    if (!w.reviews.length) { pts += 3; r.push('No review-generation tool found'); }
    if (b.industry === 'restaurant' && !w.ordering.length) { pts += 3; r.push('No online ordering found'); }
    if (!w.mobile_friendly) { pts += 2; r.push('Not mobile-optimized'); }
    if (!w.https) { pts += 1; r.push('No HTTPS'); }
    const stale = w.copyright_year && new Date(now).getFullYear() - w.copyright_year >= 3;
    if (stale) { pts += 2; r.push(`Site footer says © ${w.copyright_year}`); }
    add('gaps', 'Digital gaps (website scan)', pts, 25, r);
  } else if (w && (w.blocked || w.unknown)) add('gaps', 'Digital gaps (website scan)', 0, 25, [`Couldn't check site: ${w.error}`], false);
  else if (w) add('gaps', 'Digital gaps (website scan)', 20, 25, [`Website broken (${w.error})`]);
  else if (b.places_id && !b.website) add('gaps', 'Digital gaps (website scan)', 22, 25, ['No website listed on their Google profile']);
  else add('gaps', 'Digital gaps (website scan)', 0, 25, [b.website ? 'Website not scanned yet' : b.site_search_at ? 'No website found at likely domains — check manually' : 'No website on file — run enrichment'], false);

  // Demand — Google review volume/rating or real alcohol-sales revenue, whichever is stronger.
  const dem = []; let demPts = 0; let demKnown = false;
  if (b.places_id) {
    demKnown = true;
    const rev = clamp(Math.log10((b.review_count ?? 0) + 1) / Math.log10(1000), 0, 1) * 16 + (b.rating >= 4.2 ? 4 : 0);
    demPts = Math.max(demPts, rev); dem.push(`${b.rating ?? '–'}★ from ${b.review_count ?? 0} Google reviews`);
  }
  const self = w?.self_rating;
  if (!b.places_id && self) { // fallback: rating the business publishes on its own site (schema.org) — discounted
    demKnown = true;
    demPts = Math.max(demPts, 0.75 * (clamp(Math.log10(self.count + 1) / Math.log10(1000), 0, 1) * 16 + (self.rating >= 4.2 ? 4 : 0)));
    dem.push(`${self.rating}★ from ${self.count} reviews (self-reported on their website)`);
  }
  if (b.mb_revenue_12mo != null) {
    demKnown = true;
    demPts = Math.max(demPts, clamp((Math.log10(Math.max(b.mb_revenue_12mo, 1)) - 4.5) / 2, 0, 1) * 20);
    dem.push(`${usd(b.mb_revenue_12mo)} alcohol sales, trailing 12 mo (TX Comptroller, through ${b.mb_latest_month})`);
  }
  if (!demKnown && b.places_checked_at) dem.push('No Google listing matched the registry name/address — verify manually');
  add('demand', 'Customer demand', demPts, 20, dem.length ? dem : ['Not checked yet — enrich via Google'], demKnown);

  // Momentum — entity age, new locations, revenue growth (all from state records).
  const g = growth(b);
  let mom = 0; const momR = [];
  if (b.entity_formed_date) {
    const age = yearsSince(b.entity_formed_date, now);
    if (ownershipChange(b, now)) { mom += 5; momR.push(`New Texas entity (${b.entity_formed_date}) behind an established brand — likely new ownership`); }
    else if (age <= 2) { mom += 7; momR.push(`Texas entity formed ${b.entity_formed_date}`); }
    else if (age <= 3) { mom += 5; momR.push(`Texas entity formed ${b.entity_formed_date}`); }
    else momR.push(`Texas entity since ${b.entity_formed_date.slice(0, 4)}`);
  } else if (b.first_sale_date) {
    const age = yearsSince(b.first_sale_date, now);
    if (age < 0) { mom += 7; momR.push(`Newly registered — first sales expected ${b.first_sale_date}`); }
    else if (age <= 3 && !(b.review_count >= ESTABLISHED_REVIEWS)) { mom += age <= 2 ? 7 : 5; momR.push(`Sales-tax permit began ${b.first_sale_date}`); }
    else momR.push(`Sales-tax permit since ${b.first_sale_date.slice(0, 4)}`);
  }
  if (newLocation(b)) { mom += 5; momR.push(`${b.outlets_opened_12mo} of ${b.outlets_total} locations opened in the last 12 months`); }
  if (g != null) { mom += clamp(g / 0.3, 0, 1) * 6; momR.push(`Alcohol sales ${g >= 0 ? '+' : ''}${Math.round(g * 100)}% year over year`); }
  add('momentum', 'Growth momentum', mom, 15, momR.length ? momR : ['No registry or revenue data'], !!(b.entity_formed_date || b.first_sale_date) || g != null);

  // Local roots & scale — taxpayer HQ address and active outlet count from the state registry.
  let loc = 0; const locR = [];
  if (b.hq_local != null) {
    if (b.hq_local) { loc += 8; locR.push(`Headquartered in ${b.hq_city}, TX`); } else locR.push(`HQ outside Central TX (${b.hq_city ?? '?'}, ${b.hq_state ?? '?'})`);
  }
  if (b.outlets_total != null) { loc += clamp((b.outlets_total - 1) * 3, 0, 7); locR.push(`${b.outlets_total} active Texas location(s)`); }
  add('local', 'Local roots & scale', loc, 15, locR.length ? locR : ['No registry data'], b.hq_local != null);

  const closed = b.business_status?.startsWith('CLOSED');
  const score = closed ? 0 : factors.reduce((t, f) => t + f.points, 0);
  const known = factors.filter((f) => f.known);
  return {
    score, tier: score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D',
    coverage: Math.round((known.reduce((t, f) => t + f.max, 0) / 100) * 100),
    factors, segments: segmentsFor(b, now),
  };
}

const PITCH = {
  rising: 'Demand is outpacing your team — add capacity with AI before the next hire.',
  popular: "You're already winning on reputation — AI protects it at volume: every call answered, every review replied to.",
  anchor: 'Hometown leader — modernize operations, keep the local touch, and stay ahead of national chains.',
  standard: 'Low-risk pilot on one costly manual workflow, measured in 30 days.',
  closed: 'Google lists this business as closed — verify before outreach.',
};

// Lead-specific plan: use cases ranked by observed gaps, each with the evidence behind it.
export function strategyFor(b) {
  const pb = playbookFor(b.industry);
  const gaps = new Set(observedGaps(b));
  const scanned = !!b.web_signals?.reachable || gaps.has('website');
  const useCases = pb.useCases
    .filter((u) => u.gap !== 'website' || gaps.has('website'))
    .map((u) => ({ ...u, evidence: gaps.has(u.gap) ? u.why : null }))
    .sort((x, y) => !!y.evidence - !!x.evidence);
  const w = b.web_signals;
  const segs = segmentsFor(b);
  return {
    industry: pb.label,
    pitch: PITCH[segs[0]],
    scanned,
    recommended: useCases.filter((u) => u.evidence),
    otherUseCases: useCases.filter((u) => !u.evidence),
    alreadyUses: w?.reachable ? [...w.booking, ...w.ordering, ...w.chat, ...w.reviews] : [],
    talkingPoints: [
      ...(gaps.has('booking') ? ['Their site has no online booking — demo AI booking live on their own phone number.'] : []),
      ...(gaps.has('chat') ? ['No chat or text-back on their site — ask how they handle after-hours calls and missed leads.'] : []),
      ...(gaps.has('reviews') && b.review_count != null ? [`${b.review_count} Google reviews at ${b.rating}★ — show AI-drafted replies to their latest reviews.`] : []),
      ...(gaps.has('website') ? ['No working website — a site with booking and chat is a quick first win.'] : []),
      ...(newLocation(b) ? ['They just opened a new location — standardize phones and booking across sites now.'] : []),
      ...(ownershipChange(b) ? ['New legal entity behind an established brand — new owners often modernize; get in early.'] : []),
      ...(growth(b) >= 0.2 ? ['Sales are up sharply year over year — position AI as capacity for the growth.'] : []),
    ],
    pains: pb.pains,
    objections: pb.objections,
  };
}
