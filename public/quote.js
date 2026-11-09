// Public quote builder. Same pricing module the server uses (public/pricing.js), so the total shown here is
// exactly what gets saved. Modes: public (default) · shared quote (?q=token) · rep proposal (?lead=id, signed in).
import { TRAINING, WORKFLOWS, SIZES, CARE, PAYMENT, MARKET, EXTRA_LOCATION, priceQuote, suggestSelection, normalizeSelection } from '/pricing.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : String(k))));
  return el;
};
const money = (n) => `$${Math.round(n).toLocaleString()}`;
const params = new URLSearchParams(location.search);
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
};

let sel = normalizeSelection({ training: {}, workflows: [], care: 'none', payment: 'split' });
let mode = 'done_with_you';
let lead = null; let shared = null;

function stepper(value, onChange, min = 0, max = 20) {
  return h('span', { class: 'stepper' },
    h('button', { type: 'button', class: 'ghost', 'aria-label': 'less', onclick: () => onChange(Math.max(min, value - 1)) }, '−'),
    h('b', {}, value),
    h('button', { type: 'button', class: 'ghost', 'aria-label': 'more', onclick: () => onChange(Math.min(max, value + 1)) }, '+'));
}
const update = (patch) => { sel = normalizeSelection({ ...sel, ...patch }); render(); };

