// Client portal — a guided website builder. The client answers a few friendly questions, picks a design, and
// watches their site come together in a live preview. Everything is stored in the client's own encrypted
// workspace; nothing is sent to AI services.
import { renderSite, TEMPLATES, resolveDesign } from '/site-template.js';
import { UNIVERSAL_SECURITY } from '/workflows.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((k) => k != null && k !== false).map((k) => (k instanceof Node ? k : String(k))));
  return el;
};
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error ?? 'Something went wrong'); e.status = r.status; throw e; }
  return data;
};
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');
const lines = (t) => String(t ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

const PRIVACY = (compact = false) => h('div', { class: `privacy${compact ? ' compact' : ''}` },
  h('span', { class: 'lock' }, '🔒'), h('div', {}, h('strong', {}, 'Private by design. '),
    'Everything here is kept in your own separate, encrypted workspace — not in our sales systems — and is ',
    h('strong', {}, 'never sent to AI services'), '. You can change, download or delete it at any time.'));

let state = null, draft = {}, view = 'build', step = 0, device = 'desktop';
const slugFromPath = () => location.pathname.split('/')[2] ?? '';

// ---------- sign-in ----------
function authShell(...kids) { $('#app').replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'auth-card' }, ...kids), PRIVACY())); }
function renderAccept(invite) {
  const out = h('p', { class: 'error' });
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    if (f.password !== f.confirm) { out.textContent = 'Passwords do not match.'; return; }
    try { const r = await api('/api/portal/accept', { invite, email: f.email, password: f.password }); history.replaceState(null, '', `/portal/${r.slug}`); load(); }
    catch (x) { out.textContent = x.message; }
  } }, h('h1', {}, 'Welcome.'), h('p', { class: 'muted' }, 'Let\'s build your new website together. First, create the sign-in only you will use.'),
  h('label', { class: 'f' }, 'Your email', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
  h('label', { class: 'f' }, 'Choose a password', h('input', { name: 'password', type: 'password', minlength: 10, required: true, autocomplete: 'new-password', placeholder: 'At least 10 characters' })),
  h('label', { class: 'f' }, 'Repeat password', h('input', { name: 'confirm', type: 'password', required: true, autocomplete: 'new-password' })),
  h('button', { class: 'cta wide' }, 'Get started →'), out);
  authShell(form);
}
function renderLogin(msg) {
  const out = h('p', { class: 'error' }, msg ?? '');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    try { await api('/api/portal/login', f); history.replaceState(null, '', `/portal/${f.slug}`); load(); } catch (x) { out.textContent = x.message; }
  } }, h('h1', {}, 'Welcome back.'),
  h('label', { class: 'f' }, 'Portal name', h('input', { name: 'slug', required: true, value: slugFromPath() })),
  h('label', { class: 'f' }, 'Email', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'username' })),
  h('label', { class: 'f' }, 'Password', h('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
  h('button', { class: 'cta wide' }, 'Sign in'), out, h('p', { class: 'muted small' }, 'Forgot your password? Ask us for a new invite link.'));
  authShell(form);
}

// ---------- load ----------
async function load() {
  const invite = location.hash.match(/invite=([0-9a-f]{32}\.[0-9a-f]{48})/)?.[1];
  try { state = await api('/api/portal/state'); }
  catch (e) { if (e.status === 401) return invite ? renderAccept(invite) : renderLogin(); return renderLogin(e.message); }
  if (invite) history.replaceState(null, '', `/portal/${state.slug}`); // never keep the invite token in the address bar
  draft = { ...state.draft };
  $('#who').replaceChildren(h('span', {}, state.business), h('button', { class: 'link', onclick: async () => { await api('/api/portal/logout', {}); renderLogin(); } }, 'Sign out'));
  render();
}

