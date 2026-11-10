// Workflow definitions — one per service on the price list (public/pricing.js ids). Used by:
//  • the client portal (which fields to ask for, plain-language access & security notes)
//  • the server (validation; which keys may be stored; which steps are automated)
//  • runbooks for operators / AI agents (steps, security checklist, verification, rollback)
// Secrets are only ever referenced by NAME here. Values live encrypted in the client's own workspace.

// Fields every client fills in (business basics, content, design, public links).
import { TEMPLATES, ALL_PALETTES, ALL_FONTS, DEFAULTS } from './site-template.js';
const opts = (ids, names) => Object.fromEntries(ids.map((id) => [id, names?.[id] ?? id]));
export const PROFILE_FIELDS = [
  { section: 'Your business', fields: [
    { key: 'business.name', label: 'Business name', type: 'text', required: true, max: 80 },
    { key: 'business.tagline', label: 'Your headline', type: 'text', max: 90, placeholder: 'Plumbing done right, the first time.', help: 'The big line visitors see first. Short and confident works best.' },
    { key: 'business.phone', label: 'Phone number', type: 'tel', required: true, max: 30 },
    { key: 'business.city', label: 'City', type: 'text', required: true, max: 60 },
    { key: 'business.since', label: 'Year founded', type: 'year', max: 4, placeholder: '2011' },
    { key: 'business.email', label: 'Email for customers', type: 'email', max: 120 },
    { key: 'business.address', label: 'Street address', type: 'text', max: 160, help: 'Leave blank if you go to your customers.' },
    { key: 'business.hours', label: 'Hours', type: 'textarea', max: 400, placeholder: 'Mon–Fri  7am–6pm\nSat  8am–noon' },
  ] },
  { section: 'What you offer', fields: [
    { key: 'business.services', label: 'Services', type: 'list', required: true, max: 1200, placeholder: 'e.g. Water heaters' },
    { key: 'business.highlights', label: 'Why customers choose you', type: 'list', max: 300, placeholder: 'e.g. Licensed & insured', help: 'Up to 4 short points.' },
    { key: 'business.about', label: 'About you', type: 'textarea', max: 900, placeholder: 'A few sentences about who you are and how you work.' },
    { key: 'content.faq', label: 'Common questions', type: 'faq', max: 2400 },
  ] },
  { section: 'Look & feel', fields: [
    { key: 'brand.template', label: 'Design', type: 'select', options: opts(Object.keys(TEMPLATES), Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, t.name]))), default: DEFAULTS.template },
    { key: 'brand.palette', label: 'Color palette', type: 'select', options: opts(ALL_PALETTES), default: DEFAULTS.palette },
    { key: 'brand.fonts', label: 'Typography', type: 'select', options: opts(ALL_FONTS), default: DEFAULTS.fonts },
  ] },
  { section: 'Links', fields: [
    { key: 'links.booking', label: 'Online booking link', type: 'url', max: 300, help: 'Your public booking page (Square, Calendly…). Adds a "Book online" button.' },
    { key: 'links.review', label: 'Google review link', type: 'url', max: 300, help: 'Google Business Profile → "Ask for reviews".' },
    { key: 'links.ordering', label: 'Online ordering link', type: 'url', max: 300 },
    { key: 'links.facebook', label: 'Facebook', type: 'url', max: 300 },
    { key: 'links.instagram', label: 'Instagram', type: 'url', max: 300 },
    { key: 'links.website', label: 'Your current website', type: 'url', max: 300, help: 'Optional — used for your free security check.' },
  ] },
];

// Practices applied to every engagement (shown to the client in plain language, and in every runbook).
export const UNIVERSAL_SECURITY = [
  'We use invitations and limited roles instead of your passwords wherever a service allows it.',
  'Two-step verification (MFA) must be on for every account we connect.',
  'We only request the access a workflow needs, and we remove our access when setup is done unless you keep a care plan.',
  'Keys you give us are encrypted in your own workspace, never shown to our staff in our tools, and every use is logged for you.',
  'Nothing you enter here is sent to an AI service.',
  'Every change has a rollback plan, and you approve before anything goes live.',
];