function render() {
  const q = priceQuote(sel);
  const showTraining = mode !== 'done_with_you', showSetup = mode !== 'training';
  const choose = h('section', { class: 'card' }, h('h2', {}, '1. How would you like to work with us?'),
    h('div', { class: 'choices' }, [
      ['training', 'Teach my team', 'We train you and your staff to get the most from the right tools.'],
      ['done_with_you', 'Set it up for me', 'We do the setup — you approve every step.'],
      ['both', 'Both', 'We set it up, then train your team to own it.'],
    ].map(([k, t, d]) => h('button', { type: 'button', class: `choice${mode === k ? ' on' : ''}`, onclick: () => { mode = k; if (k === 'training') update({ workflows: [] }); else render(); } }, h('strong', {}, t), h('span', {}, d)))));

  const training = showTraining && h('section', { class: 'card' }, h('h2', {}, `${mode === 'both' ? '2a' : '2'}. Training`),
    Object.entries(TRAINING).map(([k, t]) => h('div', { class: 'option' },
      h('div', {}, h('strong', {}, t.label), h('div', { class: 'muted small' }, t.detail)),
      h('div', { class: 'price' }, money(t.price)), stepper(sel.training[k], (v) => update({ training: { ...sel.training, [k]: v } })))));

  const setup = showSetup && h('section', { class: 'card' }, h('h2', {}, `${mode === 'both' ? '2b' : '2'}. What should we set up?`),
    h('p', { class: 'muted small' }, `Flat price per workflow: ${Object.entries(SIZES).map(([k, v]) => `${k} ${money(v)}`).join(' · ')}. Save 10% on 2 workflows, 15% on 3 or more.`),
    h('div', { class: 'workflows' }, Object.entries(WORKFLOWS).map(([k, w]) => {
      const on = sel.workflows.includes(k);
      return h('label', { class: `wf${on ? ' on' : ''}` },
        h('input', { type: 'checkbox', checked: on, onchange: () => update({ workflows: on ? sel.workflows.filter((x) => x !== k) : [...sel.workflows, k] }) }),
        h('div', {}, h('strong', {}, w.label), h('div', { class: 'small' }, w.detail),
          h('div', { class: 'muted small' }, `About ${w.weeks} week${w.weeks > 1 ? 's' : ''} · software: ${w.software}`)),
        h('div', { class: 'price' }, money(SIZES[w.size])));
    })),
    h('div', { class: 'option' }, h('div', {}, h('strong', {}, 'Locations'), h('div', { class: 'muted small' }, `+${money(EXTRA_LOCATION)} per workflow for each additional location`)),
      h('span'), stepper(sel.locations, (v) => update({ locations: v }), 1)));

  const care = showSetup && sel.workflows.length > 0 && h('section', { class: 'card' }, h('h2', {}, '3. Ongoing care (optional)'),
    Object.entries(CARE).map(([k, c]) => { const off = c.maxWorkflows && sel.workflows.length > c.maxWorkflows; return h('label', { class: `option radio${off ? ' disabled' : ''}` }, h('input', { type: 'radio', name: 'care', disabled: off, checked: sel.care === k, onchange: () => update({ care: k }) }),
      h('div', {}, h('strong', {}, c.label), h('div', { class: 'muted small' }, c.detail), off ? h('div', { class: 'muted small' }, `Covers up to ${c.maxWorkflows} workflows`) : null), h('div', { class: 'price' }, c.monthly ? `${money(c.monthly)}/mo` : '—')); }));

  const payment = q.oneTime > 0 && h('section', { class: 'card' }, h('h2', {}, 'How would you like to pay?'),
    Object.entries(PAYMENT).map(([k, p]) => {
      const beforeDiscount = q.lines.filter((l) => l.group !== 'Payment').reduce((t, l) => t + (l.oneTime ?? 0), 0);
      const disabled = !!p.min && beforeDiscount < p.min;
      return h('label', { class: `option radio${disabled ? ' disabled' : ''}` }, h('input', { type: 'radio', name: 'pay', disabled, checked: q.selection.payment === k, onchange: () => update({ payment: k }) }),
        h('div', {}, h('strong', {}, p.label), disabled ? h('div', { class: 'muted small' }, `Available on quotes over ${money(p.min)}`) : null));
    }));

  // Summary
  const groups = [...new Set(q.lines.map((l) => l.group))];
  const summary = h('aside', { class: 'card summary' }, h('h2', {}, shared ? `Quote for ${shared.business}` : lead ? `Proposal for ${lead.google_name ?? lead.name}` : 'Your quote'),
    q.lines.length === 0 ? h('p', { class: 'muted' }, 'Pick a service to see your price.') : [
      ...groups.flatMap((g) => [h('div', { class: 'grp' }, g), ...q.lines.filter((l) => l.group === g).map((l) => h('div', { class: 'line' },
        h('span', {}, l.qty > 1 ? `${l.label} × ${l.qty}` : l.label), h('span', { class: l.oneTime < 0 ? 'save' : '' }, l.monthly ? `${money(l.monthly)}/mo` : (l.oneTime < 0 ? `−${money(-l.oneTime)}` : money(l.oneTime)))))]),
      h('div', { class: 'total' }, h('span', {}, 'One-time'), h('b', {}, money(q.oneTime))),
      q.monthly ? h('div', { class: 'total' }, h('span', {}, 'Monthly (cancel any time)'), h('b', {}, `${money(q.monthly)}/mo`)) : null,
      q.schedule.length > 0 && h('div', { class: 'small' }, h('div', { class: 'grp' }, 'Payment schedule'), q.schedule.map((s) => h('div', { class: 'line' }, h('span', {}, s.when), h('span', {}, money(s.amount))))),
      q.timelineWeeks > 0 && h('p', { class: 'small' }, `About ${q.timelineWeeks} week${q.timelineWeeks > 1 ? 's' : ''}, one workflow at a time so your team isn't overwhelmed.`),
      q.software.length > 0 && h('div', { class: 'small' }, h('div', { class: 'grp' }, 'Software you pay the vendor directly (no markup)'),
        q.software.map((s) => h('div', { class: 'line' }, h('span', {}, s.label), h('span', { class: 'muted' }, s.estimate)))),
    ],
    h('div', { class: 'market small' }, h('strong', {}, 'For comparison: '), `published 2026 pricing guides put typical AI-automation agencies at ${MARKET.setup} to set up plus ${MARKET.monthly}, and AI consultants at ${MARKET.hourly}.`),
    h('ul', { class: 'promises small' }, q.promises.map((p) => h('li', {}, p))),
    q.included.length > 0 && h('details', { class: 'small' }, h('summary', {}, 'Included with every setup'), h('ul', {}, q.included.map((i) => h('li', {}, i)))),
    h('p', { class: 'no-print' }, h('button', { type: 'button', class: 'ghost', onclick: () => window.print() }, 'Print / save PDF')));

  $('#quote').replaceChildren(...[
    h('div', { class: 'hero' }, h('h1', {}, 'Simple, flat pricing. No surprises.'),
      h('p', {}, 'We help local businesses save time with AI — either by training your team, or by setting things up with you, one approved step at a time.')),
    lead ? h('p', { class: 'banner no-print' }, `Rep mode: pre-filled from what Bizzle observed about ${lead.google_name ?? lead.name}. Adjust, then save as a proposal to share.`) : null,
    h('div', { class: 'quote-grid' }, h('div', {}, choose, training, setup, care, payment, q.lines.length ? (lead ? saveProposal(q) : requestForm(q)) : null), summary)].filter(Boolean));
}

