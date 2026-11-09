// Single source of truth for pricing — imported by the public quote page (browser) AND the server (which
// recomputes every saved quote). Flat, published prices: the same for every customer.
// Prices are Bizzle's proposed defaults, positioned below published 2026 agency pricing; edit here to change them.

export const TRAINING = {
  session: { label: '1:1 training session', price: 150, detail: '60 minutes with you and up to 2 staff, on your real day-to-day work' },
  pack: { label: 'Training pack (4 sessions)', price: 500, detail: '4 one-hour sessions, cheat-sheets your team keeps, and a check-in 2 weeks later' },
  workshop: { label: 'Team workshop (half-day, on-site)', price: 900, detail: 'Up to 8 people, at your location anywhere in Central Texas' },
};

// Done-with-you workflows. `gap` links a workflow to a gap Bizzle observed on the business's website.
// `software` = typical monthly cost of the third-party tool, paid by the customer directly to the vendor.
export const WORKFLOWS = {
  booking: { label: 'Online booking', size: 'starter', gap: 'booking', weeks: 1,
    detail: 'Customers book 24/7 from your website and Google listing, synced to your calendar.', software: '$0–$69/mo (e.g. Square Appointments, Calendly)' },
  reviews: { label: 'Review requests & replies', size: 'starter', gap: 'reviews', weeks: 1,
    detail: 'Happy customers get a review request automatically; you approve AI-drafted replies.', software: 'Varies by tool — confirmed before you commit' },
  textback: { label: 'Missed-call text-back', size: 'starter', gap: 'chat', weeks: 1,
    detail: 'Every missed call gets an instant text so the customer doesn\'t call the next business.', software: 'Varies with text volume — confirmed before you commit' },
  receptionist: { label: 'AI phone receptionist', size: 'standard', gap: 'chat', weeks: 2,
    detail: 'Answers after-hours and overflow calls, books jobs and hands urgent calls to you.', software: '$50–$300/mo (typical AI receptionist plans)' },
  chat: { label: 'Website chat & lead capture', size: 'standard', gap: 'chat', weeks: 2,
    detail: 'Answers common questions on your site and captures leads straight into your inbox or CRM.', software: 'Varies by tool — confirmed before you commit' },
  followup: { label: 'Quote & lead follow-up', size: 'standard', gap: null, weeks: 2,
    detail: 'Automatic, personal-sounding follow-ups on quotes and inquiries that went quiet.', software: 'Often uses tools you already have' },
  ordering: { label: 'Online ordering', size: 'standard', gap: 'ordering', weeks: 2,
    detail: 'Phone and online ordering that goes straight to your kitchen.', software: 'Varies — many platforms charge per order' },
  intake: { label: 'Intake forms & paperwork', size: 'advanced', gap: null, weeks: 3,
    detail: 'Digital forms that fill your systems automatically — no retyping.', software: 'Varies by tool — confirmed before you commit' },
  website: { label: 'New website with booking & chat', size: 'advanced', gap: 'website', weeks: 3,
    detail: 'Up to 5 pages, mobile-friendly, with booking and chat built in.', software: 'Hosting and domain, typically paid to the host' },
};
export const SIZES = { starter: 750, standard: 1200, advanced: 2000 };
export const EXTRA_LOCATION = 250; // per workflow, per additional location
export const BUNDLE = [[3, 0.15], [2, 0.10]]; // workflows ≥ n → discount on setup

export const CARE = {
  none: { label: 'No care plan', monthly: 0, detail: 'You own it outright. Call us any time at the training rate.' },
  essentials: { label: 'Care — Essentials', monthly: 149, maxWorkflows: 2, detail: 'Monitoring, fixes and up to 1 hour of changes a month. Up to 2 workflows.' },
  plus: { label: 'Care — Plus', monthly: 349, detail: 'Up to 5 workflows, 3 hours of changes, a monthly check-in and a quarterly refresher session.' },
};

export const PAYMENT = {
  split: { label: '50% to start, 50% after you approve the result', discount: 0 },
  full: { label: 'Pay in full up front — 5% off', discount: 0.05 },
  monthly: { label: '3 equal monthly payments, no interest', discount: 0, min: 1000 },
};

export const INCLUDED = [
  'Discovery call to map how things work today',
  'A written plan you approve before anything is built',
  'Setup using your existing phone number, website and tools wherever possible',
  'A walkthrough where you request changes',
  'A 2-week pilot with your team, measured against what we agreed',
  'One training session for your team',
  '30 days of tune-ups after go-live',
];

export const PROMISES = [
  'Same published prices for everyone — no hourly surprises.',
  'You approve the plan before we start and the result before the final payment.',
  'Every change can be rolled back.',
  'Third-party software is paid directly to the vendor. We never mark it up.',
  'Care plans are month-to-month. Cancel any time.',
];

