// Explainable lead scoring, segmentation and strategy generation.
// Everything is pure so it is easy to test and tune.
import { playbookFor } from './playbooks.js';

// Central Texas service area. Core = Austin metro counties (Travis, Williamson, Hays).
export const CITY_COUNTY = {
  'Austin': 'Travis', 'Pflugerville': 'Travis', 'Lakeway': 'Travis', 'Manor': 'Travis',
  'Round Rock': 'Williamson', 'Georgetown': 'Williamson', 'Cedar Park': 'Williamson', 'Leander': 'Williamson', 'Hutto': 'Williamson', 'Taylor': 'Williamson', 'Liberty Hill': 'Williamson',
  'San Marcos': 'Hays', 'Kyle': 'Hays', 'Buda': 'Hays', 'Dripping Springs': 'Hays', 'Wimberley': 'Hays',
  'Bastrop': 'Bastrop', 'Elgin': 'Bastrop', 'Lockhart': 'Caldwell', 'Marble Falls': 'Burnet', 'Burnet': 'Burnet',
  'Temple': 'Bell', 'Killeen': 'Bell', 'Belton': 'Bell', 'Harker Heights': 'Bell',
  'Waco': 'McLennan', 'New Braunfels': 'Comal', 'Seguin': 'Guadalupe',
};
const CORE_COUNTIES = new Set(['Travis', 'Williamson', 'Hays']);

export const SEGMENTS = {
  rising: 'Up-and-coming',
  popular: 'Popular local favorite',
  anchor: 'Hometown anchor (HQ here)',
  standard: 'Standard',
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const velocity = (b) => (b.reviews_last_90d ?? 0) / Math.max(b.review_count ?? 0, 1);

export function segmentsFor(b) {
  const s = [];
  if (b.years_in_business <= 3 && (velocity(b) >= 0.25 || b.hiring || b.new_location)) s.push('rising');
  if (b.review_count >= 300 && b.rating >= 4.5) s.push('popular');
  if (b.locally_headquartered && b.employees >= 50 && b.years_in_business >= 10) s.push('anchor');
  return s.length ? s : ['standard'];
}

// 0–100 opportunity score with a factor-by-factor breakdown so reps can see *why*.
export function scoreLead(b) {
  const factors = [];
  const add = (key, label, points, max, reasons) => factors.push({ key, label, points: Math.round(points), max, reasons });

  const pb = playbookFor(b.industry);
  add('fit', 'Industry AI fit', pb.fit * 30, 30, [`${pb.label}: ${Math.round(pb.fit * 100)}% fit`]);

  let need = 0; const needR = [];
  if (!b.has_website) { need += 5; needR.push('No website'); }
  if (!b.has_online_booking) { need += 8; needR.push('No online booking'); }
  if (!b.has_chat) { need += 5; needR.push('No chat / instant response'); }
  const rr = b.review_response_rate ?? 0;
  need += (1 - rr) * 7; if (rr < 0.3) needR.push(`Responds to only ${Math.round(rr * 100)}% of reviews`);
  add('need', 'Automation need (digital gaps)', need, 25, needR);

  const emp = Math.max(b.employees ?? 1, 1);
  add('capacity', 'Capacity to buy', clamp(Math.log10(emp) / Math.log10(250), 0, 1) * 20, 20, [`${emp} employees`]);

  let mom = 0; const momR = [];
  if (b.hiring) { mom += 5; momR.push('Actively hiring'); }
  if (b.new_location) { mom += 4; momR.push('Opening a new location'); }
  const v = velocity(b); mom += Math.min(6, v * 20);
  if (v >= 0.15) momR.push(`${Math.round(v * 100)}% of reviews in last 90 days`);
  add('momentum', 'Growth momentum', mom, 15, momR);

  const county = CITY_COUNTY[b.city];
  let loc = 0; const locR = [];
  if (b.locally_headquartered) { loc += 5; locR.push('Locally headquartered'); }
  if (CORE_COUNTIES.has(county)) { loc += 5; locR.push(`${county} County (core metro)`); }
  else if (county) { loc += 3; locR.push(`${county} County`); }
  add('locality', 'Central Texas proximity', loc, 10, locR);

  const score = clamp(factors.reduce((t, f) => t + f.points, 0), 0, 100);
  const tier = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
  return { score, tier, factors, segments: segmentsFor(b) };
}

const PITCH = {
  rising: 'Demand is outpacing your team — scale service without adding headcount yet.',
  popular: "You're already winning on reputation — AI protects it at volume: every call answered, every review replied to.",
  anchor: 'Hometown leader — modernize operations, keep the local touch, and stay ahead of national chains moving in.',
  standard: 'Low-risk pilot on one costly manual workflow, measured in 30 days.',
};
const LOADED_HOURLY_RATE = 35; // USD, Central TX front-office loaded cost

// Lead-specific strategy: prioritized use cases, pitch, talking points, ROI.
export function strategyFor(b) {
  const pb = playbookFor(b.industry);
  const gaps = new Set([
    !b.has_online_booking && 'booking',
    !b.has_chat && 'chat',
    (b.review_response_rate ?? 0) < 0.3 && 'reviews',
  ].filter(Boolean));

  const useCases = [...pb.useCases].sort((x, y) => (gaps.has(y.gap) - gaps.has(x.gap)) || y.hoursPerWeek - x.hoursPerWeek);
  const pilot = useCases.slice(0, 2);
  const scale = clamp((b.employees ?? 1) / 10, 0.5, 3);
  const hoursPerWeek = Math.round(pilot.reduce((t, u) => t + u.hoursPerWeek, 0) * scale);
  const annualSavings = hoursPerWeek * 52 * LOADED_HOURLY_RATE;
  const firstYearCost = pilot.reduce((t, u) => t + u.setup + u.monthly * 12, 0);
  const monthlySavings = annualSavings / 12;
  const monthlyFees = pilot.reduce((t, u) => t + u.monthly, 0);
  const setup = pilot.reduce((t, u) => t + u.setup, 0);
  const net = monthlySavings - monthlyFees;
  const paybackMonths = net > 0 ? Math.ceil(setup / net) : null;

  const segs = segmentsFor(b);
  return {
    industry: pb.label,
    pitch: PITCH[segs[0]],
    pains: pb.pains,
    useCases,
    pilot: pilot.map((u) => u.name),
    talkingPoints: [
      ...(gaps.has('booking') ? ['They take bookings by phone only — show a live AI booking demo.'] : []),
      ...(gaps.has('chat') ? ['No instant response channel — quantify leads lost after hours.'] : []),
      ...(gaps.has('reviews') ? ['Unanswered reviews — show their own review page with AI-drafted replies.'] : []),
      ...(b.hiring ? ['They are hiring — position AI as capacity before the next hire.'] : []),
      ...(b.new_location ? ['New location opening — standardize ops across sites from day one.'] : []),
    ],
    objections: pb.objections,
    roi: { hoursPerWeek, annualSavings, firstYearCost, monthlyFees, setup, paybackMonths, hourlyRate: LOADED_HOURLY_RATE },
  };
}
