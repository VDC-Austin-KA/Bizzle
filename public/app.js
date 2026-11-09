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
  ['account', 'Account', null, renderAccount],
];

async function renderLogin(msg) {
  me = null; $('#nav').replaceChildren(); $('#who').replaceChildren(); $('#drawer').hidden = true;
  const err = h('p', { class: 'error' }, msg ?? '');
  const signIn = async (email, password) => {
    try { const r = await api('/api/login', { method: 'POST', body: { email, password } }); location.hash = r.home; boot(); }
    catch (x) { err.textContent = x.message; }
  };
  const form = h('form', { class: 'card login', onsubmit: (e) => { e.preventDefault(); const f = new FormData(form); signIn(f.get('email'), f.get('password')); } },
    h('h2', {}, 'Sign in'), h('input', { name: 'email', type: 'email', placeholder: 'Email', required: true, autocomplete: 'username' }),
    h('input', { name: 'password', type: 'password', placeholder: 'Password', required: true, autocomplete: 'current-password' }),
    h('button', {}, 'Sign in'), err);
  $('#main').replaceChildren(form);
  // Alpha mode: one-click demo accounts, one per access portal (same pattern as ShoalCreekClean).
  const cfg = await api('/api/auth/config').catch(() => ({}));
  if (cfg.alpha) form.append(h('div', { class: 'demo' },
    h('small', { class: 'muted' }, `Alpha demo accounts · password ${cfg.password}`),
    h('div', { class: 'demo-buttons' }, cfg.accounts.map((a) => h('button', { type: 'button', class: 'ghost',
      onclick: () => { form.email.value = a.email; form.password.value = cfg.password; signIn(a.email, cfg.password); } }, a.label)))));
}