// For context on the quote page: published 2026 pricing guides for AI automation agencies.
export const MARKET = { setup: '$1,500–$5,000', monthly: '$500–$3,500/mo', hourly: '$100–$350/hr' };

const round = (n) => Math.round(n);
const clampInt = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

// Normalize untrusted input (from a browser) into a valid selection. Unknown ids are dropped.
export function normalizeSelection(s = {}) {
  const training = Object.fromEntries(Object.keys(TRAINING).map((k) => [k, clampInt(s.training?.[k], 0, 20)]));
  const workflows = [...new Set((Array.isArray(s.workflows) ? s.workflows : []).filter((w) => WORKFLOWS[w]))];
  return {
    training, workflows,
    locations: clampInt(s.locations ?? 1, 1, 20),
    // Care plans only cover workflows we set up; Essentials covers up to 2, so larger setups need Plus.
    care: !CARE[s.care] || !workflows.length ? 'none' : s.care === 'essentials' && workflows.length > CARE.essentials.maxWorkflows ? 'plus' : s.care,
    payment: PAYMENT[s.payment] ? s.payment : 'split',
  };
}

export function priceQuote(input) {
  const s = normalizeSelection(input);
  const lines = [];
  for (const [k, qty] of Object.entries(s.training)) {
    if (qty) lines.push({ group: 'Training', label: TRAINING[k].label, detail: TRAINING[k].detail, qty, unit: TRAINING[k].price, oneTime: qty * TRAINING[k].price });
  }
  let setup = 0;
  for (const id of s.workflows) {
    const w = WORKFLOWS[id];
    const unit = SIZES[w.size] + (s.locations - 1) * EXTRA_LOCATION;
    setup += unit;
    lines.push({ group: 'Done-with-you setup', label: w.label, detail: `${w.detail}${s.locations > 1 ? ` (${s.locations} locations)` : ''}`, qty: 1, unit, oneTime: unit });
  }
  const bundleRate = BUNDLE.find(([n]) => s.workflows.length >= n)?.[1] ?? 0;
  const bundle = round(setup * bundleRate);
  if (bundle) lines.push({ group: 'Done-with-you setup', label: `Bundle savings (${s.workflows.length} workflows, ${bundleRate * 100}% off setup)`, oneTime: -bundle });

  const care = CARE[s.care];
  if (care.monthly) lines.push({ group: 'Ongoing care (optional)', label: care.label, detail: care.detail, monthly: care.monthly });

  const beforePay = lines.reduce((t, l) => t + (l.oneTime ?? 0), 0);
  const pay = PAYMENT[s.payment].min && beforePay < PAYMENT[s.payment].min ? 'split' : s.payment;
  const payDiscount = round(beforePay * PAYMENT[pay].discount);
  if (payDiscount) lines.push({ group: 'Payment', label: 'Paid in full — 5% off', oneTime: -payDiscount });
  const oneTime = beforePay - payDiscount;
  const monthly = care.monthly;

  const schedule = !oneTime ? [] : pay === 'full' ? [{ when: 'Before we start', amount: oneTime }]
    : pay === 'monthly' ? [0, 1, 2].map((i) => ({ when: i ? `Month ${i + 1}` : 'Before we start', amount: i < 2 ? round(oneTime / 3) : oneTime - 2 * round(oneTime / 3) }))
      : [{ when: 'Before we start', amount: round(oneTime / 2) }, { when: 'After you approve the result', amount: oneTime - round(oneTime / 2) }];

  const weeks = s.workflows.reduce((t, id) => t + WORKFLOWS[id].weeks, 0);
  return {
    selection: { ...s, payment: pay }, lines, oneTime, monthly, schedule,
    software: s.workflows.map((id) => ({ label: WORKFLOWS[id].label, estimate: WORKFLOWS[id].software })),
    timelineWeeks: weeks, included: s.workflows.length ? INCLUDED : [], promises: PROMISES,
  };
}

// Pre-fill from a Bizzle lead: workflows that fix observed gaps, plus the recommended engagement path.
export function suggestSelection({ gaps = [], recommendedPath = 'done_with_you', locations = 1, industry } = {}) {
  const want = new Set();
  if (gaps.includes('booking')) want.add('booking');
  if (gaps.includes('chat')) want.add(['restaurant', 'dental', 'medical_clinic', 'salon_spa', 'veterinary'].includes(industry) ? 'textback' : 'receptionist');
  if (gaps.includes('reviews')) want.add('reviews');
  if (gaps.includes('ordering')) want.add('ordering');
  if (gaps.includes('website')) want.add('website');
  const workflows = recommendedPath === 'training' ? [] : [...want].slice(0, 3);
  return normalizeSelection({ workflows, training: recommendedPath === 'training' ? { pack: 1 } : {}, locations, care: workflows.length ? 'essentials' : 'none' });
}
