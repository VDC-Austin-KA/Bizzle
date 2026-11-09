// Client brief: everything a rep needs before calling — what we know (with sources), which engagement path to
// offer, a call script personalized from observed evidence, objection handling and confidence builders.
// Rule: say only what the data supports. No invented statistics, no criticism of their business.
import { playbookFor } from './playbooks.js';
import { observedGaps, ownershipChange } from './scoring.js';

const COMPANY = () => globalThis.process?.env?.BIZZLE_COMPANY || 'Ackerworks';

// Industry discovery questions that surface (and let the owner quantify) the inefficiency themselves.
const QUESTIONS = {
  hvac_plumbing: ['When you and the techs are on jobs, who answers the phone — and what happens to after-hours emergency calls?', 'In the summer rush, roughly how many calls a week go to voicemail?', 'How long does it usually take to get a quote back to a customer?'],
  roofing_construction: ['After a storm, how do you keep up with the flood of inspection requests?', 'How much of your week goes into writing estimates and proposals?', 'How do you follow up on quotes that went quiet?'],
  auto_repair: ['How many calls a day are customers asking "is my car ready?"', 'Can customers book a slot without calling?', 'How do you explain estimates and get approvals today — phone, text, in person?'],
  restaurant: ['During a rush, who picks up phone orders — and how many do you think get missed?', 'Who replies to online reviews today, and how often does it happen?', 'How do you build the staff schedule each week?'],
  salon_spa: ['When a stylist is mid-service and the phone rings, what happens?', 'How do you handle no-shows and rebooking today?', 'What share of bookings come in by phone versus online?'],
  fitness: ['How fast does someone get a reply after they ask about a trial or membership?', 'How do you spot members who are about to cancel?', 'Who manages class bookings and waitlists?'],
  field_services: ['How do quote requests come in, and how fast can you answer them while crews are out?', 'How are routes and recurring visits scheduled?', 'How do you handle renewals for recurring customers?'],
  veterinary: ['How many front-desk hours go to answering the phone and booking appointments?', 'How are vaccine and wellness reminders sent today?', 'What happens to calls after hours?'],
  dental: ['How many no-shows or late cancellations do you see in a typical week?', 'How much front-desk time goes to confirmations and insurance checks?', 'Can new patients book online, or do they have to call?'],
  medical_clinic: ['How long does intake paperwork take per new patient?', 'What are hold times like at peak hours?', 'How much staff time goes to prior authorizations?'],
  legal: ['How many intake calls turn out not to be a fit for your practice?', 'What happens to a potential client who calls at 7pm?', 'How much attorney time goes into first drafts of routine documents?'],
  accounting: ['During tax season, how much time goes into chasing client documents?', 'How many emails a week are the same few client questions?', 'How is transaction categorization reviewed today?'],
  real_estate: ['How quickly does a new online lead get a response?', 'How long does a listing description and the social posts take you?', 'How are showings scheduled and confirmed?'],
  property_management: ['How do maintenance requests come in, and who triages them?', 'How many tenant questions are repeats of the same few topics?', 'How do you follow up with leasing inquiries?'],
  insurance: ['How do quote requests come in, and how long does pre-filling them take?', 'How are renewals and cross-sell reminders handled?', 'How often do clients call with the same policy questions?'],
};
const GENERIC_QUESTIONS = ['Where does your team spend the most time on repetitive admin?', 'What happens to calls that come in when nobody can pick up?', 'If you got five hours back each week, where would you put them?'];

// Hesitations we hear from owners, with honest responses. {name}/{industry} are filled per lead.
const OBJECTIONS = [
  ['"We\'re too busy for this right now."', 'That\'s exactly why it\'s worth a look — the goal is to take work off your plate, not add to it. The first step is a 20-minute call; if we build anything, we do the setup and you just approve each step.'],
  ['"It sounds expensive."', 'We start with one small workflow so the cost is contained, and we agree up front on what we\'ll measure — missed calls, response time, hours saved. If it isn\'t paying for itself, we change course or stop.'],
  ['"My customers want to talk to a real person."', 'Agreed — and they still will. The tools handle the routine parts (booking, reminders, after-hours answers) and hand real conversations to your team faster. You decide what is automated and what always goes to a person.'],
  ['"We tried software before and nobody used it."', 'That happens when tools get dropped in without training. That\'s why we offer one-on-one sessions with your team on your real day-to-day work, plus simple cheat-sheets — and we check in afterwards to make sure it stuck.'],
  ['"I don\'t trust AI with my business / customer data."', 'Fair concern. Nothing goes live without your sign-off, we use reputable vendors with clear data terms, we keep sensitive information out of AI tools unless the vendor contract covers it, and every change can be rolled back.'],
  ['"Things are working fine as they are."', 'Glad to hear it — we\'re not trying to fix what isn\'t broken. Most owners we talk to just want back a few hours a week. Happy to share a short written assessment either way; you keep it, no obligation.'],
  ['"Just send me some information."', 'Happy to. So I send what\'s relevant rather than a generic brochure — can I ask two quick questions about how calls and scheduling work for you today?'],
  ['"We already use {tool}."', 'Great — that\'s a good foundation. A lot of what we do is help teams get more out of tools they already pay for. A one-on-one session can often unlock features that are sitting unused.'],
];