function render() {
  const views = [['build', state.live ? 'Edit your site' : 'Build your site'], ['access', 'Keys & access'], ['security', 'Security check'], ['data', 'Your data']];
  $('#app').replaceChildren(
    h('div', { class: 'topline' },
      h('nav', { class: 'views' }, views.map(([k, l]) => h('button', { type: 'button', class: view === k ? 'on' : '', onclick: () => { view = k; render(); } }, l))),
      state.live ? h('a', { class: 'live-pill', href: state.siteUrl, target: '_blank', rel: 'noopener' }, h('i'), 'Live — view site ↗') : null),
    { build: renderBuilder, access: renderAccess, security: renderSecurity, data: renderData }[view]());
}

// ---------- builder ----------
const STEPS = [
  { id: 'basics', short: 'Basics', title: 'The basics', sub: 'Who you are and how customers reach you.' },
  { id: 'services', short: 'Services', title: 'What you do', sub: 'Your services and why customers choose you.' },
  { id: 'design', short: 'Design', title: 'Pick a design', sub: 'Every option is designed to look great together.' },
  { id: 'photos', short: 'Photos', title: 'Logo & photo', sub: 'Optional, but a real photo makes a big difference.' },
  { id: 'details', short: 'Details', title: 'Finishing touches', sub: 'About you, hours and common questions.' },
  { id: 'launch', short: 'Launch', title: 'Review & launch', sub: 'Take a look — you can change anything later.' },
];
const REQUIRED = [['business.name', 'Business name'], ['business.phone', 'Phone number'], ['business.city', 'City'], ['business.services', 'At least one service']];
const missing = () => REQUIRED.filter(([k]) => !String(draft[k] ?? '').trim()).map(([, l]) => l);
const fieldDef = (key) => state.fields.flatMap((s) => s.fields).find((f) => f.key === key) ?? { key, label: key };

let saveTimer, saveEl, frames = [];
function changed() {
  refreshPreviews();
  clearTimeout(saveTimer);
  if (saveEl) saveEl.textContent = 'Saving…';
  saveTimer = setTimeout(async () => {
    try { await api('/api/portal/profile', { profile: draft, publish: false }); if (saveEl) saveEl.textContent = 'All changes saved'; }
    catch (x) { if (saveEl) saveEl.textContent = x.message; }
  }, 900);
}
const set = (k, v) => { draft[k] = v; changed(); };

function input(key, { type = 'text', placeholder, rows } = {}) {
  const f = fieldDef(key);
  const attrs = { name: key, placeholder: placeholder ?? f.placeholder ?? '', maxlength: f.max, value: draft[key] ?? '', oninput: (e) => set(key, e.target.value) };
  const el = rows ? h('textarea', { ...attrs, rows }) : h('input', { ...attrs, type });
  return h('label', { class: 'f' }, h('span', {}, f.label, f.required ? '' : h('em', {}, ' optional')), el, f.help ? h('small', {}, f.help) : null);
}

function chipList(key, suggestions = [], max = 12) {
  const wrap = h('div', { class: 'chiplist' });
  const draw = () => {
    const items = lines(draft[key]);
    const add = h('input', { placeholder: fieldDef(key).placeholder ?? 'Type and press Enter', onkeydown: (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); if (items.length < max) set(key, [...items, e.target.value.trim().slice(0, 80)].join('\n')); draw(); wrap.querySelector('input').focus(); }
    } });
    wrap.replaceChildren(h('div', { class: 'chips' }, items.map((t, i) => h('span', { class: 'chip-x' }, t,
      h('button', { type: 'button', 'aria-label': `Remove ${t}`, onclick: () => { set(key, items.filter((_, j) => j !== i).join('\n')); draw(); } }, '×'))), items.length < max ? add : null),
      suggestions.filter((s) => !items.includes(s)).length && items.length < max ? h('div', { class: 'suggest' }, h('small', {}, 'Suggestions'),
        suggestions.filter((s) => !items.includes(s)).map((s) => h('button', { type: 'button', onclick: () => { set(key, [...items, s].join('\n')); draw(); } }, `+ ${s}`))) : null);
  };
  draw();
  const f = fieldDef(key);
  return h('div', { class: 'f' }, h('span', {}, f.label, f.required ? '' : h('em', {}, ' optional')), f.help ? h('small', {}, f.help) : null, wrap);
}