function requestForm(q) {
  const out = h('p', { class: 'small' });
  const form = h('form', { class: 'card request no-print', onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      const r = await api('/api/public/quotes', { selection: q.selection, website_url: f.website_url, contact: { name: f.name, business: f.business, email: f.email, phone: f.phone, city: f.city, message: f.message } });
      form.replaceChildren(h('h2', {}, 'Thanks — we\'ll be in touch within one business day.'),
        h('p', {}, 'Your quote is saved. Bookmark or share this link: '), r.token ? h('a', { href: `/quote?q=${r.token}` }, `${location.origin}/quote?q=${r.token}`) : null);
    } catch (x) { out.textContent = x.message; btn.disabled = false; }
  } }, h('h2', {}, shared ? 'Looks good? Let\'s talk.' : '4. Send me this quote'),
  h('p', { class: 'muted small' }, 'No obligation. We\'ll confirm software costs with the vendors and answer any questions before you commit.'),
  h('div', { class: 'fields' },
    h('input', { name: 'name', placeholder: 'Your name', required: true, autocomplete: 'name' }),
    h('input', { name: 'business', placeholder: 'Business name', required: true, value: shared?.business ?? '', autocomplete: 'organization' }),
    h('input', { name: 'email', type: 'email', placeholder: 'Email', autocomplete: 'email' }),
    h('input', { name: 'phone', type: 'tel', placeholder: 'Phone', autocomplete: 'tel' }),
    h('input', { name: 'city', placeholder: 'City' })),
  h('input', { name: 'website_url', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }), // honeypot
  h('textarea', { name: 'message', placeholder: 'Anything we should know? (optional)' }),
  h('button', {}, 'Send me this quote'), out);
  return form;
}

function saveProposal(q) {
  const out = h('div', { class: 'small' });
  return h('div', { class: 'card no-print' }, h('h2', {}, 'Save proposal'),
    h('button', { type: 'button', onclick: async () => {
      try {
        const r = await api('/api/quotes', { lead_id: lead.id, selection: q.selection });
        const url = `${location.origin}/quote?q=${r.token}`;
        out.replaceChildren('Saved. Share this link with the customer: ', h('a', { href: url, target: '_blank' }, url), ' ',
          h('button', { type: 'button', class: 'ghost', onclick: () => navigator.clipboard.writeText(url) }, 'Copy link'));
      } catch (x) { out.textContent = x.message; }
    } }, 'Save & get a shareable link'), out);
}

async function init() {
  if (params.get('q')) {
    try { shared = await api(`/api/public/quotes/${encodeURIComponent(params.get('q'))}`); sel = normalizeSelection(shared.selection); }
    catch { /* fall through to a blank quote */ }
    mode = sel.workflows.length && Object.values(sel.training).some(Boolean) ? 'both' : sel.workflows.length ? 'done_with_you' : 'training';
  } else if (params.get('lead')) {
    try {
      lead = await api(`/api/leads/${encodeURIComponent(params.get('lead'))}`);
      const gaps = (lead.strategy?.recommended ?? []).map((u) => u.gap);
      mode = lead.strategy?.outreach?.recommendedPath ?? 'done_with_you';
      sel = suggestSelection({ gaps, recommendedPath: mode, locations: lead.outlets_total > 1 && lead.outlets_total <= 5 ? lead.outlets_total : 1, industry: lead.industry });
    } catch { lead = null; }
  }
  render();
}
init();