async function boot() {
  try { me = await api('/api/me'); meta = await api('/api/meta'); } catch { return; }
  const zones = ZONES.filter(([, , perm]) => !perm || can(perm));
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
const tier = (l) => h('span', { class: `tier tier-${l.tier}`, title: `${l.coverage}% of score inputs checked` }, `${l.score} · ${l.tier}`);
const select = (name, opts, label) => h('select', { name }, label != null && h('option', { value: '' }, label), ...Object.entries(opts).map(([v, t]) => h('option', { value: v }, t)));
// Only http(s) links are rendered — URLs come from third-party data.
const link = (url, text) => (/^https?:\/\//i.test(url ?? '') ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text ?? url) : null);
const date = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');
const stars = (l) => (l.places_id ? `${l.rating ?? '–'}★ (${l.review_count})` : l.places_checked_at ? 'not found' : '—');

// ---------- Lead Finder ----------
async function renderLeads() {
  const table = h('div');
  const filters = h('form', { class: 'filters', oninput: () => load() },
    h('input', { name: 'q', placeholder: 'Search name or address…' }),
    select('segment', meta.segments, 'Open businesses (all segments)'),
    select('county', Object.fromEntries(Object.values(meta.counties).map((c) => [c, `${c} County`])), 'All counties'),
    select('city', Object.fromEntries(meta.cities.map((c) => [c, c])), 'All cities'),
    select('industry', meta.industries, 'All industries'),
    h('label', {}, 'Min score ', h('input', { name: 'minScore', type: 'number', min: 0, max: 100, value: 0 })),
    h('label', {}, h('input', { type: 'checkbox', name: 'enriched', value: '1' }), ' Enriched only'));
  async function load() {
    const params = new URLSearchParams([...new FormData(filters)].filter(([, v]) => v));
    const leads = await api(`/api/leads?${params}`);
    table.replaceChildren(h('p', { class: 'muted' }, `${leads.length} leads${leads.length ? '' : ' — use “Source new leads” to pull real businesses from the Texas Comptroller or Google.'}`),
      leads.length > 0 && h('table', {},
        h('thead', {}, h('tr', {}, ...['Business', 'City', 'Industry', 'Google', 'Segments', 'Stage', 'Score'].map((t) => h('th', {}, t)))),
        h('tbody', {}, leads.map((l) => h('tr', { class: 'click', onclick: () => openLead(l.id) },
          h('td', {}, l.name, l.google_name && l.google_name.toLowerCase() !== l.name.toLowerCase() ? h('div', { class: 'muted small' }, `Google: ${l.google_name}`) : null),
          h('td', {}, l.city ?? ''), h('td', {}, meta.industries[l.industry] ?? l.google_category ?? ''),
          h('td', {}, stars(l)), h('td', {}, segChips(l.segments)), h('td', {}, l.stage),
          h('td', {}, tier(l), h('div', { class: 'muted small' }, `${l.coverage}% checked`)))))));
  }
  $('#main').replaceChildren(h('h1', {}, 'Lead Finder'),
    h('p', { class: 'muted' }, 'Real Central Texas businesses from the Texas Comptroller registry and Google, scored on observed data only.'),
    can('leads:write') ? renderSourcing(load) : null, filters, table);
  load();
}

function renderSourcing(reload) {
  const out = h('pre', { class: 'log' });
  const run = (form, fn) => async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button'); btn.disabled = true; out.textContent = 'Working…';
    try { out.textContent = await fn(new FormData(form)); reload(); } catch (x) { out.textContent = x.message; } finally { btn.disabled = false; }
  };
  const registry = h('form', { class: 'source' });
  registry.onsubmit = run(registry, async (f) => {
    const r = await api('/api/discover/registry', { method: 'POST', body: {
      counties: f.getAll('counties'), industry: f.get('industry'), openedWithinYears: Number(f.get('within')) || undefined,
      sort: f.get('sort'), limit: Number(f.get('limit')), includeSoleProprietors: f.get('sole') === '1' } });
    return `Texas Comptroller: ${r.found} active permit holders → ${r.created} new, ${r.updated} refreshed. Run “Enrich” to pull Google + website data.`;
  });
  registry.append(h('strong', {}, 'Texas Comptroller registry'),
    h('div', { class: 'counties' }, Object.entries(meta.counties).map(([code, name]) =>
      h('label', {}, h('input', { type: 'checkbox', name: 'counties', value: code, checked: ['227', '246', '105'].includes(code) }), ` ${name}`))),
    select('industry', meta.industries, null),
    h('select', { name: 'within' }, [['', 'Any age'], ['1', 'Opened ≤ 1 yr'], ['2', '≤ 2 yrs'], ['3', '≤ 3 yrs'], ['5', '≤ 5 yrs']].map(([v, t]) => h('option', { value: v }, t))),
    h('select', { name: 'sort' }, h('option', { value: 'newest' }, 'Newest first'), h('option', { value: 'established' }, 'Longest-established first')),
    h('select', { name: 'limit' }, [25, 50, 100, 200].filter((n) => n <= meta.maxRegistryImport).map((n) => h('option', { value: n }, `${n} max`))),
    h('label', {}, h('input', { type: 'checkbox', name: 'sole', value: '1' }), ' Include sole proprietors'),
    h('button', {}, 'Import'));

  const google = h('form', { class: 'source' });
  google.onsubmit = run(google, async (f) => {
    const r = await api('/api/discover/places', { method: 'POST', body: Object.fromEntries(f) });
    return `Google: ${r.found} businesses → ${r.created} new, ${r.updated} merged.`;
  });
  google.append(h('strong', {}, 'Google search'), h('input', { name: 'query', placeholder: 'e.g. family dentist', required: true }),
    h('input', { name: 'city', placeholder: 'City, e.g. Round Rock', required: true }), select('industry', meta.industries, 'Tag industry…'),
    h('button', { disabled: !meta.placesEnabled, title: meta.placesEnabled ? '' : 'Set GOOGLE_PLACES_API_KEY on the server' }, 'Search'));

  const enrich = h('form', { class: 'source' });
  enrich.onsubmit = run(enrich, async (f) => {
    const queue = await api(`/api/enrich/queue?${new URLSearchParams({ limit: f.get('limit'), industry: f.get('industry') })}`);
    if (!queue.length) return 'Nothing left to enrich.';
    const lines = [];
    for (const [i, q] of queue.entries()) { // one lead per request keeps each call small
      out.textContent = `Enriching ${i + 1}/${queue.length}: ${q.name}…\n${lines.join('\n')}`;
      try { const r = await api(`/api/leads/${q.id}/enrich`, { method: 'POST' }); lines.unshift(`${q.name}\n  ${r.log.join('\n  ')}`); }
      catch (x) { lines.unshift(`${q.name}\n  failed: ${x.message}`); }
    }
    return `Enriched ${queue.length} leads\n${lines.join('\n')}`;
  });
  enrich.append(h('strong', {}, 'Enrich'), h('span', { class: 'muted' }, 'Google listing → website scan → registry/alcohol-sales data, for not-yet-enriched leads'),
    select('industry', meta.industries, 'Any industry'), h('select', { name: 'limit' }, [10, 25, 50].map((n) => h('option', { value: n }, `${n} leads`))), h('button', {}, 'Enrich'));

  const csv = h('form', { class: 'source' });
  csv.onsubmit = run(csv, async () => {
    const file = csv.querySelector('input[type=file]').files[0];
    if (!file) return 'Choose a CSV file first.';
    const r = await api('/api/leads/import', { method: 'POST', body: { csv: await file.text() } });
    return `CSV: ${r.created} new, ${r.merged} merged${r.errors.length ? `\n${r.errors.join('\n')}` : ''}`;
  });
  csv.append(h('strong', {}, 'Your own list (CSV)'), h('span', { class: 'muted' }, 'columns: name, address, city, zip, phone, website, industry'),
    h('input', { type: 'file', accept: '.csv' }), h('button', {}, 'Import'));

  return h('details', { class: 'card' }, h('summary', {}, 'Source new leads'), registry, google, enrich, csv, out);
}

// ---------- Lead detail drawer (data, score, strategy, pipeline) ----------
function facts(l) {
  const w = l.web_signals;
  const yoy = l.mb_revenue_prev_12mo ? Math.round((l.mb_revenue_12mo / l.mb_revenue_prev_12mo - 1) * 100) : null;
  const rows = [
    ['Address', [l.address, l.city, l.zip].filter(Boolean).join(', ')],
    ['Phone', l.phone],
    ['Website', link(l.website)],
    ['Legal entity', l.legal_name && `${l.legal_name}${l.org_type ? ` (${l.org_type})` : ''}`],
    ['Headquarters', l.hq_city && `${l.hq_city}, ${l.hq_state ?? ''}`],
    ['Texas entity formed', l.entity_formed_date],
    ['This location’s permit began', l.first_sale_date],
    ['Active TX locations', l.outlets_total != null && `${l.outlets_total}${l.outlets_opened_12mo ? ` (${l.outlets_opened_12mo} opened in last 12 mo)` : ''}`],
    ['NAICS', l.naics],
    ['Google', l.places_id ? h('span', {}, `${l.google_name} · ${l.rating ?? '–'}★ from ${l.review_count} reviews · ${l.business_status ?? ''} `, link(l.maps_url, 'Open in Maps'))
      : l.places_checked_at ? 'No matching listing found' : 'Not checked'],
    ['Alcohol sales (12 mo)', l.mb_revenue_12mo != null && `${money(l.mb_revenue_12mo)} through ${l.mb_latest_month}${yoy != null ? ` · ${yoy >= 0 ? '+' : ''}${yoy}% YoY` : ''}`],
    ['Website scan', !w ? 'Not scanned' : !w.reachable ? w.error : [
      `Booking: ${w.booking.join(', ') || 'none found'}`, `Chat: ${w.chat.join(', ') || 'none found'}`,
      `Reviews tool: ${w.reviews.join(', ') || 'none found'}`, w.ordering.length ? `Ordering: ${w.ordering.join(', ')}` : null,
      `Mobile: ${w.mobile_friendly ? 'yes' : 'no'}`, `HTTPS: ${w.https ? 'yes' : 'no'}`, w.copyright_year ? `© ${w.copyright_year}` : null].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);
  return h('table', { class: 'facts' }, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))));
}

