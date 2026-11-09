// Client portal: the client enters their own information, keys and branding, previews their site, and launches it.
// Everything here is stored in the client's own encrypted workspace; nothing is sent to AI services.
import { renderSite } from '/site-template.js';
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

const PRIVACY = () => h('div', { class: 'privacy' },
  h('strong', {}, '🔒 Private by design. '),
  'What you enter here is kept in your own separate, encrypted workspace — not in our sales systems. ',
  h('strong', {}, 'It is never sent to AI services'), ' (like ChatGPT or Claude). Our setup system uses it only to build and connect your tools, and you can change, download or delete it at any time.');

let state = null, tab = 'setup', draft = {};
const slugFromPath = () => location.pathname.split('/')[2] ?? '';

// ---------- sign-in ----------
function renderAccept(invite) {
  const out = h('p', { class: 'error' });
  const form = h('form', { class: 'card login', onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    if (f.password !== f.confirm) { out.textContent = 'Passwords do not match.'; return; }
    try { const r = await api('/api/portal/accept', { invite, email: f.email, password: f.password }); history.replaceState(null, '', `/portal/${r.slug}`); load(); }
    catch (x) { out.textContent = x.message; }
  } }, h('h2', {}, 'Welcome! Create your sign-in'),
  h('p', { class: 'muted small' }, 'This portal is yours. Only you can sign in to it, with the email and password you choose now.'),
  h('input', { name: 'email', type: 'email', placeholder: 'Your email', required: true, autocomplete: 'email' }),
  h('input', { name: 'password', type: 'password', placeholder: 'Choose a password (10+ characters)', minlength: 10, required: true, autocomplete: 'new-password' }),
  h('input', { name: 'confirm', type: 'password', placeholder: 'Repeat password', required: true, autocomplete: 'new-password' }),
  h('button', {}, 'Create my portal'), out);
  $('#app').replaceChildren(PRIVACY(), form);
}

function renderLogin(msg) {
  const out = h('p', { class: 'error' }, msg ?? '');
  const form = h('form', { class: 'card login', onsubmit: async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    try { await api('/api/portal/login', f); history.replaceState(null, '', `/portal/${f.slug}`); load(); } catch (x) { out.textContent = x.message; }
  } }, h('h2', {}, 'Sign in to your portal'),
  h('input', { name: 'slug', placeholder: 'Portal name (from your invite)', required: true, value: slugFromPath() }),
  h('input', { name: 'email', type: 'email', placeholder: 'Email', required: true, autocomplete: 'username' }),
  h('input', { name: 'password', type: 'password', placeholder: 'Password', required: true, autocomplete: 'current-password' }),
  h('button', {}, 'Sign in'), out, h('p', { class: 'muted small' }, 'Forgot your password? Ask us for a new invite link — it lets you set a new one.'));
  $('#app').replaceChildren(PRIVACY(), form);
}

// ---------- main ----------
async function load() {
  const invite = location.hash.match(/invite=([0-9a-f]{32}\.[0-9a-f]{48})/)?.[1];
  try { state = await api('/api/portal/state'); }
  catch (e) { if (e.status === 401) return invite ? renderAccept(invite) : renderLogin(); return renderLogin(e.message); }
  if (invite) history.replaceState(null, '', `/portal/${state.slug}`); // never keep the invite token in the address bar
  draft = { ...state.draft };
  $('#who').replaceChildren(`${state.business} `, h('button', { class: 'link', onclick: async () => { await api('/api/portal/logout', {}); renderLogin(); } }, 'Sign out'));
  render();
}

function render() {
  const tabs = [['setup', 'Your setup'], ['access', 'Keys & access'], ['security', 'Security check'], ['data', 'Your data']];
  $('#app').replaceChildren(PRIVACY(),
    state.live ? h('p', { class: 'banner' }, '✅ Your site is live: ', h('a', { href: state.siteUrl, target: '_blank', rel: 'noopener' }, `${location.origin}${state.siteUrl}`), ' — changes you publish appear there right away.') : null,
    h('nav', { class: 'tabs' }, tabs.map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l))),
    { setup: renderSetup, access: renderAccess, security: renderSecurity, data: renderData }[tab]());
}

