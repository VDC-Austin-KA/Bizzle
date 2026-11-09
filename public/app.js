// Bizzle SPA — zones are shown only if the signed-in role holds the permission.
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
const money = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json' }, body: opts.body && JSON.stringify(opts.body) });
  const data = await res.json();
  if (res.status === 401 && path !== '/api/login') { renderLogin(); throw new Error('signed out'); }
  if (!res.ok) throw new Error(data.error);
  return data;
}

let me, meta;
const can = (p) => me?.permissions.includes(p);
const ZONES = [
  ['leads', 'Lead Finder', 'leads:read', renderLeads],
  ['pipeline', 'Pipeline', 'pipeline:write', renderPipeline],
  ['analytics', 'Analytics', 'analytics:read', renderAnalytics],
  ['admin', 'Admin', 'admin:users', renderAdmin],
];

function renderLogin(msg) {
  me = null; $('#nav').replaceChildren(); $('#who').replaceChildren(); $('#drawer').hidden = true;
  const err = h('p', { class: 'error' }, msg ?? '');
  const form = h('form', { class: 'card login', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    try { await api('/api/login', { method: 'POST', body: { email: f.get('email'), password: f.get('password') } }); boot(); }
    catch (x) { err.textContent = x.message; }
  } },
  h('h2', {}, 'Sign in'), h('input', { name: 'email', type: 'email', placeholder: 'Email', required: true, autocomplete: 'username' }),
  h('input', { name: 'password', type: 'password', placeholder: 'Password', required: true, autocomplete: 'current-password' }),
  h('button', {}, 'Sign in'), err);
  $('#main').replaceChildren(form);
}

async function boot() {
  try { me = await api('/api/me'); meta = await api('/api/meta'); } catch { return; }
  const zones = ZONES.filter(([, , perm]) => can(perm));
  $('#who').replaceChildren(`${me.name} · ${me.role} `, h('button', { class: 'link', onclick: async () => { await api('/api/logout', { method: 'POST' }); renderLogin(); } }, 'Sign out'));
  const go = (id) => {
    const z = zones.find((x) => x[0] === id) ?? zones[0];
    $('#nav').querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.zone === z[0]));
    $('#drawer').hidden = true;
    z[3]();
  };
  $('#nav').replaceChildren(...zones.map(([id, label]) => h('a', { href: `#${id}`, 'data-zone': id }, label)));
  window.onhashchange = () => go(location.hash.slice(1));
  go(location.hash.slice(1));
}

const segChips = (segs) => segs.map((s) => h('span', { class: `chip seg-${s}` }, meta.segments[s]));
const tier = (l) => h('span', { class: `tier tier-${l.tier}` }, `${l.score} · ${l.tier}`);
const select = (name, opts, label) => h('select', { name }, h('option', { value: '' }, label), ...Object.entries(opts).map(([v, t]) => h('option', { value: v }, t)));

// ---------- Lead Finder ----------
async function renderLeads() {
  const table = h('div');
  const filters = h('form', { class: 'filters', oninput: () => load() },
    h('input', { name: 'q', placeholder: 'Search name…' }),
    select('segment', meta.segments, 'All segments'),
    select('city', Object.fromEntries(meta.cities.map((c) => [c, c])), 'All cities'),
    select('industry', meta.industries, 'All industries'),
    h('label', {}, 'Min score ', h('input', { name: 'minScore', type: 'number', min: 0, max: 100, value: 0 })));
  async function load() {
    const params = new URLSearchParams([...new FormData(filters)].filter(([, v]) => v));
    const leads = await api(`/api/leads?${params}`);
    table.replaceChildren(h('p', { class: 'muted' }, `${leads.length} leads`), h('table', {},
      h('thead', {}, h('tr', {}, ...['Business', 'City', 'Industry', 'Segments', 'Stage', 'Score'].map((t) => h('th', {}, t)))),
      h('tbody', {}, leads.map((l) => h('tr', { class: 'click', onclick: () => openLead(l.id) },
        h('td', {}, l.name), h('td', {}, l.city ?? ''), h('td', {}, meta.industries[l.industry] ?? l.industry ?? ''),
        h('td', {}, segChips(l.segments)), h('td', {}, l.stage), h('td', {}, tier(l)))))));
  }
  $('#main').replaceChildren(h('h1', {}, 'Lead Finder'),
    h('p', { class: 'muted' }, 'Central Texas businesses ranked by AI-implementation opportunity.'),
    can('leads:write') ? renderSourcing(load) : null, filters, table);
  load();
}