const CONFIDENCE_BUILDERS = [
  'You approve every step — nothing goes live without your sign-off.',
  'We start with one small pilot on a single workflow, not a big overhaul.',
  'We keep your phone number, your website and the tools you already use wherever possible.',
  'Every change can be rolled back.',
  'We agree up front on what success looks like and measure it together (missed calls, response times, hours saved).',
  'Training is included, so your team owns it afterwards — you\'re not dependent on us.',
  'We\'re local to Central Texas and can meet in person.',
];

const GUARDRAILS = [
  'Lead with what you observed, never with criticism of their business or website.',
  'Don\'t quote statistics we can\'t back up; use their own numbers from the discovery questions instead.',
  'Position the tools as help for their team, never as a replacement for staff.',
  'If they say no, thank them, offer the written assessment, and ask permission to check back in a few months.',
];

function snapshot(b) {
  const w = b.web_signals;
  const facts = [];
  const add = (label, value, source) => value != null && value !== '' && facts.push({ label, value: String(value), source });
  add('Business', b.google_name ?? b.name, b.google_name ? 'Google' : 'Texas Comptroller');
  if (b.legal_name) add('Legal entity', `${b.legal_name}${b.org_type ? ` (${b.org_type})` : ''}`, 'Texas Comptroller');
  add('Address', [b.address, b.city, b.zip].filter(Boolean).join(', '), b.source === 'google_places' ? 'Google' : 'Texas Comptroller');
  add('Phone', b.phone, 'Google');
  add('Website', b.website, b.places_id ? 'Google' : 'Verified domain');
  if (b.places_id) add('Google reviews', `${b.rating ?? '–'}★ from ${b.review_count}`, 'Google');
  else if (w?.self_rating) add('Reviews', `${w.self_rating.rating}★ from ${w.self_rating.count} (self-reported)`, 'Their website');
  if (b.entity_formed_date) add('Entity formed', b.entity_formed_date, 'Texas Comptroller');
  if (b.outlets_total != null) add('Active Texas locations', `${b.outlets_total}${b.outlets_opened_12mo ? ` (${b.outlets_opened_12mo} opened in last 12 months)` : ''}`, 'Texas Comptroller');
  if (b.hq_city) add('Headquarters', `${b.hq_city}, ${b.hq_state ?? 'TX'}`, 'Texas Comptroller');
  if (b.mb_revenue_12mo != null) add('Alcohol sales, last 12 months', `$${b.mb_revenue_12mo.toLocaleString()}`, 'Texas Comptroller');
  if (w?.reachable) {
    const tools = [...w.booking, ...w.ordering, ...w.chat, ...w.reviews];
    add('Tools already on their site', tools.length ? tools.join(', ') : 'none detected', 'Website scan');
  } else if (w?.blocked) add('Website scan', 'site blocks automated checks — look at it before calling', 'Website scan');
  return facts;
}

