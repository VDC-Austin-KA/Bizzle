// Client website templates. One renderer for the portal's live preview AND the published site, so what the client
// approves is exactly what goes live. Output has no JavaScript; every client value is HTML-escaped; links are
// http(s)/tel/sms/mailto only. Colors come ONLY from curated, contrast-checked palettes (see test/templates.test.js).
//
// Design references (inspiration for layout & feel — not copied branding):
//   Atelier  — Aesop / luxury editorial: ivory paper, charcoal type, refined serif, sharp corners, numbered sections
//   Studio   — Stripe: crisp sans, soft gradient hero, precise grid, elevated cards
//   Midnight — Linear dark mode + premium local-service "dark glass" look: deep ground, frosted cards, one glowing accent
//   Heritage — premium trades & hospitality: warm serif/sans pairing, trust strip, photo-forward

const FONT_FACES = {
  inter: "@font-face{font-family:'Inter';src:url(/fonts/inter.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  cormorant: "@font-face{font-family:'Cormorant Garamond';src:url(/fonts/cormorant.woff2) format('woff2');font-weight:400 700;font-display:swap}@font-face{font-family:'Cormorant Garamond';font-style:italic;src:url(/fonts/cormorant-italic.woff2) format('woff2');font-weight:400 700;font-display:swap}",
  fraunces: "@font-face{font-family:'Fraunces';src:url(/fonts/fraunces.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  manrope: "@font-face{font-family:'Manrope';src:url(/fonts/manrope.woff2) format('woff2');font-weight:300 800;font-display:swap}",
};
const STACK = { inter: "'Inter',system-ui,sans-serif", cormorant: "'Cormorant Garamond',Georgia,serif", fraunces: "'Fraunces',Georgia,serif", manrope: "'Manrope','Inter',system-ui,sans-serif" };

const P = (name, bg, surface, ink, muted, line, primary, onPrimary, accent, extra = {}) => ({ name, bg, surface, ink, muted, line, primary, onPrimary, accent, ...extra });