async function openLead(id) {
  const l = await api(`/api/leads/${id}`);
  const d = $('#drawer'); d.hidden = false;
  const bars = l.factors.map((f) => {
    const fill = h('div', { class: f.known ? 'fill' : 'fill unknown' }); fill.style.width = `${(f.points / f.max) * 100}%`;
    return h('div', { class: 'factor' }, h('div', { class: 'row' }, h('span', {}, f.label), h('span', {}, f.known ? `${f.points}/${f.max}` : `?/${f.max}`)),
      h('div', { class: 'bar' }, fill), h('small', { class: 'muted' }, f.reasons.join(' · ')));
  });
  const log = h('pre', { class: 'log' });
  const refresh = h('button', { onclick: async () => {
    refresh.disabled = true; log.textContent = 'Checking Google, website and state records…';
    try { const r = await api(`/api/leads/${id}/enrich`, { method: 'POST' }); await openLead(id); $('#drawer .log').textContent = r.log.join('\n'); }
    catch (x) { log.textContent = x.message; refresh.disabled = false; }
  } }, 'Refresh data');
  const s = l.strategy;
  d.replaceChildren(
    h('button', { class: 'close', onclick: () => { d.hidden = true; } }, '×'),
    h('h2', {}, l.name), h('p', {}, segChips(l.segments), ' ', tier(l), ' ', h('span', { class: 'muted' }, `${l.coverage}% of score inputs checked`)),
    facts(l),
    h('p', {}, refresh, h('small', { class: 'muted' }, ` Google ${date(l.places_checked_at)} · Website ${date(l.web_checked_at)} · Source: ${l.source}`)), log,
    h('h3', {}, 'Why this score'), ...bars,
    s && h('section', {}, h('h3', {}, `Strategy — ${s.industry}`), h('p', { class: 'pitch' }, s.pitch),
      s.recommended.length > 0
        ? [h('h4', {}, 'Recommended (based on what we observed)'), h('ul', {}, s.recommended.map((u) => h('li', {}, h('strong', {}, u.name), h('div', { class: 'muted small' }, u.evidence))))]
        : h('p', { class: 'muted' }, s.scanned ? 'No obvious tool gaps found on their website.' : 'Run “Refresh data” to scan their website for concrete gaps.'),
      s.alreadyUses.length > 0 && h('p', {}, h('strong', {}, 'Already uses: '), s.alreadyUses.join(', ')),
      s.talkingPoints.length > 0 && [h('h4', {}, 'Talking points'), h('ul', {}, s.talkingPoints.map((t) => h('li', {}, t)))],
      h('h4', {}, 'Typical pains in this industry'), h('ul', {}, s.pains.map((t) => h('li', {}, t))),
      s.objections.length > 0 && [h('h4', {}, 'Objection handling'), h('ul', {}, s.objections.map((t) => h('li', {}, t)))],
      s.otherUseCases.length > 0 && [h('h4', {}, 'Other use cases'), h('ul', {}, s.otherUseCases.map((u) => h('li', {}, u.name)))]),
    can('pipeline:write') && pipelineForm(l),
    h('h3', {}, 'Activity'), h('ul', { class: 'activity' }, l.activities.map((a) => h('li', {}, h('small', { class: 'muted' }, `${a.created_at} · ${a.user ?? ''} · ${a.kind}`), h('pre', {}, a.body)))));
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
      [['Open leads', a.total], ['Enriched', a.enriched], ['Avg score', a.avgScore], ['A-tier', a.byTier.A ?? 0],
        ['Open pipeline', money(open.reduce((t, f) => t + f.value, 0))], ['Won', money(won.value)]]
        .map(([k, v]) => h('div', { class: 'card kpi' }, h('small', { class: 'muted' }, k), h('div', { class: 'big' }, v)))),
    h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('h3', {}, 'Top opportunities (≥60% checked)'), a.topOpportunities.length ? h('ol', {}, a.topOpportunities.map((l) =>
        h('li', { class: 'click', onclick: () => openLead(l.id) }, `${l.name} (${l.city}) `, tier(l)))) : h('p', { class: 'muted' }, 'Enrich leads to rank them.')),
      barList('Pipeline funnel (count)', Object.fromEntries(a.funnel.map((f) => [f.stage, f.count]))),
      barList('Gaps found on scanned websites', a.gaps),
      barList('Segments', a.bySegment, meta.segments), barList('Tiers', a.byTier),
      barList('Counties', a.byCounty), barList('Industries', a.byIndustry)));
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

// ---------- Account ----------
function renderAccount() {
  const out = h('p', { class: 'muted' });
  const form = h('form', { class: 'card login', onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    if (f.next !== f.confirm) { out.textContent = 'New passwords do not match.'; return; }
    try { await api('/api/me/password', { method: 'POST', body: { current: f.current, next: f.next } }); form.reset(); out.textContent = 'Password changed. Other sessions were signed out.'; }
    catch (x) { out.textContent = x.message; }
  } }, h('h2', {}, 'Change password'),
  h('input', { name: 'current', type: 'password', placeholder: 'Current password', required: true, autocomplete: 'current-password' }),
  h('input', { name: 'next', type: 'password', placeholder: 'New password (10+ characters)', minlength: 10, required: true, autocomplete: 'new-password' }),
  h('input', { name: 'confirm', type: 'password', placeholder: 'Repeat new password', required: true, autocomplete: 'new-password' }),
  h('button', {}, 'Change password'), out);
  $('#main').replaceChildren(h('h1', {}, 'Account'), h('p', { class: 'muted' }, `${me.name} · ${me.email} · ${me.role}`), form);
}

boot();