// Pick the most relevant, positive, evidence-backed reason for the call.
function hook(b, gaps, pb) {
  if (ownershipChange(b)) return `I saw ${b.google_name ?? b.name} recently set up a new Texas entity — congratulations. Transitions like that are often when owners look at how the front office runs.`;
  if (b.outlets_total >= 2 && b.outlets_opened_12mo > 0) return `I saw you've opened a new location this year — congratulations. Keeping phones and scheduling consistent across sites is usually where things start to stretch.`;
  if (b.review_count >= 100 && b.rating >= 4.5) return `You've built a great reputation — ${b.rating} stars from ${b.review_count} Google reviews. Busy businesses like yours are usually the ones losing the most time to phones and scheduling.`;
  if (b.mb_revenue_12mo != null && b.mb_revenue_prev_12mo > 0 && b.mb_revenue_12mo > b.mb_revenue_prev_12mo * 1.1) return 'It looks like business has grown nicely over the last year — growth like that usually puts pressure on the phones and the front of house.';
  if (gaps.has('booking')) return `I was on your website and noticed customers can't book online yet — in ${pb.label.toLowerCase()} that usually means a lot of booking happens by phone.`;
  if (gaps.has('chat')) return 'I was on your website and noticed there isn\'t a way for visitors to text or chat with you after hours.';
  if (gaps.has('website')) return 'I couldn\'t find a website for you online, which usually means most new customers have to call to learn anything.';
  return `We work with ${pb.label.toLowerCase()} businesses here in Central Texas, and I wanted to see whether we might be able to save you some time.`;
}

export function buildOutreach(b, strategy) {
  const pb = playbookFor(b.industry);
  const gaps = new Set(observedGaps(b));
  const name = b.google_name ?? b.name;
  const company = COMPANY();
  const tools = strategy.alreadyUses;

  // Path: teams already paying for tools get the most from training; bigger gaps / busy owners → done-with-you.
  const trainingReasons = [], dwyReasons = [];
  if (tools.length) trainingReasons.push(`They already use ${[...new Set(tools)].join(', ')} — help them get more out of it`);
  if (gaps.size <= 1 && b.web_signals?.reachable) trainingReasons.push('Few tool gaps on their website — they are digitally comfortable');
  if (gaps.size >= 2) dwyReasons.push(`${gaps.size} gaps observed (${[...gaps].join(', ')}) — more to set up than to teach`);
  if (gaps.has('website')) dwyReasons.push('No working website found — needs hands-on setup');
  if (b.outlets_opened_12mo > 0 || ownershipChange(b)) dwyReasons.push('Expanding or under new ownership — owner time is scarce');
  if (b.org_type === 'Sole proprietor' || (b.outlets_total === 1 && !b.review_count)) dwyReasons.push('Small team — owner likely has no time to configure tools');
  const recommended = trainingReasons.length > dwyReasons.length ? 'training' : 'done_with_you';

  const paths = {
    training: {
      title: 'One-on-one training',
      pitch: 'We show you and your team how to get the most out of the tools you have — and the right new ones — on your real day-to-day work.',
      steps: ['Tool audit: what you already pay for and what is going unused', 'Hands-on sessions (about an hour each) with you and your staff on real workflows', 'Simple cheat-sheets / SOPs your team keeps', 'Check-in two weeks later to answer questions and make sure it stuck'],
      why: trainingReasons,
    },
    done_with_you: {
      title: 'Done-with-you setup',
      pitch: 'We take the initiative and do the setup — with your input and sign-off at every step.',
      steps: ['20–30 minute discovery call to map how calls, scheduling and follow-up work today', 'Written plan for one workflow — you approve it before anything is built', 'We set it up using your existing number, website and tools where possible', 'Walkthrough: you review it, request changes, and approve', 'Two-week pilot with your team, measured against what we agreed', 'Review together — keep it, adjust it, or roll it back', 'Training handoff so your team owns it'],
      why: dwyReasons,
    },
  };

  const recUse = strategy.recommended.slice(0, 2).map((u) => u.name.toLowerCase());
  const script = [
    { step: 'Opener (ask permission)', say: `Hi, this is [your name] with ${company}, here in Central Texas. Am I speaking with the owner or manager of ${name}? … I'll be brief — can I take 30 seconds to tell you why I called, and you tell me if it's worth continuing?` },
    { step: 'Why you\'re calling (from what we observed)', say: hook(b, gaps, pb) },
    { step: 'What we do', say: `We help local businesses like yours take repetitive work off the owner's and front desk's plate — things like ${pb.pains.slice(0, 2).map((p) => p.toLowerCase()).join(' and ')} — using tools that work alongside your team, not instead of them.` },
    { step: 'Discovery questions (listen; let them put numbers on it)', ask: [...(QUESTIONS[b.industry] ?? GENERIC_QUESTIONS)] },
    { step: 'Offer both ways of working', say: `There are two ways we usually help. Some owners want us to sit down with their team and show them how to get more out of the tools they have${tools.length ? ` — like ${[...new Set(tools)][0]}` : ''}. Others would rather we take it on and set it up for them, with their sign-off at every step. Which sounds closer to how you like to work?` },
    ...(recUse.length ? [{ step: 'Where we would start', say: `Based on what I saw, I'd start small with ${recUse.join(' or ')} — one workflow, measured over a couple of weeks, and you decide whether to keep it.` }] : []),
    { step: 'Close (small next step)', say: `Would a 20-minute walkthrough next week make sense? I'll bring a short written assessment for ${name} — no cost, and you keep it either way. Does Tuesday or Thursday work better?` },
  ];

  const voicemail = `Hi, this is [your name] with ${company} here in Central Texas, calling for the owner of ${name}. ${hook(b, gaps, pb).split('. ')[0]}. We help local businesses save time on things like ${pb.pains[0].toLowerCase()}. I'd love to share a short written assessment — no cost. You can reach me at [your number]. Again, [your name] with ${company}. Thanks!`;
  const followUp = {
    subject: `Quick idea for ${name}`,
    body: [`Hi [owner name],`, '', `Thanks for taking my call (or sorry I missed you). We help Central Texas ${pb.label.toLowerCase()} businesses take repetitive work off the team's plate.`,
      '', 'What I noticed:', ...(strategy.recommended.length ? strategy.recommended.map((u) => `• ${u.evidence}`) : ['• (add one specific observation from the brief)']),
      '', 'Two ways we can help:', `• ${paths.training.title}: ${paths.training.pitch}`, `• ${paths.done_with_you.title}: ${paths.done_with_you.pitch}`,
      '', 'Either way you approve every step, we start with one small pilot, and everything can be rolled back.',
      '', 'Would a 20-minute walkthrough next week work? I\'ll bring a short written assessment — yours to keep.', '', `[your name]`, `${company} · [your number]`].join('\n'),
  };

  const objections = [...OBJECTIONS, ...pb.objections.map((o) => { const [q, a] = o.split('→'); return [q.trim(), (a ?? '').trim()]; })]
    .filter(([q]) => !q.includes('{tool}') || tools.length)
    .map(([q, a]) => ({ objection: q.replace('{tool}', [...new Set(tools)][0] ?? 'other software'), response: a }));

  return {
    name, company, snapshot: snapshot(b), evidence: strategy.recommended.map((u) => u.evidence),
    recommendedPath: recommended, paths, script, voicemail, followUp, objections,
    confidenceBuilders: CONFIDENCE_BUILDERS, guardrails: GUARDRAILS,
    nextSteps: ['Look at their website and Google listing for 2 minutes before calling', 'Call; leave the voicemail if no answer', 'Send the follow-up email/text the same day', 'Log the outcome and next date in the Pipeline', 'If interested: book the 20-minute walkthrough and prepare the written assessment'],
  };
}