function faqEditor() {
  const wrap = h('div', { class: 'faq-ed' });
  const pairs = () => lines(draft['content.faq']).map((l) => { const [q, ...a] = l.split('|'); return [q.trim(), a.join('|').trim()]; });
  const save = (ps) => set('content.faq', ps.filter(([q]) => q).map(([q, a]) => `${q.replace(/\|/g, '/')} | ${a.replace(/\n/g, ' ')}`).join('\n'));
  const draw = () => {
    const ps = pairs();
    wrap.replaceChildren(...ps.map(([q, a], i) => h('div', { class: 'qa' },
      h('input', { value: q, placeholder: 'Question', oninput: (e) => { ps[i][0] = e.target.value; save(ps); } }),
      h('textarea', { rows: 2, value: a, placeholder: 'Answer', oninput: (e) => { ps[i][1] = e.target.value; save(ps); } }),
      h('button', { type: 'button', class: 'x', 'aria-label': 'Remove question', onclick: () => { save(ps.filter((_, j) => j !== i)); draw(); } }, '×'))),
    ps.length < 8 ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => { save([...ps, ['New question', '']]); draw(); wrap.querySelectorAll('.qa input')[ps.length]?.select(); } }, '+ Add a question') : null);
  };
  draw();
  return h('div', { class: 'f' }, h('span', {}, 'Common questions', h('em', {}, ' optional')), h('small', {}, 'Shown as a tidy, expandable list on your site.'), wrap);
}

// Images are resized in the browser before upload — fast pages, small files, no stretched logos.
async function resizeImage(file, { max, type, quality = 0.85, limit }) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  for (let q = quality; q > 0.4; q -= 0.1) {
    const blob = await new Promise((r) => c.toBlob(r, type, q));
    if (blob.size <= limit || type === 'image/png') return blob;
  }
  return new Promise((r) => c.toBlob(r, type, 0.4));
}
const toB64 = async (blob) => { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };

function dropZone(name, title, hint) {
  const out = h('small', { class: 'status' });
  const current = name === 'logo' ? state.logo : state.hero;
  const upload = async (file) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { out.textContent = 'Please choose a PNG, JPEG or WebP image.'; return; }
    out.textContent = 'Optimizing…';
    try {
      const blob = name === 'logo' ? await resizeImage(file, { max: 600, type: file.type === 'image/png' ? 'image/png' : 'image/webp', limit: 280_000 })
        : await resizeImage(file, { max: 2000, type: 'image/jpeg', quality: 0.84, limit: 850_000 });
      const b64 = await toB64(blob);
      await api('/api/portal/asset', { name, data: b64 });
      state[name === 'logo' ? 'logo' : 'hero'] = `data:${blob.type};base64,${b64}`;
      renderBuilderBody(); refreshPreviews();
    } catch (x) { out.textContent = x.message; }
  };
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true, onchange: (e) => upload(e.target.files[0]) });
  return h('div', { class: 'drop', ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }, ondragleave: (e) => e.currentTarget.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); upload(e.dataTransfer.files[0]); } },
  current ? h('img', { src: current, alt: '', class: name }) : h('div', { class: 'ph' }, name === 'logo' ? 'Aa' : '▦'),
  h('div', {}, h('strong', {}, title), h('small', {}, hint), h('div', { class: 'row' },
    h('button', { type: 'button', class: 'ghost-btn', onclick: () => fileIn.click() }, current ? 'Replace' : 'Choose file'),
    current ? h('button', { type: 'button', class: 'link-btn', onclick: async () => { await api('/api/portal/asset', { name, remove: true }); state[name === 'logo' ? 'logo' : 'hero'] = null; renderBuilderBody(); refreshPreviews(); } }, 'Remove') : null), out), fileIn);
}