function renderSourcing(reload) {
  const out = h('span', { class: 'muted' });
  const csv = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    const file = csv.querySelector('input[type=file]').files[0];
    if (!file) return;
    try { const r = await api('/api/leads/import', { method: 'POST', body: { csv: await file.text() } });
      out.textContent = `Imported ${r.imported}, skipped ${r.skipped}${r.errors.length ? `, errors: ${r.errors.join('; ')}` : ''}`; reload(); }
    catch (x) { out.textContent = x.message; }
  } }, h('strong', {}, 'Import CSV '), h('input', { type: 'file', accept: '.csv' }), h('button', {}, 'Import'));
  const disc = h('form', { onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(disc));
    try { const r = await api('/api/discover', { method: 'POST', body: f }); out.textContent = `Discovered ${r.imported} new leads`; reload(); }
    catch (x) { out.textContent = x.message; }
  } }, h('strong', {}, 'Discover '), h('input', { name: 'query', placeholder: 'e.g. HVAC contractor', required: true }),
  select('city', Object.fromEntries(meta.cities.map((c) => [c, c])), 'City…'), select('industry', meta.industries, 'Tag industry…'),
  h('button', { disabled: !meta.placesEnabled, title: meta.placesEnabled ? '' : 'Set GOOGLE_PLACES_API_KEY on the server' }, 'Search Google Places'));
  return h('details', { class: 'card' }, h('summary', {}, 'Source new leads'), csv, disc, out);
}

// ---------- Lead detail drawer (Strategy + Pipeline controls) ----------
async function openLead(id) {
  const l = await api(`/api/leads/${id}`);
  const d = $('#drawer'); d.hidden = false;
  const bars = l.factors.map((f) => {
    const fill = h('div', { class: 'fill' }); fill.style.width = `${(f.points / f.max) * 100}%`;
    return h('div', { class: 'factor' }, h('div', { class: 'row' }, h('span', {}, f.label), h('span', {}, `${f.points}/${f.max}`)),
      h('div', { class: 'bar' }, fill), h('small', { class: 'muted' }, f.reasons.join(' · ')));
  });
  const s = l.strategy;
  d.replaceChildren(
    h('button', { class: 'close', onclick: () => { d.hidden = true; } }, '×'),
    h('h2', {}, l.name), h('p', {}, segChips(l.segments), ' ', tier(l)),
    h('p', { class: 'muted' }, [l.city, l.phone, l.website].filter(Boolean).join(' · ')),
    h('p', { class: 'muted' }, `${l.employees} employees · ${l.years_in_business} yrs · ★${l.rating} (${l.review_count} reviews)`),
    h('h3', {}, 'Why this score'), ...bars,
    s && h('section', {}, h('h3', {}, `Strategy — ${s.industry}`), h('p', { class: 'pitch' }, s.pitch),
      h('h4', {}, 'Recommended pilot'), h('ul', {}, s.pilot.map((p) => h('li', {}, p))),
      h('h4', {}, 'Estimated ROI'),
      h('p', {}, `~${s.roi.hoursPerWeek} hrs/week saved → ${money(s.roi.annualSavings)}/yr at $${s.roi.hourlyRate}/hr. ` +
        `Pilot: ${money(s.roi.setup)} setup + ${money(s.roi.monthlyFees)}/mo. Payback: ${s.roi.paybackMonths ? `${s.roi.paybackMonths} mo` : 'n/a'}.`),
      s.talkingPoints.length > 0 && [h('h4', {}, 'Talking points'), h('ul', {}, s.talkingPoints.map((t) => h('li', {}, t)))],
      h('h4', {}, 'Likely pains'), h('ul', {}, s.pains.map((t) => h('li', {}, t))),
      s.objections.length > 0 && [h('h4', {}, 'Objection handling'), h('ul', {}, s.objections.map((t) => h('li', {}, t)))],
      h('h4', {}, 'All use cases'), h('ul', {}, s.useCases.map((u) => h('li', {}, `${u.name} — ${money(u.setup)} + ${money(u.monthly)}/mo`)))),
    can('pipeline:write') && pipelineForm(l),
    h('h3', {}, 'Activity'), h('ul', { class: 'activity' }, l.activities.map((a) => h('li', {}, h('small', { class: 'muted' }, `${a.created_at} · ${a.user ?? ''} · ${a.kind}`), h('div', {}, a.body)))));
}