export function briefMarkdown(o) {
  const L = [`# Client brief — ${o.name}`, '', '## What we know', ...o.snapshot.map((f) => `- **${f.label}:** ${f.value} _(${f.source})_`)];
  if (o.evidence.length) L.push('', '## Observed opportunities', ...o.evidence.map((e) => `- ${e}`));
  const rec = o.paths[o.recommendedPath];
  L.push('', `## Recommended approach: ${rec.title}`, rec.pitch, ...rec.why.map((w) => `- ${w}`));
  for (const [k, p] of Object.entries(o.paths)) L.push('', `### ${p.title}${k === o.recommendedPath ? ' (recommended)' : ''}`, p.pitch, ...p.steps.map((s, i) => `${i + 1}. ${s}`));
  L.push('', '## Call script');
  for (const s of o.script) L.push('', `**${s.step}**`, ...(s.say ? [`> ${s.say}`] : []), ...(s.ask ?? []).map((q) => `- ${q}`));
  L.push('', '## Voicemail', `> ${o.voicemail}`, '', '## Follow-up email', `**Subject:** ${o.followUp.subject}`, '', o.followUp.body);
  L.push('', '## Handling hesitation', ...o.objections.flatMap((x) => [`- **${x.objection}** — ${x.response}`]));
  L.push('', '## Building confidence', ...o.confidenceBuilders.map((c) => `- ${c}`), '', '## Guardrails', ...o.guardrails.map((g) => `- ${g}`));
  L.push('', '## Next steps', ...o.nextSteps.map((s) => `- [ ] ${s}`), '');
  return L.join('\n');
}