// ---------- setup + live preview ----------
function field(f) {
  const v = draft[f.key] ?? f.default ?? '';
  const on = (e) => { draft[f.key] = e.target.value; schedulePreview(); };
  const input = f.type === 'textarea' ? h('textarea', { name: f.key, placeholder: f.placeholder ?? '', maxlength: f.max, oninput: on, value: v })
    : f.type === 'select' ? h('select', { name: f.key, onchange: on }, Object.entries(f.options).map(([k, l]) => h('option', { value: k, selected: String(v) === k }, l)))
      : h('input', { name: f.key, type: f.type === 'tel' ? 'tel' : f.type === 'color' ? 'color' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text',
        placeholder: f.placeholder ?? '', maxlength: f.max, value: v, oninput: on });
  return h('label', { class: 'field' }, h('span', {}, f.label, f.required ? ' *' : ''), input, f.help ? h('small', { class: 'muted' }, f.help) : null);
}

let previewTimer, frame;
const previewHtml = () => renderSite(draft, { logoSrc: state.logo, workflows: state.workflows });
let missingEl;
const missingNow = () => state.fields.flatMap((s) => s.fields).filter((f) => f.required && !String(draft[f.key] ?? '').trim()).map((f) => f.label);
const showMissing = () => { if (missingEl) missingEl.textContent = !state.live && missingNow().length ? `Still needed before launch: ${missingNow().join(', ')}` : ''; };
function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(() => { if (frame) frame.srcdoc = previewHtml(); showMissing(); }, 200); }

function renderSetup() {
  const out = h('p', { class: 'small' });
  const label = (sec) => state.services.find((s) => s.id === sec)?.label ?? sec;
  const save = async (publish) => {
    try {
      const r = await api('/api/portal/profile', { profile: draft, publish });
      out.className = 'small ok'; out.textContent = r.published ? (r.first ? '🎉 Your site is live!' : 'Published — your site is updated.') : 'Draft saved.';
      const keep = tab; await load(); tab = keep;
    } catch (x) { out.className = 'small error'; out.textContent = x.message; }
  };
  const logo = h('label', { class: 'field' }, h('span', {}, 'Logo (PNG, JPEG or WebP, under 300 KB)'),
    h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 300_000) { out.className = 'small error'; out.textContent = 'Logo must be under 300 KB.'; return; }
      const u8 = new Uint8Array(await file.arrayBuffer()); let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      const b64 = btoa(bin);
      try { await api('/api/portal/logo', { data: b64 }); state.logo = `data:${file.type};base64,${b64}`; schedulePreview(); out.className = 'small ok'; out.textContent = 'Logo uploaded.'; }
      catch (x) { out.className = 'small error'; out.textContent = x.message; }
    } }));
  frame = h('iframe', { class: 'preview', sandbox: '', title: 'Preview of your site' }); // sandbox: no scripts, no navigation
  frame.srcdoc = previewHtml();
  queueMicrotask(showMissing);
  return h('div', { class: 'setup-grid' },
    h('form', { class: 'card', onsubmit: (e) => e.preventDefault() },
      state.fields.map((s) => h('fieldset', {}, h('legend', {}, s.section.includes(' ') ? s.section : label(s.section)), s.section === 'Look & feel' ? logo : null, s.fields.map(field))),
      (missingEl = h('p', { class: 'muted small' })),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'ghost', onclick: () => save(false) }, 'Save draft'),
        h('button', { type: 'button', onclick: () => {
          if (state.live || confirm('Launch your site with what you see in the preview? You can change it any time.')) save(true);
        } }, state.live ? 'Publish changes' : 'Review & launch my site')), out),
    h('div', { class: 'preview-wrap' }, h('div', { class: 'muted small' }, 'Live preview — this is exactly what will be published'), frame));
}