export const TEMPLATES = {
  atelier: {
    name: 'Atelier', tagline: 'Quiet luxury. Editorial serif type on warm paper.',
    fonts: { classic: { name: 'Cormorant & Inter', display: 'cormorant', body: 'inter' }, modern: { name: 'Fraunces & Inter', display: 'fraunces', body: 'inter' } },
    palettes: {
      ivory: P('Ivory & Charcoal', '#f6f1e9', '#efe8dc', '#1d1b18', '#5c554b', '#d9cfc0', '#1d1b18', '#f6f1e9', '#8a6a3f'),
      sage: P('Sage & Stone', '#f1f2ec', '#e6e9df', '#1e2620', '#525c53', '#cdd3c5', '#2f4a3a', '#f1f2ec', '#6b7d5c'),
      clay: P('Clay & Linen', '#f7efe8', '#efe2d6', '#2a1d17', '#664f44', '#e0cbbb', '#8c4a2f', '#fff8f2', '#a8714a'),
      stone: P('Stone & Ink', '#ececea', '#e2e2df', '#18191b', '#505358', '#cfcfcb', '#18191b', '#f4f4f2', '#6b6f76'),
    },
  },
  studio: {
    name: 'Studio', tagline: 'Modern and confident. Crisp type and a soft gradient glow.',
    fonts: { crisp: { name: 'Inter', display: 'inter', body: 'inter' }, geometric: { name: 'Manrope', display: 'manrope', body: 'inter' } },
    palettes: {
      indigo: P('Indigo', '#ffffff', '#f6f8fc', '#0a2540', '#425466', '#e3e8ef', '#5046e5', '#ffffff', '#5046e5', { g1: '#7f7cff', g2: '#c4b5fd', g3: '#7dd3fc' }),
      ocean: P('Ocean', '#ffffff', '#f4f8fb', '#0b2236', '#41566b', '#e1e9f0', '#0b63b8', '#ffffff', '#0b63b8', { g1: '#38bdf8', g2: '#818cf8', g3: '#67e8f9' }),
      emerald: P('Emerald', '#ffffff', '#f3f8f6', '#0b2a24', '#3f5a53', '#dde9e4', '#0f766e', '#ffffff', '#0f766e', { g1: '#34d399', g2: '#5eead4', g3: '#a7f3d0' }),
      sunset: P('Sunset', '#ffffff', '#fbf6f3', '#2a160d', '#5e4a40', '#efe2da', '#b5400b', '#ffffff', '#b5400b', { g1: '#fb923c', g2: '#f472b6', g3: '#fcd34d' }),
    },
  },
  midnight: {
    name: 'Midnight', tagline: 'Dark, sleek and premium. Frosted glass with one glowing accent.',
    fonts: { geometric: { name: 'Manrope', display: 'manrope', body: 'inter' }, crisp: { name: 'Inter', display: 'inter', body: 'inter' } },
    palettes: {
      amber: P('Graphite & Amber', '#0b0d10', '#14171c', '#f3f4f6', '#a3a9b5', '#262a31', '#f5a524', '#141007', '#f5a524'),
      ice: P('Graphite & Ice', '#0a0d11', '#121821', '#eef4f8', '#9fb0bf', '#232c37', '#5ccfe6', '#06161b', '#5ccfe6'),
      gold: P('Navy & Gold', '#0b1020', '#121a2e', '#f2efe6', '#a9adbd', '#232c45', '#d4b26a', '#16120a', '#d4b26a'),
      orchid: P('Ink & Orchid', '#0d0b12', '#16131e', '#f3f0f8', '#a9a3b8', '#2a2536', '#c4a1ff', '#160f24', '#c4a1ff'),
    },
  },
  heritage: {
    name: 'Heritage', tagline: 'Trusted and established. Warm serif type with a craftsman feel.',
    fonts: { classic: { name: 'Fraunces & Inter', display: 'fraunces', body: 'inter' }, refined: { name: 'Cormorant & Manrope', display: 'cormorant', body: 'manrope' } },
    palettes: {
      forest: P('Forest & Brass', '#f8f4ec', '#efe8da', '#1f2a24', '#535d57', '#ddd3c1', '#1f3d2f', '#f8f4ec', '#9c773b'),
      navy: P('Navy & Copper', '#f6f4ef', '#ebe7de', '#1a2230', '#4f5868', '#d9d3c6', '#1b2f4b', '#f6f4ef', '#a85a31'),
      oxblood: P('Oxblood & Cream', '#f7f1ea', '#eee4d8', '#2a1a1b', '#5f4e4d', '#ddcfbf', '#5e1f24', '#f7f1ea', '#a07d48'),
      slate: P('Slate & Sand', '#f3f1ec', '#e8e5dd', '#1f262c', '#515a62', '#d6d2c7', '#2f3b45', '#f3f1ec', '#a9845a'),
    },
  },
};
export const DEFAULTS = { template: 'atelier', palette: 'ivory', fonts: 'classic' };
export const ALL_PALETTES = [...new Set(Object.values(TEMPLATES).flatMap((t) => Object.keys(t.palettes)))];
export const ALL_FONTS = [...new Set(Object.values(TEMPLATES).flatMap((t) => Object.keys(t.fonts)))];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const digits = (p) => String(p ?? '').replace(/[^0-9+]/g, '');
const lines = (t) => String(t ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const pad = (n) => String(n + 1).padStart(2, '0');

// Resolve the client's choices to a valid template/palette/fonts combination (unknown values fall back to defaults).
export function resolveDesign(p) {
  const tid = TEMPLATES[p['brand.template']] ? p['brand.template'] : DEFAULTS.template;
  const t = TEMPLATES[tid];
  const pid = t.palettes[p['brand.palette']] ? p['brand.palette'] : Object.keys(t.palettes)[0];
  const fid = t.fonts[p['brand.fonts']] ? p['brand.fonts'] : Object.keys(t.fonts)[0];
  return { tid, t, pid, pal: t.palettes[pid], fid, fonts: t.fonts[fid] };
}

const BASE_CSS = (pal, f) => `
${FONT_FACES[f.display]}${f.body !== f.display ? FONT_FACES[f.body] : ''}
:root{--bg:${pal.bg};--surface:${pal.surface};--ink:${pal.ink};--muted:${pal.muted};--line:${pal.line};--primary:${pal.primary};--on-primary:${pal.onPrimary};--accent:${pal.accent};
--display:${STACK[f.display]};--body:${STACK[f.body]};--max:1160px}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(20px,5vw,48px)}
.nav{position:sticky;top:0;z-index:5;backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px)}
.nav .wrap{display:flex;align-items:center;gap:28px;height:72px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:var(--display);font-size:21px;font-weight:600;letter-spacing:-.01em}
.brand img{height:38px;width:auto;max-width:140px;object-fit:contain}
.links{display:flex;gap:26px;margin-left:auto;font-size:14.5px}.links a{text-decoration:none;opacity:.78;transition:opacity .2s}.links a:hover{opacity:1}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 26px;font-weight:600;font-size:15.5px;text-decoration:none;transition:transform .2s,box-shadow .2s,background .2s;white-space:nowrap}
.btn:hover{transform:translateY(-1px)}.btn.solid{background:var(--primary);color:var(--on-primary)}
.btn.line{border:1px solid currentColor}.btn.small{padding:10px 18px;font-size:14px}
h1,h2,h3{font-family:var(--display);font-weight:500;letter-spacing:-.02em;line-height:1.08;margin:0}
h1{font-size:clamp(42px,6.4vw,84px)}h2{font-size:clamp(32px,4vw,52px)}h3{font-size:22px;letter-spacing:-.01em}
.eyebrow{font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:var(--muted)}
.lead{font-size:clamp(18px,1.6vw,21px);color:var(--muted);max-width:620px}
section{padding:clamp(72px,10vw,128px) 0}
.sec-head{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:48px;flex-wrap:wrap}
.faq details{border-top:1px solid var(--line);padding:22px 0}.faq details:last-child{border-bottom:1px solid var(--line)}
.band .cta-row{justify-content:center}
.faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:20px;font-size:19px;font-weight:500}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:'+';font-size:24px;line-height:1;transition:transform .25s;color:var(--muted)}
.faq details[open] summary::after{transform:rotate(45deg)}.faq p{color:var(--muted);margin:12px 0 0;max-width:720px}
.contact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px}
.contact-grid h3{font-family:var(--body);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:12px}
.contact-grid p,.contact-grid pre{margin:0;font:inherit;white-space:pre-wrap}
footer{padding:36px 0;font-size:14px;color:var(--muted);border-top:1px solid var(--line)}
footer .wrap{display:flex;gap:20px;flex-wrap:wrap;justify-content:space-between}footer a{margin-left:18px}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.hero .rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}.hero .rise:nth-child(2){animation-delay:.08s}.hero .rise:nth-child(3){animation-delay:.16s}.hero .rise:nth-child(4){animation-delay:.24s}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media (max-width:760px){.links{display:none}.nav .btn{margin-left:auto}body{font-size:16px}}
`;

const TEMPLATE_CSS = {
  atelier: `
.nav{background:color-mix(in srgb,var(--bg) 82%,transparent);border-bottom:1px solid var(--line)}
.btn{border-radius:0;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding:16px 28px}.btn.line{border-color:var(--ink)}
.hero{padding:clamp(80px,12vw,160px) 0 clamp(64px,8vw,104px)}
.hero h1{font-weight:400;max-width:15ch}.hero h1 em{font-style:italic;color:var(--accent)}
.hero .lead{margin:28px 0 40px}.cta-row{display:flex;gap:14px;flex-wrap:wrap}
.hero.no-media .wrap{position:relative}.hero.no-media .wrap>div:first-child{position:relative;z-index:1}
.mono{position:absolute;right:clamp(20px,5vw,48px);top:44%;transform:translateY(-50%);font-family:var(--display);font-style:italic;font-size:clamp(220px,30vw,440px);line-height:.8;color:var(--accent);opacity:.14;user-select:none;pointer-events:none}
@media (max-width:860px){.mono{display:none}}
.hero-media{margin-top:72px;aspect-ratio:21/9;overflow:hidden;background:var(--surface)}.hero-media img{width:100%;height:100%;object-fit:cover}
.marks{display:flex;gap:44px;flex-wrap:wrap;margin-top:56px;padding-top:28px;border-top:1px solid var(--line)}
.marks div{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.marks div::before{content:'—';margin-right:10px;color:var(--accent)}
.services ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));border-top:1px solid var(--line)}
.services li{display:flex;gap:22px;align-items:baseline;padding:30px 24px 30px 0;border-bottom:1px solid var(--line);font-family:var(--display);font-size:clamp(24px,2.4vw,30px)}
.services li span{font-family:var(--body);font-size:13px;color:var(--accent);letter-spacing:.1em}
.about{background:var(--surface)}.about .wrap{display:grid;grid-template-columns:1fr 1.4fr;gap:clamp(32px,6vw,96px)}
.about p{font-family:var(--display);font-size:clamp(24px,2.6vw,34px);line-height:1.35;margin:0}
.band{background:var(--primary);color:var(--on-primary);text-align:center}.band h2{font-weight:400;margin-bottom:32px}
.band .btn.solid{background:var(--on-primary);color:var(--primary)}.band .btn.line{border-color:var(--on-primary)}
@media (max-width:760px){.about .wrap{grid-template-columns:1fr}}`,
  studio: `
.nav{background:color-mix(in srgb,#fff 72%,transparent);border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.btn{border-radius:999px}.btn.solid{box-shadow:0 8px 24px -10px var(--primary)}.btn.solid:hover{box-shadow:0 14px 30px -12px var(--primary)}
.btn.line{border-color:var(--line);background:#fff}
.hero{position:relative;overflow:hidden;padding:clamp(96px,13vw,170px) 0 clamp(80px,10vw,128px)}
.hero::before{content:'';position:absolute;inset:-30% -10% auto 35%;height:140%;z-index:-1;filter:blur(60px);opacity:.75;
background:radial-gradient(40% 50% at 30% 40%,var(--g1),transparent 70%),radial-gradient(35% 45% at 70% 30%,var(--g2),transparent 70%),radial-gradient(40% 40% at 55% 75%,var(--g3),transparent 70%);transform:skewY(-8deg)}
.hero h1{font-weight:650;letter-spacing:-.035em;max-width:13ch}
.hero .lead{margin:24px 0 36px}.cta-row{display:flex;gap:12px;flex-wrap:wrap}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:40px}.chips div{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 16px;font-size:14px;font-weight:500;box-shadow:0 1px 2px #0000000d}
.chips div::before{content:'✓';color:var(--primary);font-weight:700;margin-right:8px}
.hero-media{margin-top:64px;border-radius:20px;overflow:hidden;aspect-ratio:16/8;box-shadow:0 40px 80px -40px #0a254066,0 0 0 1px var(--line)}.hero-media img{width:100%;height:100%;object-fit:cover}
.services .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.services .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px;box-shadow:0 1px 3px #0000000a,0 12px 32px -18px #0a254040;transition:transform .25s,box-shadow .25s}
.services .card:hover{transform:translateY(-3px);box-shadow:0 1px 3px #0000000a,0 22px 40px -20px #0a254055}
.services .card b{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:color-mix(in srgb,var(--primary) 12%,#fff);color:var(--primary);font-size:14px;margin-bottom:18px}
.services .card h3{font-family:var(--body);font-weight:600;font-size:19px}
.about{background:var(--surface)}.about .wrap{display:grid;grid-template-columns:1fr 1.3fr;gap:clamp(32px,6vw,80px);align-items:start}
.about p{font-size:20px;color:var(--muted);margin:0}
h2{font-weight:650;letter-spacing:-.03em}
.band .wrap{border-radius:24px;padding:clamp(48px,7vw,80px);color:#fff;text-align:center;background:linear-gradient(120deg,var(--primary),color-mix(in srgb,var(--primary) 60%,var(--g2)))}
.band h2{margin-bottom:28px}.band .btn.solid{background:#fff;color:var(--primary);box-shadow:none}.band .btn.line{background:transparent;border-color:#ffffff88;color:#fff}`,
  midnight: `
body{background:radial-gradient(1200px 600px at 70% -10%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 60%),var(--bg)}
.nav{background:color-mix(in srgb,var(--bg) 70%,transparent);border-bottom:1px solid var(--line)}
.btn{border-radius:12px}.btn.solid{box-shadow:0 0 0 1px color-mix(in srgb,var(--primary) 60%,transparent),0 10px 40px -10px color-mix(in srgb,var(--primary) 70%,transparent)}
.btn.line{border-color:var(--line);background:#ffffff08}
.hero{padding:clamp(96px,13vw,168px) 0 clamp(72px,9vw,112px);text-align:center}
.hero .eyebrow{display:inline-block;padding:7px 14px;border:1px solid var(--line);border-radius:999px;background:#ffffff08;color:var(--ink);letter-spacing:.12em}
.hero .eyebrow::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:10px;box-shadow:0 0 12px var(--accent);vertical-align:1px}
.hero h1{font-weight:700;letter-spacing:-.04em;margin:28px auto 0;max-width:15ch;background:linear-gradient(180deg,var(--ink) 40%,color-mix(in srgb,var(--ink) 55%,transparent));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero .lead{margin:24px auto 36px}.cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.chips{display:flex;gap:28px;justify-content:center;flex-wrap:wrap;margin-top:44px;color:var(--muted);font-size:14.5px}.chips div::before{content:'◆';color:var(--accent);margin-right:8px;font-size:10px}
.hero-media{margin:64px auto 0;max-width:1000px;border-radius:20px;overflow:hidden;aspect-ratio:16/8;border:1px solid var(--line);box-shadow:0 30px 120px -40px color-mix(in srgb,var(--accent) 50%,transparent)}.hero-media img{width:100%;height:100%;object-fit:cover}
.services .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.services .card{padding:28px;border-radius:18px;border:1px solid var(--line);background:linear-gradient(180deg,#ffffff0d,#ffffff04);backdrop-filter:blur(12px);transition:border-color .25s,transform .25s}
.services .card:hover{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));transform:translateY(-2px)}
.services .card b{color:var(--accent);font-size:13px;letter-spacing:.1em}.services .card h3{font-family:var(--body);font-weight:600;font-size:19px;margin-top:14px}
.about .wrap{display:grid;grid-template-columns:1fr 1.3fr;gap:clamp(32px,6vw,80px)}.about p{font-size:20px;color:var(--muted);margin:0}
h2{font-weight:700;letter-spacing:-.035em}
.band .wrap{border:1px solid var(--line);border-radius:24px;padding:clamp(48px,7vw,84px);text-align:center;background:radial-gradient(600px 300px at 50% 0%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 70%),#ffffff05}
.band h2{margin-bottom:28px}
@media (max-width:760px){.about .wrap{grid-template-columns:1fr}}`,
  heritage: `
.topbar{background:var(--primary);color:var(--on-primary);font-size:13.5px}.topbar .wrap{display:flex;justify-content:space-between;gap:16px;height:40px;align-items:center}
.topbar a{text-decoration:none;font-weight:600}
.nav{background:color-mix(in srgb,var(--bg) 88%,transparent);border-bottom:1px solid var(--line)}
.btn{border-radius:6px}.btn.line{border-color:var(--ink)}
.hero{padding:clamp(64px,9vw,120px) 0}.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(32px,5vw,72px);align-items:center}
.hero.no-media .wrap{grid-template-columns:1.2fr .8fr}@media (max-width:860px){.seal{display:none}}.hero h1{font-weight:500;max-width:14ch}
.hero .lead{margin:24px 0 36px}.cta-row{display:flex;gap:12px;flex-wrap:wrap}
.hero-media{aspect-ratio:4/5;border-radius:8px;overflow:hidden;box-shadow:24px 24px 0 -1px var(--surface),24px 24px 0 0 var(--line)}.hero-media img{width:100%;height:100%;object-fit:cover}
.seal{justify-self:center;width:clamp(220px,24vw,300px);aspect-ratio:1;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;text-align:center;position:relative;background:var(--surface)}
.seal::before{content:'';position:absolute;inset:12px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--accent) 60%,transparent)}
.seal small{display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}.seal b{display:block;font-family:var(--display);font-weight:500;font-size:clamp(44px,5vw,64px);line-height:1;margin:8px 0;color:var(--primary)}
.trust{background:var(--surface);border-block:1px solid var(--line)}.trust .wrap{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap;padding-block:26px}
.trust .wrap>div{font-family:var(--display);font-size:20px;display:flex;align-items:center;gap:12px}.trust .wrap>div::before{content:'';width:9px;height:9px;transform:rotate(45deg);background:var(--accent)}
.services .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg)}
.services .card{padding:32px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);margin:0 -1px -1px 0}
.services .card b{font-family:var(--display);color:var(--accent);font-size:28px;font-weight:500}.services .card h3{margin-top:10px;font-size:24px}
.about{background:var(--primary);color:var(--on-primary)}.about .eyebrow{color:color-mix(in srgb,var(--on-primary) 70%,transparent)}
.about .wrap{display:grid;grid-template-columns:1fr 1.3fr;gap:clamp(32px,6vw,80px)}.about p{font-family:var(--display);font-size:clamp(22px,2.4vw,30px);line-height:1.4;margin:0}
.band{text-align:center}.band h2{margin-bottom:28px}
@media (max-width:860px){.hero .wrap,.about .wrap{grid-template-columns:1fr}.hero-media{aspect-ratio:16/10;box-shadow:10px 10px 0 -1px var(--surface),10px 10px 0 0 var(--line)}}`,
};

// p = profile; assets = { logo, hero } as URLs (data: in preview, /s/<slug>/… when published).
export function renderSite(p, { logoSrc = null, heroSrc = null, workflows = [] } = {}) {
  const { tid, pal, fonts } = resolveDesign(p);
  const name = p['business.name'] || 'Your business';
  const city = p['business.city'];
  const phone = digits(p['business.phone']);
  const booking = safeUrl(p['links.booking']), review = safeUrl(p['links.review']), ordering = safeUrl(p['links.ordering']);
  const services = lines(p['business.services']).slice(0, 12);
  const highlights = lines(p['business.highlights']).slice(0, 4);
  const faq = lines(p['content.faq'] || p['wf.chat.faq']).map((l) => l.split('|')).filter((x) => x.length >= 2 && x[0].trim()).slice(0, 10);
  const since = /^\d{4}$/.test(p['business.since'] ?? '') ? p['business.since'] : null;
  const social = [['Facebook', safeUrl(p['links.facebook'])], ['Instagram', safeUrl(p['links.instagram'])]].filter(([, u]) => u);
  const headline = p['business.tagline'] || `${services[0] ? `${services[0]} ` : ''}${city ? `in ${city}` : ''}`.trim() || name;
  const eyebrow = [city ? `${city}, Texas` : null, since ? `Since ${since}` : null].filter(Boolean).join(' · ');
  const primaryCta = booking ? [booking, 'Book online'] : ordering ? [ordering, 'Order online'] : phone ? [`tel:${phone}`, 'Call now'] : null;
  const ctas = [primaryCta && `<a class="btn solid" href="${esc(primaryCta[0])}" rel="noopener">${primaryCta[1]}</a>`,
    phone && primaryCta?.[1] !== 'Call now' && `<a class="btn line" href="tel:${esc(phone)}">${esc(p['business.phone'])}</a>`,
    phone && workflows.includes('textback') && `<a class="btn line" href="sms:${esc(phone)}">Text us</a>`].filter(Boolean).join('');
  const marks = highlights.length ? highlights : [since ? `Serving since ${since}` : null, city ? `Locally owned in ${city}` : null].filter(Boolean);
  const logo = logoSrc ? `<img src="${esc(logoSrc)}" alt="">` : '';
  const media = heroSrc ? `<div class="hero-media rise"><img src="${esc(heroSrc)}" alt="${esc(name)}"></div>` : '';
  // Atelier sets the headline's last word in italic accent — an editorial flourish.
  const fancy = (t) => { const e = esc(t); const i = e.lastIndexOf(' '); return tid === 'atelier' && i > 0 ? `${e.slice(0, i)} <em>${e.slice(i + 1)}</em>` : e; };

  const nav = `${tid === 'heritage' && phone ? `<div class="topbar"><div class="wrap"><span>${esc(eyebrow || name)}</span><a href="tel:${esc(phone)}">Call ${esc(p['business.phone'])}</a></div></div>` : ''}
<nav class="nav"><div class="wrap"><a class="brand" href="#top">${logo}<span>${esc(name)}</span></a>
<div class="links">${services.length ? '<a href="#services">Services</a>' : ''}${p['business.about'] ? '<a href="#about">About</a>' : ''}${faq.length ? '<a href="#faq">FAQ</a>' : ''}<a href="#contact">Contact</a></div>
${primaryCta ? `<a class="btn solid small" href="${esc(primaryCta[0])}" rel="noopener">${primaryCta[1]}</a>` : ''}</div></nav>`;

  const heroInner = `<div>${eyebrow && tid !== 'heritage' ? `<div class="eyebrow rise">${esc(eyebrow)}</div>` : tid === 'heritage' ? `<div class="eyebrow rise">${esc(services.slice(0, 3).join(' · '))}</div>` : ''}
<h1 class="rise">${fancy(headline)}</h1>${p['business.tagline'] && headline !== name ? `<p class="lead rise">${esc(name)}${city ? ` — proudly serving ${esc(city)} and the surrounding area.` : '.'}</p>` : `<p class="lead rise">${city ? `Proudly serving ${esc(city)} and the surrounding area.` : ''}</p>`}
${ctas ? `<div class="cta-row rise">${ctas}</div>` : ''}
${tid === 'atelier' && marks.length ? `<div class="marks">${marks.map((m) => `<div>${esc(m)}</div>`).join('')}</div>` : ''}
${(tid === 'studio' || tid === 'midnight') && marks.length ? `<div class="chips">${marks.map((m) => `<div>${esc(m)}</div>`).join('')}</div>` : ''}</div>`;
  // Without a photo, Atelier shows an oversized italic monogram and Heritage an "Est." seal — so the hero never feels empty.
  const deco = heroSrc ? media : tid === 'atelier' ? `<div class="mono" aria-hidden="true">${esc(name.trim()[0] ?? '')}</div>`
    : tid === 'heritage' ? `<div class="seal" aria-hidden="true"><div><small>${since ? 'Established' : 'Proudly local'}</small><b>${since ? esc(since) : esc(city ?? 'Texas')}</b><small>${esc(city ? `${city}, Texas` : 'Central Texas')}</small></div></div>` : '';
  const hero = tid === 'heritage'
    ? `<header class="hero${heroSrc ? '' : ' no-media'}" id="top"><div class="wrap">${heroInner}${deco}</div></header>${marks.length ? `<div class="trust"><div class="wrap">${marks.map((m) => `<div>${esc(m)}</div>`).join('')}</div></div>` : ''}`
    : `<header class="hero${heroSrc ? '' : ' no-media'}" id="top"><div class="wrap">${heroInner}${tid === 'atelier' ? deco : media}</div></header>`;

  const servicesSec = services.length ? `<section class="services" id="services"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">What we do</div><h2>Services</h2></div></div>
${tid === 'atelier' ? `<ol>${services.map((s, i) => `<li><span>${pad(i)}</span>${esc(s)}</li>`).join('')}</ol>`
    : `<div class="grid">${services.map((s, i) => `<div class="card"><b>${pad(i)}</b><h3>${esc(s)}</h3></div>`).join('')}</div>`}</div></section>` : '';
  const aboutSec = p['business.about'] ? `<section class="about" id="about"><div class="wrap"><div><div class="eyebrow">About</div><h2>${since ? `Since ${since}` : 'Our story'}</h2></div>
<p>${esc(p['business.about']).replace(/\n/g, '<br>')}</p></div></section>` : '';
  const faqSec = faq.length ? `<section class="faq" id="faq"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">Good to know</div><h2>Questions</h2></div></div>
${faq.map(([q, ...a]) => `<details><summary>${esc(q.trim())}</summary><p>${esc(a.join('|').trim())}</p></details>`).join('')}</div></section>` : '';
  const band = primaryCta ? `<section class="band"><div class="wrap"><h2>Ready when you are.</h2><div class="cta-row">${ctas}</div></div></section>` : '';
  const contact = `<section class="contact" id="contact"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">Get in touch</div><h2>Contact</h2></div></div><div class="contact-grid">
${phone ? `<div><h3>Call</h3><p><a href="tel:${esc(phone)}">${esc(p['business.phone'])}</a></p></div>` : ''}
${p['business.email'] ? `<div><h3>Email</h3><p><a href="mailto:${esc(p['business.email'])}">${esc(p['business.email'])}</a></p></div>` : ''}
<div><h3>${p['business.address'] ? 'Visit' : 'Service area'}</h3><p>${p['business.address'] ? `${esc(p['business.address'])}${city ? `<br>${esc(city)}, TX` : ''}` : city ? `${esc(city)} and nearby` : 'Central Texas'}</p></div>
${p['business.hours'] ? `<div><h3>Hours</h3><pre>${esc(p['business.hours'])}</pre></div>` : ''}
${review ? `<div><h3>Reviews</h3><p><a href="${esc(review)}" rel="noopener">Leave us a Google review →</a></p></div>` : ''}</div></div></section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}${city ? ` · ${esc(city)}, TX` : ''}</title><meta name="description" content="${esc(p['business.tagline'] || name)}">
<meta name="theme-color" content="${pal.bg}"><style>${BASE_CSS(pal, fonts)}${pal.g1 ? `:root{--g1:${pal.g1};--g2:${pal.g2};--g3:${pal.g3}}` : ''}${TEMPLATE_CSS[tid]}</style></head>
<body class="t-${tid}">${nav}${hero}${servicesSec}${aboutSec}${faqSec}${band}${contact}
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(name)}</span><span>${social.map(([l, u]) => `<a href="${esc(u)}" rel="noopener">${l}</a>`).join('')}</span></div></footer></body></html>`;
}