function pipelineForm(l) {
  const form = h('form', { class: 'card', onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    try { await api(`/api/leads/${l.id}`, { method: 'PATCH', body: { stage: f.stage, est_value: Number(f.est_value), note: f.note || undefined } }); openLead(l.id); }
    catch (x) { alert(x.message); }
  } }, h('h3', {}, 'Pipeline'),
  h('select', { name: 'stage' }, meta.stages.map((s) => h('option', { value: s, selected: s === l.stage }, s))),
  h('label', {}, 'Est. value $', h('input', { name: 'est_value', type: 'number', min: 0, value: l.est_value })),
  h('textarea', { name: 'note', placeholder: 'Log a call, meeting or note…' }), h('button', {}, 'Save'));
  return form;
}

// ---------- Pipeline ----------
async function renderPipeline() {
  const mine = h('input', { type: 'checkbox', onchange: () => load() });
  const board = h('div', { class: 'board' });
  async function load() {
    const leads = await api(`/api/leads${mine.checked ? '?mine=1' : ''}`);
    board.replaceChildren(...meta.stages.map((st) => {
      const col = leads.filter((l) => l.stage === st);
      return h('div', { class: 'col' }, h('h3', {}, `${st} (${col.length})`), h('small', { class: 'muted' }, money(col.reduce((t, l) => t + l.est_value, 0))),
        col.map((l) => h('div', { class: 'card click', onclick: () => openLead(l.id) }, h('strong', {}, l.name), h('div', {}, tier(l), ' ', l.city ?? ''))));
    }));
  }
  $('#main').replaceChildren(h('h1', {}, 'Pipeline'), h('label', {}, mine, ' Only my leads'), board);
  load();
}

// ---------- Analytics ----------
async function renderAnalytics() {
  const a = await api('/api/analytics');
  const barList = (title, obj, labels = {}) => {
    const max = Math.max(1, ...Object.values(obj));
    return h('div', { class: 'card' }, h('h3', {}, title), Object.entries(obj).sort((x, y) => y[1] - x[1]).map(([k, v]) => {
      const fill = h('div', { class: 'fill' }); fill.style.width = `${(v / max) * 100}%`;
      return h('div', { class: 'factor' }, h('div', { class: 'row' }, h('span', {}, labels[k] ?? k), h('span', {}, v)), h('div', { class: 'bar' }, fill));
    }));
  };
  const open = a.funnel.filter((f) => !['won', 'lost'].includes(f.stage));
  const won = a.funnel.find((f) => f.stage === 'won');
  $('#main').replaceChildren(h('h1', {}, 'Analytics'),
    h('div', { class: 'kpis' },
      [['Leads', a.total], ['Avg score', a.avgScore], ['A-tier', a.byTier.A ?? 0], ['Open pipeline', money(open.reduce((t, f) => t + f.value, 0))], ['Won', money(won.value)]]
        .map(([k, v]) => h('div', { class: 'card kpi' }, h('small', { class: 'muted' }, k), h('div', { class: 'big' }, v)))),
    h('div', { class: 'grid' },
      barList('Pipeline funnel (count)', Object.fromEntries(a.funnel.map((f) => [f.stage, f.count]))),
      barList('Segments', a.bySegment, meta.segments), barList('Tiers', a.byTier),
      barList('Cities', a.byCity), barList('Industries', a.byIndustry),
      h('div', { class: 'card' }, h('h3', {}, 'Top open opportunities'), h('ol', {}, a.topOpportunities.map((l) =>
        h('li', { class: 'click', onclick: () => openLead(l.id) }, `${l.name} (${l.city}) `, tier(l)))))));
}

// ---------- Admin ----------
async function renderAdmin() {
  const users = await api('/api/users');
  const out = h('span', { class: 'error' });
  const form = h('form', { class: 'card filters', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('/api/users', { method: 'POST', body: Object.fromEntries(new FormData(form)) }); renderAdmin(); }
    catch (x) { out.textContent = x.message; }
  } }, h('input', { name: 'name', placeholder: 'Name', required: true }), h('input', { name: 'email', type: 'email', placeholder: 'Email', required: true }),
  h('select', { name: 'role' }, ['sales', 'analyst', 'owner'].map((r) => h('option', { value: r }, r))),
  h('input', { name: 'password', type: 'password', placeholder: 'Temp password (10+)', minlength: 10, required: true }), h('button', {}, 'Add user'), out);
  $('#main').replaceChildren(h('h1', {}, 'Admin — Users & Roles'), form, h('table', {},
    h('thead', {}, h('tr', {}, ['Name', 'Email', 'Role', 'Created'].map((t) => h('th', {}, t)))),
    h('tbody', {}, users.map((u) => h('tr', {}, h('td', {}, u.name), h('td', {}, u.email), h('td', {}, u.role), h('td', {}, u.created_at))))));
}

boot();