// access.kind: 'invite' (you add us as a user — no password shared) · 'self' (you change a setting; we give exact steps) ·
// 'secret' (an API key stored encrypted in your vault; `verify` = read-only connection test we can run).
export const WORKFLOW_DEFS = {
  booking: {
    fields: [{ key: 'wf.booking.services', label: 'Which services can customers book online?', type: 'textarea', max: 600 },
      { key: 'wf.booking.buffer', label: 'Minimum notice before a booking', type: 'select', options: { none: 'None', '2h': '2 hours', '1d': '1 day' }, default: '2h' }],
    access: [
      { kind: 'self', name: 'Booking page link', detail: 'Paste your public booking link under Links. No login needed.' },
      { kind: 'secret', name: 'SQUARE_ACCESS_TOKEN', label: 'Square access token — only if you want us to connect Square automatically', verify: 'square', optional: true,
        detail: 'Square Developer → your app → Production access token. Appointments + read-only locations scope.' },
      { kind: 'secret', name: 'CALENDLY_TOKEN', label: 'Calendly personal access token', verify: 'calendly', optional: true, detail: 'Calendly → Integrations → API & Webhooks.' },
    ],
    security: ['Booking page served over HTTPS', 'Collect only name, contact and appointment details', 'Calendar access limited to booking calendars'],
    steps: [{ auto: true, title: 'Add a "Book online" button to your site using your booking link' }, { auto: false, title: 'Configure services, durations and notice in your booking tool' },
      { auto: false, title: 'Test booking end-to-end with you' }],
    verify: 'A test booking appears on the business calendar and the customer gets a confirmation.',
    rollback: 'Remove the booking button; your booking tool is unchanged.',
  },
  reviews: {
    fields: [{ key: 'wf.reviews.tone', label: 'Tone for review replies', type: 'select', options: { warm: 'Warm & personal', brief: 'Short & professional' }, default: 'warm' }],
    access: [{ kind: 'invite', name: 'Google Business Profile', detail: 'Business Profile → Settings → People & access → Add our setup email as a Manager (not Owner).' },
      { kind: 'self', name: 'Google review link', detail: 'Paste your review link under Links.' }],
    security: ['Manager role only — never Owner', 'No review gating or incentives (Google policy)', 'Replies approved by you before posting during the pilot'],
    steps: [{ auto: true, title: 'Add a "Leave us a review" link to your site' }, { auto: false, title: 'Set up review requests after completed jobs' }, { auto: false, title: 'Agree reply templates with you' }],
    verify: 'A test review request arrives by text/email with the correct link.',
    rollback: 'Turn off review requests and remove our Manager access.',
  },
  textback: {
    fields: [{ key: 'wf.textback.message', label: 'Text sent after a missed call', type: 'textarea', max: 300, default: 'Sorry we missed your call! How can we help? Reply here and we\'ll get right back to you.' }],
    access: [
      { kind: 'self', name: 'Call forwarding', detail: 'We give you the exact forwarding setting for your phone provider; you switch it on.' },
      { kind: 'secret', name: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID', optional: true, detail: 'Only if you use Twilio for texting. Twilio Console → Account info.' },
      { kind: 'secret', name: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token', verify: 'twilio', optional: true, detail: 'Twilio Console → Account info. Use a restricted API key where possible.' },
    ],
    security: ['STOP/opt-out handling enabled', 'Business texting registration (10DLC) in place', 'No sensitive details sent by text'],
    steps: [{ auto: false, title: 'Register / confirm the texting number' }, { auto: false, title: 'Set the missed-call text with your wording' }, { auto: false, title: 'You switch on call forwarding; we test together' }],
    verify: 'A missed test call gets the text within a minute; replying STOP opts out.',
    rollback: 'Switch off forwarding; texting stops immediately.',
  },
  receptionist: {
    fields: [{ key: 'wf.receptionist.greeting', label: 'How should the phone be answered?', type: 'text', max: 200, placeholder: 'Thanks for calling …, how can we help?' },
      { key: 'wf.receptionist.urgent', label: 'What counts as urgent (transfer to a person)?', type: 'textarea', max: 400 },
      { key: 'wf.receptionist.transfer', label: 'Number for urgent transfers', type: 'tel', max: 30 }],
    access: [{ kind: 'invite', name: 'AI receptionist account', detail: 'You own the account in your name; invite our setup email as a team member/admin.' },
      { kind: 'self', name: 'Call forwarding', detail: 'You switch on forwarding for after-hours/overflow; we give exact steps.' }],
    security: ['You own the receptionist account and billing', 'Announce call recording if recording is enabled', 'Healthcare: no patient health details without a signed BAA', 'Urgent calls always reach a person'],
    steps: [{ auto: false, title: 'Configure greeting, FAQs and urgent-transfer rules with your wording' }, { auto: false, title: 'Connect booking (if selected)' }, { auto: false, title: 'Test calls with you before forwarding goes live' }],
    verify: 'Test calls are answered correctly, bookings land on the calendar, urgent calls transfer.',
    rollback: 'Switch off forwarding — calls ring as before.',
  },
  chat: {
    fields: [{ key: 'wf.chat.leadEmail', label: 'Where should new chat leads be sent?', type: 'email', max: 120, help: 'Chat answers come from your Common questions.' }],
    access: [{ kind: 'self', name: 'Website access', detail: 'If you keep your current site, invite us as an editor or we send you a snippet to paste.' }],
    security: ['No passwords, card numbers or health details collected in chat', 'A person can always take over', 'Lead notifications go only to your chosen inbox'],
    steps: [{ auto: true, title: 'Publish your Q&A on your site' }, { auto: false, title: 'Install the chat tool with your answers' }, { auto: false, title: 'Test lead capture with you' }],
    verify: 'A test question gets the right answer and a test lead reaches your inbox.',
    rollback: 'Remove the chat snippet.',
  },
  followup: {
    fields: [{ key: 'wf.followup.delay', label: 'Follow up after how many days of silence?', type: 'select', options: { 2: '2 days', 4: '4 days', 7: '7 days' }, default: '4' },
      { key: 'wf.followup.message', label: 'Your follow-up message', type: 'textarea', max: 600 }],
    access: [{ kind: 'invite', name: 'CRM / job software', detail: 'Invite our setup email with a limited (non-owner) role.' }],
    security: ['Unsubscribe / opt-out in every message', 'Only contacts who asked for a quote are messaged', 'Limited role, removed after setup'],
    steps: [{ auto: false, title: 'Connect to where your quotes live' }, { auto: false, title: 'Set timing and wording with you' }, { auto: false, title: 'Pilot on new quotes only' }],
    verify: 'A test quote gets exactly one follow-up at the agreed time; unsubscribe works.',
    rollback: 'Pause the automation in your CRM.',
  },
  ordering: {
    fields: [{ key: 'wf.ordering.pickup', label: 'Pickup, delivery or both?', type: 'select', options: { pickup: 'Pickup', delivery: 'Delivery', both: 'Both' }, default: 'pickup' }],
    access: [{ kind: 'invite', name: 'Ordering / POS platform', detail: 'Invite our setup email with a manager role — never share your POS owner login.' }],
    security: ['Payments only through your PCI-compliant provider', 'We never see or store card numbers', 'Menu changes approved by you'],
    steps: [{ auto: true, title: 'Add an "Order online" button to your site' }, { auto: false, title: 'Set up menu and pickup/delivery options' }, { auto: false, title: 'Place a test order with you' }],
    verify: 'A test order reaches the kitchen and the customer receives confirmation.',
    rollback: 'Hide the ordering button; your POS is unchanged.',
  },
  intake: {
    fields: [{ key: 'wf.intake.fields', label: 'What do you need from new customers? (one per line)', type: 'textarea', max: 1200 },
      { key: 'wf.intake.destination', label: 'Where should completed forms go?', type: 'text', max: 200 }],
    access: [{ kind: 'invite', name: 'Forms tool & destination system', detail: 'Invite our setup email with a limited role.' }],
    security: ['Forms encrypted in transit (HTTPS)', 'Only fields you actually need', 'Healthcare/legal: a provider that signs a BAA / confidentiality terms', 'A clear retention period'],
    steps: [{ auto: false, title: 'Build the form with your fields' }, { auto: false, title: 'Connect it to where you work' }, { auto: false, title: 'Test with you' }],
    verify: 'A test submission arrives complete in the destination, nothing extra stored.',
    rollback: 'Unpublish the form.',
  },
  website: {
    fields: [{ key: 'wf.website.domain', label: 'Domain to use (if you have one)', type: 'text', max: 120, placeholder: 'yourbusiness.com' }],
    access: [{ kind: 'self', name: 'Domain (DNS)', detail: 'We give you one record to add at your domain provider — or invite us to it. Never share your registrar password.' }],
    security: ['HTTPS everywhere', 'Security headers on every page', 'No plugins or scripts beyond what is needed', 'Email records (SPF/DMARC) checked so your domain can\'t be spoofed'],
    steps: [{ auto: true, title: 'Generate your site from your settings, colors and logo' }, { auto: true, title: 'Run the security check on your current domain' },
      { auto: false, title: 'Connect your domain (one DNS record)' }, { auto: false, title: 'Final review with you' }],
    verify: 'Your site loads over HTTPS on your domain and shows your latest settings.',
    rollback: 'Point your domain back to the previous site.',
  },
};

// Everything a workspace may store as a key: the union of `secret` access items. Anything else is rejected.
export const SECRET_NAMES = Object.fromEntries(Object.values(WORKFLOW_DEFS).flatMap((w) => w.access.filter((a) => a.kind === 'secret').map((a) => [a.name, a])));

export function fieldsFor(workflows) {
  const extra = workflows.filter((w) => WORKFLOW_DEFS[w]).map((w) => ({ section: w, fields: WORKFLOW_DEFS[w].fields }));
  return [...PROFILE_FIELDS, ...extra];
}

// Validate a profile against the field definitions. Unknown keys are dropped; values are trimmed and bounded.
export function validateProfile(input, workflows) {
  const out = {}; const errors = [];
  for (const { fields } of fieldsFor(workflows)) {
    for (const f of fields) {
      let v = input?.[f.key];
      if (v == null || v === '') { if (f.default != null) out[f.key] = String(f.default); continue; }
      v = String(v).replace(/\r/g, '').trim().slice(0, f.max ?? 200);
      if (f.type === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) { errors.push(`${f.label}: use a color like #1f4e79`); continue; }
      if (f.type === 'url') { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; v = u.href; } catch { errors.push(`${f.label}: must be a full link starting with https://`); continue; } }
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { errors.push(`${f.label}: that email doesn't look right`); continue; }
      if (f.type === 'tel' && !/^[0-9+().\-\s]{7,30}$/.test(v)) { errors.push(`${f.label}: that phone number doesn't look right`); continue; }
      if (f.type === 'select' && !(v in f.options)) { errors.push(`${f.label}: choose one of the options`); continue; }
      if (f.type === 'year' && !(/^(19|20)\d{2}$/.test(v) && Number(v) <= new Date().getFullYear())) { errors.push(`${f.label}: use a 4-digit year`); continue; }
      if (f.type === 'list' || f.type === 'faq') v = v.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
      out[f.key] = v;
    }
  }
  return { profile: out, errors };
}

export function missingRequired(profile, workflows) {
  return fieldsFor(workflows).flatMap((s) => s.fields).filter((f) => f.required && !profile?.[f.key]).map((f) => f.label);
}