function headlineIdeas() {
  const svc = lines(draft['business.services'])[0]?.toLowerCase(), city = draft['business.city'], since = draft['business.since'];
  return [svc && city && `${svc[0].toUpperCase()}${svc.slice(1)} done right in ${city}.`, city && svc && `${city}'s trusted name in ${svc}.`,
    'Honest work. Fair prices. Real people.', since && `Proudly serving our neighbors since ${since}.`].filter(Boolean).slice(0, 3);
}

function stepBody(id) {
  if (id === 'basics') {
    const ideas = h('div', { class: 'suggest' });
    const drawIdeas = () => ideas.replaceChildren(h('small', {}, 'Headline ideas'), ...headlineIdeas().map((t) => h('button', { type: 'button', onclick: () => { set('business.tagline', t); $('[name="business.tagline"]').value = t; } }, t)));
    drawIdeas();
    return [input('business.name'), h('div', { class: 'two' }, input('business.phone', { type: 'tel', placeholder: '(512) 555-0100' }), input('business.city', { placeholder: 'Round Rock' })),
      input('business.tagline'), ideas, input('business.since', { type: 'text', placeholder: '2011' })];
  }
  if (id === 'services') return [chipList('business.services', [], 12),
    chipList('business.highlights', ['Licensed & insured', 'Family owned', 'Free estimates', 'Upfront pricing', 'Same-day service', 'Satisfaction guaranteed', 'Locally owned', 'Open 7 days'], 4)];
  if (id === 'design') {
    const d = resolveDesign(draft);
    return [h('div', { class: 'f' }, h('span', {}, 'Design'), h('div', { class: 'templates' }, Object.entries(TEMPLATES).map(([tid, t]) => {
      const fr = h('iframe', { sandbox: '', tabindex: '-1', 'aria-hidden': 'true', class: 'thumb' });
      frames.push({ el: fr, design: { 'brand.template': tid } });
      return h('button', { type: 'button', class: `tpl${d.tid === tid ? ' on' : ''}`, onclick: () => { draft['brand.template'] = tid; draft['brand.palette'] = Object.keys(t.palettes)[0]; draft['brand.fonts'] = Object.keys(t.fonts)[0]; changed(); renderBuilderBody(); } },
        h('div', { class: 'thumb-wrap' }, fr), h('strong', {}, t.name), h('small', {}, t.tagline));
    }))),
    h('div', { class: 'f' }, h('span', {}, 'Colors'), h('small', {}, 'Hand-picked for this design — every combination is contrast-checked for readability.'),
      h('div', { class: 'palettes' }, Object.entries(d.t.palettes).map(([pid, p]) => h('button', { type: 'button', class: `pal${d.pid === pid ? ' on' : ''}`, onclick: () => { set('brand.palette', pid); renderBuilderBody(); } },
        h('span', { class: 'sw' }, [p.bg, p.primary, p.g2 ?? p.accent].map((c) => { const i = h('i'); i.style.background = c; return i; })), p.name)))),
    h('div', { class: 'f' }, h('span', {}, 'Typography'), h('div', { class: 'fonts' }, Object.entries(d.t.fonts).map(([fid, f]) => {
      const sample = h('b', { class: `ff-${f.display}` }, 'Aa'); return h('button', { type: 'button', class: `font${d.fid === fid ? ' on' : ''}`, onclick: () => { set('brand.fonts', fid); renderBuilderBody(); } }, sample, f.name);
    })))];
  }
  if (id === 'photos') return [dropZone('logo', 'Your logo', 'PNG with a transparent background looks best. We resize it for you.'),
    dropZone('hero', 'A photo of your work or team', 'Real photos build trust. Landscape works best — we optimize it automatically.')];
  if (id === 'details') {
    const extras = state.fields.filter((s) => s.section !== 'Your business' && s.section !== 'What you offer' && s.section !== 'Look & feel' && s.section !== 'Links');
    return [input('business.about', { rows: 4 }), faqEditor(), input('business.hours', { rows: 3 }), h('div', { class: 'two' }, input('business.email', { type: 'email' }), input('business.address')),
      h('details', { class: 'more' }, h('summary', {}, 'Links & extras'), input('links.booking', { type: 'url', placeholder: 'https://' }), input('links.review', { type: 'url', placeholder: 'https://' }),
        input('links.ordering', { type: 'url', placeholder: 'https://' }), h('div', { class: 'two' }, input('links.facebook', { type: 'url', placeholder: 'https://' }), input('links.instagram', { type: 'url', placeholder: 'https://' })),
        input('links.website', { type: 'url', placeholder: 'https://' })),
      extras.length ? h('details', { class: 'more', open: true }, h('summary', {}, 'About the services you ordered'),
        extras.flatMap((s) => s.fields.map((f) => f.type === 'select'
          ? h('label', { class: 'f' }, h('span', {}, f.label), h('select', { name: f.key, onchange: (e) => set(f.key, e.target.value) }, Object.entries(f.options).map(([k, l]) => h('option', { value: k, selected: String(draft[f.key] ?? f.default) === k }, l))))
          : input(f.key, { type: f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text', rows: f.type === 'textarea' ? 3 : undefined })))) : null];
  }
  // launch
  const m = missing();
  const out = h('p', { class: 'status' });
  return [h('ul', { class: 'checklist' }, REQUIRED.map(([k, l]) => h('li', { class: String(draft[k] ?? '').trim() ? 'done' : '' }, l)),
    h('li', { class: state.hero ? 'done' : 'opt' }, 'A photo (recommended)'), h('li', { class: lines(draft['business.highlights']).length ? 'done' : 'opt' }, 'Why customers choose you (recommended)')),
  h('button', { type: 'button', class: 'cta wide', disabled: m.length > 0, onclick: async () => {
    try { const r = await api('/api/portal/profile', { profile: draft, publish: true }); out.textContent = r.first ? '🎉 Your site is live!' : 'Published.'; await load(); }
    catch (x) { out.textContent = x.message; }
  } }, state.live ? 'Publish changes' : 'Launch my site'), m.length ? h('p', { class: 'status' }, `Still needed: ${m.join(', ')}`) : null, out,
  h('p', { class: 'muted small' }, 'You can come back and change anything — updates go live the moment you publish.')];
}

let bodyEl, previewEl;
function renderBuilderBody() {
  frames = [];
  const s = STEPS[step];
  bodyEl.replaceChildren(h('div', { class: 'step-head' }, h('small', {}, `Step ${step + 1} of ${STEPS.length}`), h('h2', {}, s.title), h('p', {}, s.sub)),
    h('div', { class: 'step-body' }, stepBody(s.id)),
    h('div', { class: 'step-nav' }, step > 0 ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => go(step - 1) }, '← Back') : h('span'),
      (saveEl = h('small', { class: 'saved' }, 'All changes saved')),
      step < STEPS.length - 1 ? h('button', { type: 'button', class: 'cta', onclick: () => go(step + 1) }, 'Continue →') : h('span')));
  document.querySelectorAll('.stepper button').forEach((b, i) => { b.classList.toggle('on', i === step); b.classList.toggle('done', i < step); });
  refreshPreviews();
}
const go = (i) => { step = i; renderBuilderBody(); $('.builder .panel').scrollTop = 0; };

function renderBuilder() {
  bodyEl = h('div', { class: 'panel-inner' });
  const mainFrame = h('iframe', { sandbox: '', title: 'Live preview of your site', class: 'site' });
  previewEl = h('div', { class: `device ${device}` }, mainFrame);
  const toggle = h('div', { class: 'device-toggle' }, [['desktop', 'Desktop'], ['phone', 'Phone']].map(([k, l]) =>
    h('button', { type: 'button', class: device === k ? 'on' : '', onclick: () => { device = k; previewEl.className = `device ${k}`; toggle.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === l)); fit(); } }, l)));
  const el = h('div', { class: 'builder' },
    h('aside', { class: 'panel' }, h('nav', { class: 'stepper' }, STEPS.map((s, i) => h('button', { type: 'button', onclick: () => go(i), title: s.title }, h('b', {}, i + 1), h('span', {}, s.short)))), bodyEl),
    h('section', { class: 'stage' }, h('div', { class: 'stage-bar' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i')), h('span', { class: 'url' }, `${location.host}/s/${state.slug}`), toggle), h('div', { class: 'stage-view' }, previewEl)));
  queueMicrotask(() => { renderBuilderBody(); fit(); });
  return el;
}

// Scale the 1280px-wide desktop (or 390px phone) preview to fit the stage.
function fit() {
  const view = $('.stage-view'); if (!view || !previewEl) return;
  const w = device === 'desktop' ? 1280 : 390, hgt = device === 'desktop' ? 860 : 844;
  const scale = Math.min(1, view.clientWidth / w, device === 'phone' ? (view.clientHeight - 56) / hgt : 1);
  const f = previewEl.firstChild; f.style.width = `${w}px`; f.style.height = `${device === 'desktop' ? view.clientHeight / scale : hgt}px`;
  previewEl.style.transform = `scale(${scale})`; previewEl.style.width = `${w}px`;
}
addEventListener('resize', () => fit());

let previewTimer;
function refreshPreviews() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const assets = { logoSrc: state.logo, heroSrc: state.hero, workflows: state.workflows };
    const main = previewEl?.firstChild; if (main) main.srcdoc = renderSite(draft, assets);
    for (const fr of frames) fr.el.srcdoc = renderSite({ ...draft, ...fr.design, 'brand.palette': undefined, 'brand.fonts': undefined }, assets);
  }, 120);
}

// ---------- keys & access ----------
function renderAccess() {
  return h('div', { class: 'page' }, h('div', { class: 'privacy vault' }, h('span', { class: 'lock' }, '🔑'), h('div', {}, h('strong', {}, 'Keys are write-only. '),
    'Once saved, a key can\'t be viewed by anyone in our tools — including you — only replaced or deleted. Keys are encrypted with a key unique to your workspace, used only by our setup system (never an AI service), and every use appears in your access log.')),
  h('section', { class: 'card' }, h('h3', {}, 'Our promise for every setup'), h('ul', { class: 'ticks' }, UNIVERSAL_SECURITY.map((x) => h('li', {}, x)))),
  state.services.map((svc) => h('section', { class: 'card' }, h('h3', {}, svc.label),
    svc.access.map((a) => {
      if (a.kind !== 'secret') return h('div', { class: 'access' }, h('strong', {}, a.kind === 'invite' ? 'Invite us — ' : 'You change — ', a.name), h('p', {}, a.detail));
      const s = state.secrets.find((x) => x.name === a.name);
      const out = h('span', { class: 'status' }, s.verifyResult ?? '');
      const field = h('input', { type: 'password', autocomplete: 'off', placeholder: s.set ? 'Paste a new key to replace it' : 'Paste key' });
      return h('div', { class: 'access' }, h('strong', {}, a.label, a.optional ? h('em', {}, ' optional') : null), h('p', {}, a.detail),
        h('div', { class: 'small' }, s.set ? `✓ Saved ${when(s.updatedAt)}${s.verifiedAt ? ` · tested ${when(s.verifiedAt)}` : ''}` : 'Not saved'),
        h('div', { class: 'row' }, field,
          h('button', { type: 'button', class: 'cta', onclick: async () => { try { await api('/api/portal/secrets', { name: a.name, value: field.value }); field.value = ''; await load(); view = 'access'; render(); } catch (x) { out.textContent = x.message; } } }, 'Save'),
          s.set && s.canVerify ? h('button', { type: 'button', class: 'ghost-btn', onclick: async () => { out.textContent = 'Testing…'; try { out.textContent = (await api('/api/portal/secrets/verify', { name: a.name })).message; } catch (x) { out.textContent = x.message; } } }, 'Test connection') : null,
          s.set ? h('button', { type: 'button', class: 'link-btn', onclick: async () => { if (!confirm('Delete this key?')) return; await api('/api/portal/secrets/delete', { name: a.name }); await load(); view = 'access'; render(); } }, 'Delete') : null, out));
    }),
    h('details', { class: 'more' }, h('summary', {}, 'What we\'ll check and do'), h('ul', { class: 'ticks' }, svc.security.map((x) => h('li', {}, x))),
      h('ol', {}, svc.steps.map((x) => h('li', {}, x.title, x.auto ? ' — automatic' : '')))))));
}

// ---------- security check ----------
function renderSecurity() {
  const out = h('p', { class: 'status' });
  const r = state.report;
  const icon = { pass: '✓', warn: '!', fail: '×', unknown: '?' };
  return h('div', { class: 'page' }, h('section', { class: 'card' }, h('h3', {}, 'Security check'),
    h('p', { class: 'muted' }, 'A read-only check of your current website and email domain — we never log in to anything.'),
    h('button', { type: 'button', class: 'cta', onclick: async () => { out.textContent = 'Checking…'; try { await api('/api/portal/scan', {}); await load(); view = 'security'; render(); } catch (x) { out.textContent = x.message; } } }, r ? 'Run again' : 'Run the check'), out,
    r ? [h('div', { class: 'score' }, h('b', {}, r.score ?? '–'), h('span', {}, `/100 · ${r.target} · ${when(r.at)}`)),
      h('ul', { class: 'findings' }, r.findings.map((f) => h('li', { class: f.status }, h('i', {}, icon[f.status]), h('div', {}, h('strong', {}, f.title), h('p', {}, f.detail), f.fix ? h('p', { class: 'fix' }, f.fix) : null))))]
      : h('p', { class: 'muted small' }, 'Add your current website in "Finishing touches → Links & extras" first.')));
}

// ---------- your data ----------
function renderData() {
  const out = h('p', { class: 'error' });
  return h('div', { class: 'page' },
    h('section', { class: 'card' }, h('h3', {}, 'Download your data'), h('p', {}, 'Everything in your workspace as a file you keep. Key values are never included — you have the originals.'),
      h('a', { class: 'cta', href: '/api/portal/export' }, 'Download my data')),
    h('section', { class: 'card' }, h('h3', {}, 'Access log'), h('p', { class: 'muted' }, 'Every sign-in, change and every time a key was used.'),
      h('table', { class: 'log-table' }, h('tbody', {}, state.audit.map((a) => h('tr', {}, h('td', {}, when(a.at)), h('td', {}, a.actor), h('td', {}, a.action, a.detail ? h('small', {}, ` ${a.detail}`) : null)))))),
    h('section', { class: 'card danger' }, h('h3', {}, 'Delete my workspace'),
      h('p', {}, 'Permanently deletes your settings, photos, keys and access log, and takes your site offline. This cannot be undone.'),
      h('form', { class: 'row', onsubmit: async (e) => {
        e.preventDefault(); const confirmText = new FormData(e.target).get('confirm');
        try { await api('/api/portal/delete', { confirm: confirmText }); authShell(h('h1', {}, 'Deleted.'), h('p', {}, 'Everything you entered has been removed.')); }
        catch (x) { out.textContent = x.message; }
      } }, h('input', { name: 'confirm', placeholder: `Type "${state.business}" to confirm`, required: true }), h('button', { class: 'danger-btn' }, 'Delete everything')), out));
}

load();