// ---------- keys & access ----------
function renderAccess() {
  return h('div', {}, h('div', { class: 'privacy vault' }, h('strong', {}, '🔑 Keys are write-only. '),
    'Once saved, a key can\'t be viewed by anyone in our tools — including you — only replaced or deleted. Keys are encrypted with a key unique to your workspace, used only by our setup system (never an AI service), and every use appears in your access log under "Your data".'),
  h('h3', {}, 'What we\'ll do for every setup'), h('ul', {}, UNIVERSAL_SECURITY.map((x) => h('li', {}, x))),
  state.services.map((svc) => h('section', { class: 'card' }, h('h3', {}, svc.label),
    svc.access.map((a) => {
      if (a.kind !== 'secret') return h('div', { class: 'access' }, h('strong', {}, a.kind === 'invite' ? '👤 Invite us: ' : '⚙️ You change: ', a.name), h('div', { class: 'muted small' }, a.detail));
      const s = state.secrets.find((x) => x.name === a.name);
      const out = h('span', { class: 'small' }, s.verifyResult ?? '');
      const input = h('input', { type: 'password', autocomplete: 'off', placeholder: s.set ? 'Paste a new key to replace it' : 'Paste key' });
      return h('div', { class: 'access' }, h('strong', {}, '🔑 ', a.label, a.optional ? ' (optional)' : ''), h('div', { class: 'muted small' }, a.detail),
        h('div', { class: 'small' }, s.set ? `Saved ${when(s.updatedAt)}${s.verifiedAt ? ` · tested ${when(s.verifiedAt)}` : ''}` : 'Not saved'),
        h('div', { class: 'row-actions' }, input,
          h('button', { type: 'button', onclick: async () => { try { await api('/api/portal/secrets', { name: a.name, value: input.value }); input.value = ''; await load(); tab = 'access'; render(); } catch (x) { out.textContent = x.message; } } }, 'Save'),
          s.set && s.canVerify ? h('button', { type: 'button', class: 'ghost', onclick: async () => { out.textContent = 'Testing…'; try { const r = await api('/api/portal/secrets/verify', { name: a.name }); out.textContent = r.message; } catch (x) { out.textContent = x.message; } } }, 'Test connection') : null,
          s.set ? h('button', { type: 'button', class: 'ghost', onclick: async () => { if (!confirm('Delete this key?')) return; await api('/api/portal/secrets/delete', { name: a.name }); await load(); tab = 'access'; render(); } }, 'Delete') : null, out));
    }),
    h('details', { class: 'small' }, h('summary', {}, 'What we\'ll check and do'), h('ul', {}, svc.security.map((x) => h('li', {}, x))),
      h('ol', {}, svc.steps.map((x) => h('li', {}, x.title, x.auto ? ' (automatic)' : '')))))));
}

// ---------- security check ----------
function renderSecurity() {
  const out = h('p', { class: 'small' });
  const r = state.report;
  const icon = { pass: '✅', warn: '⚠️', fail: '❌', unknown: '❔' };
  return h('div', { class: 'card' }, h('h3', {}, 'Security check of your current website & email domain'),
    h('p', { class: 'muted small' }, 'A read-only check — we never log in to anything. It looks at your site\'s encryption and protective settings, and whether your domain is protected against email spoofing.'),
    h('button', { type: 'button', onclick: async () => { out.textContent = 'Checking…'; try { await api('/api/portal/scan', {}); await load(); tab = 'security'; render(); } catch (x) { out.textContent = x.message; } } }, r ? 'Run again' : 'Run the check'), out,
    r ? [h('p', {}, h('strong', {}, `${r.target}: ${r.score ?? '–'}/100`), h('span', { class: 'muted small' }, ` · checked ${when(r.at)}`)),
      h('ul', { class: 'findings' }, r.findings.map((f) => h('li', {}, `${icon[f.status]} `, h('strong', {}, f.title), h('div', { class: 'small' }, f.detail), f.fix ? h('div', { class: 'small muted' }, `How to fix: ${f.fix}`) : null)))]
      : h('p', { class: 'muted small' }, 'Add your current website under "Your setup → Links" first.'));
}

// ---------- your data ----------
function renderData() {
  const out = h('p', { class: 'small error' });
  return h('div', {},
    h('section', { class: 'card' }, h('h3', {}, 'Download your data'), h('p', { class: 'small' }, 'Everything in your workspace as a file you keep. Key values are never included — you have the originals.'),
      h('a', { class: 'button', href: '/api/portal/export' }, 'Download my data (JSON)')),
    h('section', { class: 'card' }, h('h3', {}, 'Access log'), h('p', { class: 'muted small' }, 'Every sign-in, change and every time a key was used.'),
      h('table', {}, h('tbody', {}, state.audit.map((a) => h('tr', {}, h('td', { class: 'small' }, when(a.at)), h('td', {}, a.actor), h('td', {}, a.action), h('td', { class: 'small muted' }, a.detail ?? '')))))),
    h('section', { class: 'card danger' }, h('h3', {}, 'Delete my workspace'),
      h('p', { class: 'small' }, 'Permanently deletes your settings, logo, keys and access log, and takes your site offline. This cannot be undone.'),
      h('form', { onsubmit: async (e) => {
        e.preventDefault(); const confirmText = new FormData(e.target).get('confirm');
        try { await api('/api/portal/delete', { confirm: confirmText }); $('#app').replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Your workspace was deleted.'), h('p', {}, 'Everything you entered has been removed.'))); }
        catch (x) { out.textContent = x.message; }
      } }, h('input', { name: 'confirm', placeholder: `Type "${state.business}" to confirm`, required: true }), ' ', h('button', { class: 'danger-btn' }, 'Delete everything'), out)));
}

load();
