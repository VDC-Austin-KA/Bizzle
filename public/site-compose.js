// Composable client-website templates. Each design is a curated recipe: layout modules (nav, hero, highlights,
// services, about, FAQ, call-to-action band, contact, footer) + design tokens (corners, buttons, surfaces, spacing,
// heading style) + typography pairings + four mood-matched palettes from a contrast-tested library.
// Output: no JavaScript, every client value escaped, only the CSS for the modules a design uses.
import { esc, safeUrl, digits, lines, pad, BASE_CSS } from './site-core.js';

const P = (name, bg, surface, ink, muted, line, primary, onPrimary, accent, extra = {}) => ({ name, bg, surface, ink, muted, line, primary, onPrimary, accent, ...extra });

// ---------- palette library (every palette is WCAG-checked in test/templates.test.js) ----------
export const PALETTES = {
  // warm lights
  linen: P('Linen', '#f7f3ec', '#efe8dc', '#201c17', '#5c544a', '#ddd2c2', '#201c17', '#f7f3ec', '#94663a'),
  sand: P('Sand & Saddle', '#f4eee4', '#ebe2d3', '#2a2118', '#5e5347', '#dacdb9', '#7a4a26', '#fdf8f1', '#9c6430'),
  terracotta: P('Terracotta', '#faf1ea', '#f2e2d6', '#2b1a14', '#634d3d', '#e6cdbb', '#a3432a', '#fff7f2', '#b5633a'),
  olive: P('Olive Grove', '#f3f2ea', '#e8e7da', '#23261b', '#55594a', '#d5d4c2', '#4b5a2a', '#f7f7ef', '#7d7d35'),
  blush: P('Blush & Berry', '#fbf3f1', '#f3e4e0', '#2c1b1c', '#665052', '#e8d1cc', '#8e3b46', '#fff6f5', '#b0606a'),
  butter: P('Butter & Ink', '#fbf7e9', '#f3ecd2', '#2a2614', '#5d573b', '#e5dcb8', '#2a2614', '#fbf7e9', '#9a7814'),
  // cool lights
  paper: P('Paper White', '#ffffff', '#f5f5f4', '#111111', '#595959', '#e5e5e5', '#111111', '#ffffff', '#6b6b6b'),
  mist: P('Harbor Mist', '#f4f6f8', '#e9edf1', '#14202b', '#4d5b69', '#d6dde4', '#1d3c5a', '#f4f6f8', '#4a739b'),
  glacier: P('Glacier', '#f2f7f8', '#e4eef0', '#0f2a30', '#465f67', '#d0e0e3', '#0e5e6f', '#f2f7f8', '#2a8396'),
  lavender: P('Lavender', '#f6f5fb', '#ecebf6', '#1d1a33', '#54506c', '#dcd9ec', '#4a3f9b', '#f6f5fb', '#6f63c6'),
  mint: P('Fresh Mint', '#f2f8f4', '#e4f0e8', '#13281c', '#475f50', '#d0e3d6', '#1f6b45', '#f2f8f4', '#348c5d'),
  slatelight: P('Slate', '#f1f3f5', '#e5e9ed', '#1a2026', '#505a64', '#d4dae0', '#2b3640', '#f1f3f5', '#66737f'),
  // vivid lights (with gradient tones for glow heroes)
  cobalt: P('Cobalt', '#ffffff', '#f4f6fb', '#0b1530', '#46506a', '#e3e7f0', '#1f4fd6', '#ffffff', '#1f4fd6', { g1: '#6c8cff', g2: '#a5b8ff', g3: '#7ee0ff' }),
  tomato: P('Tomato', '#ffffff', '#fbf4f2', '#24120e', '#5f4943', '#f0e1dc', '#c23a22', '#ffffff', '#c23a22', { g1: '#ff8a65', g2: '#ffc4a8', g3: '#ffd27a' }),
  evergreen: P('Evergreen', '#ffffff', '#f2f7f3', '#0e2416', '#43594b', '#dde9e0', '#17703e', '#ffffff', '#17703e', { g1: '#5ad48a', g2: '#b5f0c9', g3: '#8ce0d0' }),
  violet: P('Violet', '#ffffff', '#f7f4fd', '#1a1033', '#534a6b', '#e8e1f5', '#6d28d9', '#ffffff', '#6d28d9', { g1: '#a78bfa', g2: '#f0abfc', g3: '#93c5fd' }),
  lagoon: P('Lagoon', '#ffffff', '#f1f8f8', '#062a2c', '#3f5d5f', '#dcecec', '#0f766e', '#ffffff', '#0f766e', { g1: '#2dd4bf', g2: '#99f6e4', g3: '#7dd3fc' }),
  marigold: P('Marigold', '#ffffff', '#fdf7ec', '#261a05', '#5f5136', '#f1e4c8', '#9a5806', '#ffffff', '#9a5806', { g1: '#fbbf24', g2: '#fde68a', g3: '#fca5a5' }),
  // darks
  onyx: P('Onyx & Champagne', '#0c0c0d', '#161618', '#f2f2f0', '#a3a3a0', '#2a2a2d', '#f2f2f0', '#0c0c0d', '#c9a96e'),
  ink: P('Midnight Blue', '#0d1117', '#161b22', '#e6edf3', '#9aa6b2', '#28303a', '#58a6ff', '#071222', '#58a6ff', { g1: '#1f6feb', g2: '#8957e5', g3: '#58a6ff' }),
  forestnight: P('Forest Night', '#0d1611', '#14211a', '#eaf2ec', '#9bb0a2', '#24372b', '#7ccf9a', '#0b1a11', '#7ccf9a', { g1: '#2ea043', g2: '#7ccf9a', g3: '#1b7f5a' }),
  wine: P('Wine Cellar', '#160c10', '#21131a', '#f5ebee', '#b59ea6', '#3a2430', '#e0a3b4', '#1f0e15', '#e0a3b4'),
  cocoa: P('Cocoa & Caramel', '#17110d', '#221a14', '#f4ece4', '#b3a596', '#3a2d23', '#e3b27a', '#1e140b', '#e3b27a'),
  abyss: P('Deep Sea', '#07141f', '#0d1f2e', '#e8f1f8', '#97abbd', '#1d3346', '#4fc3f7', '#04111b', '#4fc3f7', { g1: '#0277bd', g2: '#4fc3f7', g3: '#26a69a' }),
  plum: P('Plum Night', '#120f1a', '#1b1726', '#f1eef8', '#a8a2ba', '#2d273d', '#b69cff', '#150f26', '#b69cff', { g1: '#7c4dff', g2: '#b69cff', g3: '#ff80ab' }),
  ember: P('Ember', '#120d0b', '#1d1512', '#f6eeea', '#b3a49c', '#352722', '#ff7a45', '#1a0c06', '#ff7a45', { g1: '#ff5722', g2: '#ffab40', g3: '#ff7a45' }),
  // bold color blocks
  navyblock: P('Navy & Mustard', '#10213f', '#182c50', '#f3f5fa', '#b4bed3', '#2a3f66', '#f2c14e', '#1a1404', '#f2c14e'),
  greenblock: P('Racing Green', '#12372a', '#1a4636', '#f1f6f2', '#b2c7bb', '#2a5847', '#f4d58d', '#1d1705', '#f4d58d'),
  clayblock: P('Burnt Clay', '#7a3322', '#873b28', '#fbf1ea', '#efd3c6', '#9a4c38', '#fbf1ea', '#7a3322', '#f3c59a'),
  cobaltblock: P('Electric Blue', '#1638a8', '#1d43bd', '#f4f6ff', '#c3cdf5', '#3355c4', '#ffffff', '#1638a8', '#ffd166'),
};

// ---------- design tokens ----------
const RADIUS = { sharp: 0, soft: 8, round: 16, pill: 26 };
const DENSITY = { airy: 'clamp(84px,12vw,152px)', standard: 'clamp(68px,9vw,116px)', compact: 'clamp(52px,7vw,84px)' };
const tokenCss = (t) => `
:root{--r:${RADIUS[t.radius]}px;--btn-r:${t.btn === 'pill' ? '999px' : 'var(--r)'};--card-r:${Math.min(RADIUS[t.radius], 22)}px}
section{padding:${DENSITY[t.density]} 0}
h1,h2,h3{font-weight:${t.weight};overflow-wrap:break-word;${t.upper ? 'text-transform:uppercase;letter-spacing:-.01em;' : ''}}
${t.upper ? '.hero h1{font-size:clamp(38px,7vw,96px)!important;line-height:1}' : ''}
${t.weight >= 650 ? 'h1{letter-spacing:-.04em}h2{letter-spacing:-.03em}' : ''}
.btn{border-radius:var(--btn-r)}${t.btn === 'upper' ? '.btn{text-transform:uppercase;letter-spacing:.09em;font-size:12.5px;padding:16px 26px}' : ''}
.btn.line{border:1px solid currentColor}.btn.solid:hover{filter:brightness(1.08)}
.card{border-radius:var(--card-r);${{
    flat: 'background:var(--surface)',
    shadow: 'background:color-mix(in srgb,var(--bg) 70%,#fff);box-shadow:0 1px 2px #0000000d,0 18px 40px -22px #00000040',
    border: 'border:1px solid var(--line)',
    glass: 'background:linear-gradient(180deg,#ffffff10,#ffffff05);border:1px solid var(--line);backdrop-filter:blur(12px)',
  }[t.surface]}}
.nav{background:color-mix(in srgb,var(--bg) 84%,transparent);border-bottom:1px solid var(--line)}
${t.heads === 'center' ? '.sec-head{justify-content:center;text-align:center}' : ''}
.sec-head h2{margin-top:6px}`;

// ---------- module CSS (only the variants a design uses are emitted) ----------
const CSS = {
  nav: {
    standard: '',
    bar: '.topbar{background:var(--primary);color:var(--on-primary);font-size:13.5px}.topbar .wrap{display:flex;justify-content:space-between;height:40px;align-items:center;gap:16px}.topbar a{text-decoration:none;font-weight:600}',
    centered: '.nav .wrap{flex-direction:column;justify-content:center;height:auto;padding-block:18px;gap:8px}.nav .brand{font-size:26px}.nav .links{margin:0}.nav .wrap>.btn{display:none}@media (max-width:760px){.nav .wrap>.btn{display:inline-flex}}',
    minimal: '.nav .links{display:none}.nav .wrap>.btn{margin-left:auto}',
    float: '.nav{position:sticky;top:14px;background:none;border:0;backdrop-filter:none;-webkit-backdrop-filter:none}.nav .wrap{max-width:1080px;height:62px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line);border-radius:999px;padding:0 10px 0 24px}',
  },
  hero: {
    left: '.hero{padding:clamp(80px,11vw,150px) 0 clamp(56px,7vw,96px)}.hero h1{max-width:15ch}.hero .lead{margin:24px 0 36px}.hero-media{margin-top:64px;aspect-ratio:21/9;overflow:hidden;border-radius:var(--card-r)}.hero.no-media .wrap{position:relative}.hero.no-media .copy{position:relative;z-index:1}',
    center: '.hero{padding:clamp(96px,13vw,170px) 0 clamp(64px,8vw,104px);text-align:center}.hero h1{max-width:16ch;margin-inline:auto}.hero .lead{margin:24px auto 36px}.hero .cta-row,.hero .hl{justify-content:center}.hero-media{margin:64px auto 0;max-width:1000px;aspect-ratio:16/8;overflow:hidden;border-radius:var(--card-r)}',
    split: '.hero{padding:clamp(64px,9vw,128px) 0}.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(32px,5vw,72px);align-items:center}.hero h1{max-width:14ch}.hero .lead{margin:22px 0 34px}.hero-media{aspect-ratio:4/5;overflow:hidden;border-radius:var(--card-r)}@media (max-width:860px){.hero .wrap{grid-template-columns:1fr}.hero-media{aspect-ratio:16/10}}',
    'split-rev': '.hero{padding:clamp(64px,9vw,128px) 0}.hero .wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(32px,5vw,72px);align-items:center}.hero .wrap>.copy{order:2}.hero h1{max-width:14ch}.hero .lead{margin:22px 0 34px}.hero-media{aspect-ratio:1/1;overflow:hidden;border-radius:var(--card-r)}@media (max-width:860px){.hero .wrap{grid-template-columns:1fr}.hero .wrap>.copy{order:0}.hero-media{aspect-ratio:16/10}}',
    cover: '.hero{position:relative;min-height:min(86vh,820px);display:flex;align-items:center;color:var(--on-primary);background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,#000));overflow:hidden}.hero.has-media{color:#fff}.hero .bg{position:absolute;inset:0}.hero .bg img{width:100%;height:100%;object-fit:cover}.hero.has-media .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#000000b8,#00000040)}.hero .wrap{position:relative;width:100%}.hero h1{max-width:14ch}.hero .lead{color:inherit;opacity:.88;margin:24px 0 36px}.hero .eyebrow{color:inherit;opacity:.85}.hero .btn.solid{background:var(--on-primary);color:var(--primary)}.hero.has-media .btn.solid{background:#fff;color:#111}.hero.no-media{background-image:radial-gradient(circle at 80% 20%,#ffffff1f,transparent 40%),linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 65%,#000))}',
    'cover-low': '.hero{position:relative;min-height:min(92vh,880px);display:flex;align-items:flex-end;color:var(--on-primary);background:linear-gradient(160deg,var(--primary),color-mix(in srgb,var(--primary) 60%,#000));overflow:hidden;padding-bottom:clamp(48px,7vw,96px)}.hero.has-media{color:#fff}.hero .bg{position:absolute;inset:0}.hero .bg img{width:100%;height:100%;object-fit:cover}.hero.has-media .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#000000d0,#00000010 70%)}.hero .wrap{position:relative;width:100%}.hero h1{font-size:clamp(48px,8vw,112px);max-width:12ch}.hero .lead{color:inherit;opacity:.88;margin:20px 0 32px}.hero .eyebrow{color:inherit;opacity:.85}.hero .btn.solid{background:var(--on-primary);color:var(--primary)}.hero.has-media .btn.solid{background:#fff;color:#111}',
    mega: '.hero{padding:clamp(72px,10vw,140px) 0 clamp(48px,6vw,88px)}.hero h1{font-size:clamp(56px,11vw,150px);line-height:.95;max-width:none}.hero .under{display:flex;justify-content:space-between;align-items:end;gap:32px;flex-wrap:wrap;margin-top:40px;padding-top:28px;border-top:1px solid var(--line)}.hero .lead{margin:0;max-width:520px}.hero-media{margin-top:56px;aspect-ratio:21/8;overflow:hidden;border-radius:var(--card-r)}',
    card: '.hero{padding:clamp(56px,8vw,112px) 0;background:var(--surface)}.hero.has-media{background:var(--bg)}.hero .wrap{position:relative}.hero .bg{position:absolute;inset:0 clamp(20px,5vw,48px);border-radius:var(--card-r);overflow:hidden}.hero .bg img{width:100%;height:100%;object-fit:cover}.hero .copy{position:relative;background:var(--bg);border-radius:var(--card-r);padding:clamp(32px,5vw,64px);max-width:660px;box-shadow:0 30px 60px -30px #00000040;margin:clamp(24px,6vw,96px) 0 clamp(24px,6vw,96px) clamp(0px,4vw,56px)}.hero h1{font-size:clamp(38px,5vw,64px)}.hero .lead{margin:20px 0 30px}',
    glow: '.hero{position:relative;overflow:hidden;padding:clamp(96px,13vw,170px) 0 clamp(72px,9vw,120px)}.hero::before{content:"";position:absolute;inset:-30% -10% auto 30%;height:150%;z-index:-1;filter:blur(64px);opacity:.7;background:radial-gradient(40% 50% at 30% 40%,var(--g1),transparent 70%),radial-gradient(35% 45% at 70% 30%,var(--g2),transparent 70%),radial-gradient(40% 40% at 55% 75%,var(--g3),transparent 70%)}.hero h1{max-width:14ch}.hero .lead{margin:24px 0 36px}.hero-media{margin-top:64px;aspect-ratio:16/8;overflow:hidden;border-radius:var(--card-r);box-shadow:0 40px 80px -40px #0000004d}',
    magazine: '.hero{padding:clamp(40px,6vw,72px) 0 clamp(56px,8vw,104px)}.hero .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:14px 0;border-block:1px solid var(--ink);font-size:13px;letter-spacing:.14em;text-transform:uppercase}.hero .meta span:nth-child(2){text-align:center}.hero .meta span:last-child{text-align:right}.hero h1{font-size:clamp(52px,9vw,128px);line-height:.95;margin:clamp(40px,6vw,72px) 0 clamp(28px,4vw,48px);max-width:none}.hero .under{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:end}.hero .lead{margin:0}.hero .cta-row{justify-content:flex-end}.hero-media{margin-top:48px;aspect-ratio:21/9;overflow:hidden}@media (max-width:760px){.hero .under{grid-template-columns:1fr}.hero .cta-row{justify-content:flex-start}.hero .meta span:nth-child(2){display:none}}',
  },
  deco: {
    none: '',
    mono: '.deco-mono{font-family:var(--display);font-style:italic;font-size:clamp(220px,30vw,440px);line-height:.8;color:var(--accent);opacity:.15;user-select:none;justify-self:center}.hero.no-media .wrap>.deco-mono{position:absolute;right:clamp(20px,5vw,48px);top:44%;transform:translateY(-50%)}@media (max-width:860px){.deco-mono{display:none}}',
    seal: '.deco-seal{justify-self:center;width:clamp(220px,24vw,300px);aspect-ratio:1;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;text-align:center;position:relative;background:var(--surface)}.deco-seal::before{content:"";position:absolute;inset:12px;border-radius:50%;border:1px dashed var(--accent)}.deco-seal small{display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}.deco-seal b{display:block;font-family:var(--display);font-weight:500;font-size:clamp(44px,5vw,64px);line-height:1;margin:8px 0;color:var(--primary)}.hero.no-media .wrap>.deco-seal{position:absolute;right:clamp(20px,5vw,48px);top:50%;transform:translateY(-50%)}@media (max-width:860px){.deco-seal{display:none}}',
    stack: '.deco-stack{background:var(--surface);border-radius:var(--card-r);padding:clamp(24px,3vw,40px);display:grid;gap:4px;align-self:stretch;align-content:center}.deco-stack div{font-family:var(--display);font-size:clamp(22px,2.4vw,32px);line-height:1.25;padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}.deco-stack div span{font-family:var(--body);font-size:12px;color:var(--accent);letter-spacing:.1em}.deco-stack div:last-child{border:0}.hero.no-media .wrap>.deco-stack{margin-top:48px}',
    pattern: '.deco-pattern{border-radius:var(--card-r);min-height:clamp(260px,32vw,440px);background:radial-gradient(circle,color-mix(in srgb,var(--accent) 45%,transparent) 1.4px,transparent 1.6px) 0 0/22px 22px,var(--surface);display:grid;place-items:end start;padding:28px;align-self:stretch}.deco-pattern b{font-family:var(--display);font-size:clamp(40px,5vw,72px);font-weight:500;line-height:1;color:var(--primary)}.deco-pattern small{display:block;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;font-size:12px;margin-top:8px}.hero.no-media .wrap>.deco-pattern{margin-top:48px}',
  },
  hl: {
    marks: '.hl{display:flex;gap:40px;flex-wrap:wrap;margin-top:48px;padding-top:24px;border-top:1px solid color-mix(in srgb,currentColor 25%,transparent)}.hl div{font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.8}.hl div::before{content:"—";margin-right:10px;color:var(--accent)}',
    chips: '.hl{display:flex;gap:10px;flex-wrap:wrap;margin-top:36px}.hl div{border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:999px;padding:8px 16px;font-size:14px;font-weight:500;background:color-mix(in srgb,var(--bg) 60%,transparent)}.hl div::before{content:"✓";color:var(--accent);font-weight:700;margin-right:8px}',
    dots: '.hl{display:flex;gap:28px;flex-wrap:wrap;margin-top:40px;font-size:14.5px;opacity:.85}.hl div::before{content:"◆";color:var(--accent);margin-right:8px;font-size:10px;vertical-align:2px}',
    badges: '.hl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:40px;max-width:640px}.hl div{border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:var(--card-r);padding:14px;font-size:14px;font-weight:600;line-height:1.3}.hl div::before{content:"✓";display:block;color:var(--accent);margin-bottom:6px}',
    strip: '.strip{background:var(--surface);border-block:1px solid var(--line)}.strip .wrap{display:flex;justify-content:space-around;gap:24px;flex-wrap:wrap;padding-block:26px}.strip div div{font-family:var(--display);font-size:19px;display:flex;align-items:center;gap:12px}.strip div div::before{content:"";width:8px;height:8px;transform:rotate(45deg);background:var(--accent)}',
  },
  svc: {
    numbered: '.svc{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));border-top:1px solid var(--line)}.svc li{display:flex;gap:22px;align-items:baseline;padding:28px 24px 28px 0;border-bottom:1px solid var(--line);font-family:var(--display);font-size:clamp(23px,2.3vw,30px)}.svc li span{font-family:var(--body);font-size:13px;color:var(--accent);letter-spacing:.1em}',
    cards: '.svc{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.svc .card{padding:28px;transition:transform .25s}.svc .card:hover{transform:translateY(-3px)}.svc .card b{display:grid;place-items:center;width:40px;height:40px;border-radius:min(var(--card-r),12px);background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent);font-size:13px;margin-bottom:18px}.svc .card h3{font-family:var(--body);font-weight:600;font-size:19px;text-transform:none;letter-spacing:-.01em}',
    bordered: '.svc{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));border:1px solid var(--line);border-radius:var(--card-r);overflow:hidden}.svc>div{padding:32px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);margin:0 -1px -1px 0}.svc b{font-family:var(--display);color:var(--accent);font-size:28px;font-weight:500}.svc h3{margin-top:10px;font-size:23px}',
    rows: '.svc{border-top:1px solid var(--line)}.svc>div{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:clamp(20px,2.6vw,30px) 0;border-bottom:1px solid var(--line);transition:padding .25s}.svc>div:hover{padding-left:12px}.svc h3{font-size:clamp(26px,3.4vw,46px)}.svc>div span{font-size:13px;color:var(--muted);letter-spacing:.12em;white-space:nowrap}.svc>div span::after{content:"  →";color:var(--accent)}',
    twocol: '.svc{columns:2 320px;column-gap:56px;list-style:none;padding:0;margin:0}.svc li{break-inside:avoid;padding:14px 0 14px 26px;position:relative;font-size:clamp(19px,1.8vw,23px);border-bottom:1px solid var(--line)}.svc li::before{content:"";position:absolute;left:0;top:50%;width:9px;height:9px;border-radius:50%;background:var(--accent);transform:translateY(-50%)}',
    tags: '.svc{display:flex;flex-wrap:wrap;gap:12px}.svc span{font-family:var(--display);font-size:clamp(20px,2.2vw,28px);border:1px solid var(--line);border-radius:999px;padding:12px 26px;background:var(--surface)}',
    tiles: '.svc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.svc .card{position:relative;overflow:hidden;padding:30px 26px 26px;min-height:170px;display:flex;align-items:flex-end}.svc .card b{position:absolute;top:-14px;right:10px;font-family:var(--display);font-size:110px;line-height:1;color:var(--accent);opacity:.18}.svc .card h3{position:relative;font-size:21px}',
    columns: '.svc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:36px 40px}.svc>div{border-top:2px solid var(--ink);padding-top:18px}.svc b{font-size:13px;letter-spacing:.14em;color:var(--accent)}.svc h3{margin-top:10px;font-size:23px}',
  },
  about: {
    split: '.about .wrap{display:grid;grid-template-columns:1fr 1.4fr;gap:clamp(32px,6vw,96px)}.about p{font-family:var(--display);font-size:clamp(22px,2.4vw,32px);line-height:1.38;margin:0}@media (max-width:760px){.about .wrap{grid-template-columns:1fr}}',
    quote: '.about{text-align:center}.about blockquote{margin:0 auto;max-width:880px;font-family:var(--display);font-size:clamp(28px,3.4vw,46px);line-height:1.3}.about blockquote::before{content:"“";display:block;font-size:96px;line-height:.6;color:var(--accent);margin-bottom:18px}.about cite{display:block;margin-top:26px;font-style:normal;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}',
    band: '.about{background:var(--primary);color:var(--on-primary)}.about .eyebrow{color:inherit;opacity:.75}.about .wrap{display:grid;grid-template-columns:1fr 1.3fr;gap:clamp(32px,6vw,80px)}.about p{font-family:var(--display);font-size:clamp(22px,2.4vw,30px);line-height:1.4;margin:0}@media (max-width:760px){.about .wrap{grid-template-columns:1fr}}',
    rule: '.about .wrap>div{max-width:760px;border-left:3px solid var(--accent);padding-left:clamp(20px,3vw,40px)}.about p{font-size:clamp(19px,1.9vw,23px);color:var(--muted);margin:16px 0 0}',
    stats: '.about .wrap{display:grid;grid-template-columns:1.2fr 1fr;gap:clamp(32px,5vw,72px);align-items:center}.about p{font-size:19px;color:var(--muted);margin:16px 0 0}.stats{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stats .card{padding:22px}.stats b{display:block;font-family:var(--display);font-size:clamp(34px,4vw,52px);line-height:1;color:var(--primary)}.stats small{color:var(--muted);font-size:13px}@media (max-width:760px){.about .wrap{grid-template-columns:1fr}}',
  },
  faq: {
    lines: '',
    cards: '.faq .list{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.faq details,.faq details:last-child{border:0;padding:22px 24px}.faq details{border-radius:var(--card-r)}',
    boxed: '.faq .list{display:grid;gap:10px;max-width:880px}.faq details,.faq details:last-child{border:1px solid var(--line);border-radius:var(--card-r);padding:18px 22px;background:var(--surface)}',
  },
  band: {
    solid: '.band{background:var(--primary);color:var(--on-primary);text-align:center}.band h2{margin-bottom:28px}.band .cta-row{justify-content:center}.band .btn.solid{background:var(--on-primary);color:var(--primary)}.band .btn.line{border-color:var(--on-primary)}',
    card: '.band .card{padding:clamp(44px,7vw,84px);text-align:center;background:var(--surface)}.band h2{margin-bottom:28px}.band .cta-row{justify-content:center}',
    outline: '.band .box{border:1px solid var(--ink);border-radius:var(--card-r);padding:clamp(44px,7vw,84px);text-align:center}.band h2{margin-bottom:28px}.band .cta-row{justify-content:center}',
    split: '.band .box{display:flex;justify-content:space-between;align-items:center;gap:28px;flex-wrap:wrap;background:var(--surface);border-radius:var(--card-r);padding:clamp(32px,5vw,56px)}.band h2{font-size:clamp(28px,3.4vw,44px)}',
    minimal: '.band{text-align:center}.band h2{margin-bottom:18px}.band a.go{font-size:19px;font-weight:600;text-decoration:none;border-bottom:2px solid var(--accent);padding-bottom:4px}',
  },
  contact: {
    grid: '',
    bignum: '.bignum{display:block;font-family:var(--display);font-size:clamp(44px,8vw,112px);line-height:1;text-decoration:none;margin-bottom:48px;letter-spacing:-.02em}.bignum:hover{color:var(--accent)}',
    card: '.contact .card{padding:clamp(28px,4vw,48px)}',
    center: '.contact{text-align:center}.contact .contact-grid{justify-items:center}.contact .sec-head{justify-content:center}',
  },
  footer: {
    simple: '',
    big: '.foot-big{width:100%;font-family:var(--display);font-size:clamp(44px,9vw,128px);line-height:1;letter-spacing:-.03em;padding:56px 0 28px;border-top:1px solid var(--line);color:var(--ink)}',
  },
};

// ---------- design recipes ----------
// layout: nav hero deco highlights services about faq band contact footer
// tokens: radius button surface density headings weight uppercase
const R = (id, name, category, tagline, fonts, palettes, layout, tokens) => {
  const [nav, hero, deco, hl, svc, about, faq, band, contact, footer] = layout.split(' ');
  const [radius, btn, surface, density, heads, weight, upper] = tokens.split(' ');
  return [id, { name, category, tagline, kind: 'composed', palettesIds: palettes.split(' '),
    fontsList: fonts.split(' ').map((pair) => pair.split('/')),
    layout: { nav, hero, deco, hl, svc, about, faq, band, contact, footer },
    tokens: { radius, btn, surface, density, heads, weight: Number(weight), upper: upper === 'upper' } }];
};

const RECIPES = [
  // Elegant
  R('maison', 'Maison', 'Elegant', 'Couture calm — centered serif and fine rules.', 'playfair/inter instrument/inter', 'linen blush paper butter', 'centered center none dots columns quote lines outline center big', 'sharp upper border airy center 400 -'),
  R('riviera', 'Riviera', 'Elegant', 'Sun-washed and refined, photo on the left.', 'playfair/outfit instrument/inter', 'sand glacier blush mist', 'standard split-rev pattern marks rows split boxed minimal grid simple', 'soft pill flat airy left 400 -'),
  R('sonnet', 'Sonnet', 'Elegant', 'A magazine cover for your business.', 'instrument/inter cormorant/inter', 'paper linen butter slatelight', 'minimal magazine mono marks numbered rule lines solid bignum simple', 'sharp square border airy left 400 -'),
  R('orchard', 'Orchard', 'Elegant', 'Gentle, natural and quietly confident.', 'fraunces/inter playfair/manrope', 'olive mint sand butter', 'standard split stack strip twocol stats cards card card simple', 'round square flat standard left 500 -'),
  R('gallery', 'Gallery', 'Elegant', 'Oversized type and museum-like whitespace.', 'dmserif/inter instrument/outfit', 'paper mist blush linen', 'minimal mega none dots tags quote lines minimal center big', 'sharp upper border airy center 400 -'),
  R('velvet', 'Velvet', 'Elegant', 'Dark luxury with a full-bleed hero.', 'playfair/inter cormorant/manrope', 'onyx wine cocoa plum', 'standard cover pattern marks numbered split lines outline bignum simple', 'sharp upper border airy left 400 -'),
  R('parlor', 'Parlor', 'Elegant', 'Classic hospitality, framed and welcoming.', 'dmserif/inter fraunces/outfit', 'sand terracotta olive linen', 'bar card seal badges bordered band boxed solid grid simple', 'soft square border standard left 400 -'),
  R('noir', 'Noir', 'Elegant', 'Editorial black with a single gold detail.', 'cormorant/inter instrument/inter', 'onyx ink cocoa forestnight', 'standard left mono marks rows rule lines minimal center simple', 'sharp upper border airy left 400 -'),
  // Modern
  R('vector', 'Vector', 'Modern', 'Bright gradients and crisp product-style cards.', 'spacegrotesk/inter outfit/inter', 'cobalt violet lagoon tomato', 'standard glow none chips cards stats cards card grid simple', 'round pill shadow standard left 700 -'),
  R('pulse', 'Pulse', 'Modern', 'Centered and energetic with a floating menu.', 'outfit/inter manrope/inter', 'violet cobalt marigold evergreen', 'float center none chips tiles split boxed split card simple', 'pill pill shadow standard center 650 -'),
  R('blueprint', 'Blueprint', 'Modern', 'Precise grid, technical and trustworthy.', 'spacegrotesk/inter inter/inter', 'paper mist slatelight glacier', 'standard split pattern badges bordered stats cards split grid simple', 'sharp square border compact left 600 -'),
  R('northwind', 'Northwind', 'Modern', 'Clean, cool and confident.', 'manrope/inter outfit/inter', 'glacier mist lagoon cobalt', 'standard left stack chips rows quote lines card bignum simple', 'soft pill flat standard left 700 -'),
  R('ledger', 'Ledger', 'Modern', 'Newspaper structure with modern type.', 'inter/inter spacegrotesk/inter', 'paper slatelight mist butter', 'minimal magazine none dots columns rule lines outline grid simple', 'sharp square border standard left 600 -'),
  R('bloom', 'Bloom', 'Modern', 'Soft color, rounded and friendly.', 'outfit/inter syne/inter', 'tomato violet marigold lagoon', 'float glow none chips tags band cards card center simple', 'pill pill shadow airy center 600 -'),
  R('summit', 'Summit', 'Modern', 'Big hero, bold cards — built for action.', 'outfit/inter spacegrotesk/inter', 'evergreen cobalt lagoon slatelight', 'standard cover pattern strip cards stats boxed solid card simple', 'soft square shadow standard left 700 -'),
  R('metric', 'Metric', 'Modern', 'Data-driven look with stat cards.', 'spacegrotesk/inter manrope/inter', 'cobalt lagoon slatelight violet', 'standard split-rev pattern badges tiles stats cards split bignum simple', 'round pill border compact left 700 -'),
  R('clarity', 'Clarity', 'Modern', 'Apple-style simplicity, centered.', 'inter/inter outfit/inter', 'paper mist glacier lavender', 'minimal center none chips twocol quote lines minimal center simple', 'round pill flat airy center 600 -'),
  R('frame', 'Frame', 'Modern', 'Your story in a floating card.', 'manrope/inter outfit/inter', 'lavender mist mint glacier', 'standard card stack chips cards split boxed outline card simple', 'round pill shadow standard left 700 -'),
  // Bold
  R('headline', 'Headline', 'Bold', 'Huge uppercase type that demands attention.', 'syne/inter dmserif/inter', 'tomato cobalt evergreen violet', 'standard mega none strip rows band lines solid bignum big', 'sharp upper border compact left 800 upper'),
  R('marquee', 'Marquee', 'Bold', 'Full-screen photo with a big bottom headline.', 'syne/inter spacegrotesk/inter', 'navyblock greenblock clayblock ember', 'minimal cover-low none strip tags quote cards solid bignum big', 'sharp upper border standard left 800 upper'),
  R('billboard', 'Billboard', 'Bold', 'Poster-sized serif, centered and confident.', 'dmserif/inter playfair/inter', 'butter blush sand terracotta', 'centered mega none dots tiles band boxed split center simple', 'sharp square border standard center 400 -'),
  R('poster', 'Poster', 'Bold', 'Color-block poster with a giant initial.', 'syne/inter outfit/inter', 'clayblock navyblock greenblock cobaltblock', 'standard split mono badges numbered band cards solid bignum simple', 'sharp square flat compact left 800 upper'),
  R('stadium', 'Stadium', 'Bold', 'Dark, punchy and big — sports-bar energy.', 'outfit/inter syne/inter', 'ink ember abyss forestnight', 'standard cover none chips cards stats boxed card card simple', 'round pill glass standard center 800 -'),
  R('signal', 'Signal', 'Bold', 'Neon glow on deep dark.', 'spacegrotesk/inter syne/inter', 'ink plum abyss ember', 'standard glow none dots rows stats lines split bignum simple', 'soft pill glass standard left 700 -'),
  R('bolt', 'Bolt', 'Bold', 'Bright, loud and unmissable.', 'syne/inter outfit/inter', 'marigold tomato cobalt evergreen', 'standard split-rev seal strip bordered band boxed solid grid simple', 'sharp upper border compact left 800 upper'),
  R('neon', 'Neon', 'Bold', 'Rounded dark glass with a glowing accent.', 'outfit/inter spacegrotesk/inter', 'plum ink ember abyss', 'float center none chips tiles quote cards card center simple', 'pill pill glass airy center 700 -'),
  // Warm
  R('hearth', 'Hearth', 'Warm', 'Homey craftsmanship with an "Est." seal.', 'fraunces/inter dmserif/outfit', 'terracotta sand olive butter', 'standard split seal strip bordered split boxed card card simple', 'soft square border standard left 500 -'),
  R('porch', 'Porch', 'Warm', 'Friendly and approachable, like a neighbor.', 'dmserif/outfit fraunces/manrope', 'butter sand mint blush', 'standard left pattern badges twocol quote lines solid grid simple', 'round pill flat standard left 400 -'),
  R('meadow', 'Meadow', 'Warm', 'Fresh, airy and centered.', 'fraunces/outfit playfair/inter', 'mint olive butter glacier', 'standard center none chips cards split boxed card center simple', 'round pill shadow airy center 500 -'),
  R('workshop', 'Workshop', 'Warm', 'Hand-crafted feel with honest structure.', 'instrument/inter fraunces/inter', 'sand linen terracotta olive', 'standard card stack marks columns rule lines outline bignum simple', 'soft upper border standard left 400 -'),
  R('sunday', 'Sunday', 'Warm', 'Cheerful pastels with rounded edges.', 'outfit/inter dmserif/inter', 'blush butter mint lavender', 'standard split-rev mono chips tags stats cards split card simple', 'pill pill flat airy left 600 -'),
  R('homestead', 'Homestead', 'Warm', 'Big photo welcome with a trust strip.', 'fraunces/inter playfair/manrope', 'olive terracotta sand slatelight', 'bar cover none strip numbered band boxed solid grid simple', 'soft square border standard left 500 -'),
  R('corner', 'Corner Shop', 'Warm', 'Main-street charm, centered sign-style.', 'dmserif/inter instrument/outfit', 'terracotta butter blush mint', 'centered left seal dots tags quote cards minimal center simple', 'round pill border standard center 400 -'),
  R('kiln', 'Kiln', 'Warm', 'Artisan magazine with warm tones.', 'playfair/outfit fraunces/inter', 'butter terracotta sand blush', 'standard magazine none badges tiles split boxed card bignum simple', 'soft square shadow standard left 600 -'),
  R('trail', 'Trail', 'Warm', 'Outdoorsy and rugged, with a dotted map panel.', 'spacegrotesk/inter fraunces/inter', 'olive evergreen mint sand', 'standard split pattern marks rows stats lines outline card simple', 'sharp upper border standard left 600 -'),
  R('harbor', 'Harbor', 'Warm', 'Coastal calm with a full-screen photo.', 'playfair/inter instrument/inter', 'glacier mist sand linen', 'float cover-low none dots twocol rule cards split center simple', 'round pill flat airy left 500 -'),
  // Dark
  R('obsidian', 'Obsidian', 'Dark', 'Sleek dark split with glass cards.', 'manrope/inter spacegrotesk/inter', 'onyx ink forestnight cocoa', 'standard split stack dots cards split boxed card bignum simple', 'round square glass standard left 700 -'),
  R('aurora', 'Aurora', 'Dark', 'Northern-lights glow, centered.', 'outfit/inter manrope/inter', 'abyss plum ink forestnight', 'float glow none chips tiles quote cards outline center simple', 'pill pill glass airy center 700 -'),
  R('nocturne', 'Nocturne', 'Dark', 'Night-edition magazine.', 'instrument/inter playfair/inter', 'onyx wine plum cocoa', 'minimal magazine none marks columns rule lines minimal grid big', 'sharp upper border airy left 400 -'),
  R('forge', 'Forge', 'Dark', 'Industrial strength with a fiery accent.', 'syne/inter spacegrotesk/inter', 'ember cocoa onyx wine', 'standard cover-low none strip rows band boxed solid bignum simple', 'sharp upper border compact left 800 upper'),
  R('deepsea', 'Deep Sea', 'Dark', 'Calm, deep and technical.', 'spacegrotesk/inter outfit/inter', 'abyss ink forestnight plum', 'standard split-rev pattern badges bordered stats cards split card simple', 'soft pill glass standard left 600 -'),
  // Minimal
  R('blanc', 'Blanc', 'Minimal', 'Pure white, centered, nothing extra.', 'inter/inter instrument/inter', 'paper mist linen slatelight', 'minimal center none dots twocol rule lines minimal center simple', 'sharp square flat airy center 500 -'),
  R('swiss', 'Swiss', 'Minimal', 'International style — grid, rules, bold sans.', 'spacegrotesk/inter inter/inter', 'paper slatelight butter mist', 'standard left none marks columns split lines outline grid big', 'sharp square border compact left 700 -'),
  R('haiku', 'Haiku', 'Minimal', 'A few words, beautifully set.', 'instrument/inter cormorant/inter', 'paper linen mist mint', 'minimal mega none dots numbered quote lines minimal center simple', 'sharp upper flat airy center 400 -'),
  R('monolith', 'Monolith', 'Minimal', 'Stark contrast with a single bold initial.', 'dmserif/inter syne/inter', 'paper onyx slatelight linen', 'standard split mono marks rows rule boxed outline bignum simple', 'sharp square border standard left 400 -'),
  R('still', 'Still', 'Minimal', 'Soft, quiet and spacious.', 'outfit/inter instrument/outfit', 'mist lavender glacier blush', 'centered left pattern chips tags split cards card card simple', 'round pill flat airy left 500 -'),
];

const FONT_NAMES = { inter: 'Inter', cormorant: 'Cormorant', fraunces: 'Fraunces', manrope: 'Manrope', playfair: 'Playfair', dmserif: 'DM Serif', spacegrotesk: 'Space Grotesk', instrument: 'Instrument Serif', outfit: 'Outfit', syne: 'Syne' };
export const COMPOSED = Object.fromEntries(RECIPES.map(([id, r]) => [id, {
  ...r,
  palettes: Object.fromEntries(r.palettesIds.map((pid) => [pid, PALETTES[pid]])),
  fonts: Object.fromEntries(r.fontsList.map(([d, b]) => [`${d}-${b}`, { name: d === b ? FONT_NAMES[d] : `${FONT_NAMES[d]} & ${FONT_NAMES[b]}`, display: d, body: b }])),
}]));

// ---------- renderer ----------
export function renderComposed(t, pal, fonts, p, { logoSrc = null, heroSrc = null, workflows = [] } = {}) {
  const L = t.layout;
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
  const coverHero = L.hero === 'cover' || L.hero === 'cover-low' || L.hero === 'card';
  const media = heroSrc && !coverHero ? `<div class="hero-media rise"><img src="${esc(heroSrc)}" alt="${esc(name)}"></div>` : '';
  const bgImg = heroSrc && coverHero ? `<div class="bg"><img src="${esc(heroSrc)}" alt=""></div>` : '';
  const sideBySide = L.hero === 'split' || L.hero === 'split-rev';
  const decoHtml = heroSrc || L.deco === 'none' || coverHero ? '' : {
    mono: `<div class="deco-mono" aria-hidden="true">${esc(name.trim()[0] ?? '')}</div>`,
    seal: `<div class="deco-seal" aria-hidden="true"><div><small>${since ? 'Established' : 'Proudly local'}</small><b>${since ? esc(since) : esc(city ?? 'Texas')}</b><small>${esc(city ? `${city}, Texas` : 'Central Texas')}</small></div></div>`,
    stack: `<div class="deco-stack" aria-hidden="true">${services.slice(0, 5).map((s, i) => `<div>${esc(s)}<span>${pad(i)}</span></div>`).join('')}</div>`,
    pattern: `<div class="deco-pattern" aria-hidden="true"><div><b>${since ? `Est. ${esc(since)}` : esc(city ?? 'Local')}</b><small>${esc(city ? `${city}, Texas` : 'Central Texas')}</small></div></div>`,
  }[L.deco];
  // Split heroes need something in the second column; without photo or deco, fall back to the pattern panel.
  const side = sideBySide ? (media || decoHtml || CSS.deco.pattern && `<div class="deco-pattern" aria-hidden="true"><div><b>${esc(city ?? name)}</b><small>${esc(since ? `Since ${since}` : 'Central Texas')}</small></div></div>`) : '';
  const usedDeco = sideBySide && !media && !decoHtml ? 'pattern' : L.deco;

  const hlInline = L.hl !== 'strip' && marks.length ? `<div class="hl rise">${marks.map((m) => `<div>${esc(m)}</div>`).join('')}</div>` : '';
  const eyebrowHtml = eyebrow ? `<div class="eyebrow rise">${esc(eyebrow)}</div>` : '';
  const leadText = p['business.tagline'] && headline !== name ? `${esc(name)}${city ? ` — proudly serving ${esc(city)} and the surrounding area.` : '.'}` : city ? `Proudly serving ${esc(city)} and the surrounding area.` : '';
  const lead = leadText ? `<p class="lead rise">${leadText}</p>` : '';
  const ctaRow = ctas ? `<div class="cta-row rise">${ctas}</div>` : '';
  const h1 = `<h1 class="rise">${esc(headline)}</h1>`;

  let heroBody;
  if (L.hero === 'mega') heroBody = `<div class="copy">${eyebrowHtml}${h1}<div class="under">${lead || '<span></span>'}${ctaRow}</div>${hlInline}</div>${media}`;
  else if (L.hero === 'magazine') heroBody = `<div class="copy"><div class="meta"><span>${esc(city ? `${city}, TX` : name)}</span><span>${esc(since ? `Est. ${since}` : 'Local & trusted')}</span><span>${phone ? esc(p['business.phone']) : ''}</span></div>${h1}<div class="under">${lead || '<span></span>'}${ctaRow}</div>${hlInline}</div>${media}`;
  else if (L.hero === 'card') heroBody = `${bgImg}<div class="copy">${eyebrowHtml}${h1}${lead}${ctaRow}${hlInline}</div>${!heroSrc ? decoHtml : ''}`;
  else if (coverHero) heroBody = `<div class="copy">${eyebrowHtml}${h1}${lead}${ctaRow}${hlInline}</div>`;
  else heroBody = `<div class="copy">${eyebrowHtml}${h1}${lead}${ctaRow}${hlInline}</div>${sideBySide ? side : media || decoHtml}`;
  const hero = `<header class="hero${heroSrc ? ' has-media' : ' no-media'}" id="top">${coverHero && L.hero !== 'card' ? bgImg : ''}<div class="wrap">${heroBody}</div></header>`;
  const strip = L.hl === 'strip' && marks.length ? `<div class="strip"><div class="wrap">${marks.map((m) => `<div>${esc(m)}</div>`).join('')}</div></div>` : '';

  const logo = logoSrc ? `<img src="${esc(logoSrc)}" alt="">` : '';
  const nav = `${L.nav === 'bar' && phone ? `<div class="topbar"><div class="wrap"><span>${esc(eyebrow || name)}</span><a href="tel:${esc(phone)}">Call ${esc(p['business.phone'])}</a></div></div>` : ''}
<nav class="nav"><div class="wrap"><a class="brand" href="#top">${logo}<span>${esc(name)}</span></a>
<div class="links">${services.length ? '<a href="#services">Services</a>' : ''}${p['business.about'] ? '<a href="#about">About</a>' : ''}${faq.length ? '<a href="#faq">FAQ</a>' : ''}<a href="#contact">Contact</a></div>
${primaryCta ? `<a class="btn solid small" href="${esc(primaryCta[0])}" rel="noopener">${primaryCta[1]}</a>` : ''}</div></nav>`;

  const head = (eb, title) => `<div class="sec-head"><div><div class="eyebrow">${eb}</div><h2>${title}</h2></div></div>`;
  const svcHtml = {
    numbered: `<ol class="svc">${services.map((s, i) => `<li><span>${pad(i)}</span>${esc(s)}</li>`).join('')}</ol>`,
    cards: `<div class="svc">${services.map((s, i) => `<div class="card"><b>${pad(i)}</b><h3>${esc(s)}</h3></div>`).join('')}</div>`,
    bordered: `<div class="svc">${services.map((s, i) => `<div><b>${pad(i)}</b><h3>${esc(s)}</h3></div>`).join('')}</div>`,
    rows: `<div class="svc">${services.map((s, i) => `<div><h3>${esc(s)}</h3><span>${pad(i)}</span></div>`).join('')}</div>`,
    twocol: `<ul class="svc">${services.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`,
    tags: `<div class="svc">${services.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`,
    tiles: `<div class="svc">${services.map((s, i) => `<div class="card"><b>${pad(i)}</b><h3>${esc(s)}</h3></div>`).join('')}</div>`,
    columns: `<div class="svc">${services.map((s, i) => `<div><b>${pad(i)}</b><h3>${esc(s)}</h3></div>`).join('')}</div>`,
  }[L.svc];
  const servicesSec = services.length ? `<section class="services" id="services"><div class="wrap">${head('What we do', 'Services')}${svcHtml}</div></section>` : '';

  const about = p['business.about'] ? esc(p['business.about']).replace(/\n/g, '<br>') : '';
  const aboutInner = {
    split: `<div><div class="eyebrow">About</div><h2>${since ? `Since ${since}` : 'Our story'}</h2></div><p>${about}</p>`,
    band: `<div><div class="eyebrow">About</div><h2>${since ? `Since ${since}` : 'Our story'}</h2></div><p>${about}</p>`,
    quote: `<blockquote>${about}</blockquote><cite>${esc(name)}${city ? ` · ${esc(city)}` : ''}</cite>`,
    rule: `<div><div class="eyebrow">About</div><h2>${since ? `Since ${since}` : 'Our story'}</h2><p>${about}</p></div>`,
    stats: `<div><div class="eyebrow">About</div><h2>${since ? `Since ${since}` : 'Our story'}</h2><p>${about}</p></div><div class="stats">${[
      since && [`${new Date().getFullYear() - Number(since)}+`, 'years in business'], [String(services.length || 1), services.length === 1 ? 'service' : 'services'],
      city && [esc(city), 'home base'], highlights[0] && ['✓', esc(highlights[0])]].filter(Boolean).slice(0, 4).map(([b, s]) => `<div class="card"><b>${b}</b><small>${s}</small></div>`).join('')}</div>`,
  }[L.about];
  const aboutSec = about ? `<section class="about" id="about"><div class="wrap">${aboutInner}</div></section>` : '';

  const faqSec = faq.length ? `<section class="faq" id="faq"><div class="wrap">${head('Good to know', 'Questions')}<div class="list">
${faq.map(([q, ...a]) => `<details${L.faq === 'cards' ? ' class="card"' : ''}><summary>${esc(q.trim())}</summary><p>${esc(a.join('|').trim())}</p></details>`).join('')}</div></div></section>` : '';

  const bandSec = !primaryCta ? '' : {
    solid: `<section class="band"><div class="wrap"><h2>Ready when you are.</h2><div class="cta-row">${ctas}</div></div></section>`,
    card: `<section class="band"><div class="wrap"><div class="card"><h2>Ready when you are.</h2><div class="cta-row">${ctas}</div></div></div></section>`,
    outline: `<section class="band"><div class="wrap"><div class="box"><h2>Ready when you are.</h2><div class="cta-row">${ctas}</div></div></div></section>`,
    split: `<section class="band"><div class="wrap"><div class="box"><h2>Ready when you are.</h2><div class="cta-row">${ctas}</div></div></div></section>`,
    minimal: `<section class="band"><div class="wrap"><h2>Ready when you are.</h2><a class="go" href="${esc(primaryCta[0])}" rel="noopener">${primaryCta[1]} →</a></div></section>`,
  }[L.band];

  const grid = `<div class="contact-grid">
${phone && L.contact !== 'bignum' ? `<div><h3>Call</h3><p><a href="tel:${esc(phone)}">${esc(p['business.phone'])}</a></p></div>` : ''}
${p['business.email'] ? `<div><h3>Email</h3><p><a href="mailto:${esc(p['business.email'])}">${esc(p['business.email'])}</a></p></div>` : ''}
<div><h3>${p['business.address'] ? 'Visit' : 'Service area'}</h3><p>${p['business.address'] ? `${esc(p['business.address'])}${city ? `<br>${esc(city)}, TX` : ''}` : city ? `${esc(city)} and nearby` : 'Central Texas'}</p></div>
${p['business.hours'] ? `<div><h3>Hours</h3><pre>${esc(p['business.hours'])}</pre></div>` : ''}
${review ? `<div><h3>Reviews</h3><p><a href="${esc(review)}" rel="noopener">Leave us a Google review →</a></p></div>` : ''}</div>`;
  const contactSec = `<section class="contact" id="contact"><div class="wrap">${head('Get in touch', 'Contact')}${L.contact === 'bignum' && phone ? `<a class="bignum" href="tel:${esc(phone)}">${esc(p['business.phone'])}</a>` : ''}${L.contact === 'card' ? `<div class="card">${grid}</div>` : grid}</div></section>`;
  const footer = `<footer><div class="wrap">${L.footer === 'big' ? `<div class="foot-big">${esc(name)}</div>` : ''}<span>© ${new Date().getFullYear()} ${esc(name)}</span><span>${social.map(([l, u]) => `<a href="${esc(u)}" rel="noopener">${l}</a>`).join('')}</span></div></footer>`;

  const g = pal.g1 ? `:root{--g1:${pal.g1};--g2:${pal.g2};--g3:${pal.g3}}` : ':root{--g1:color-mix(in srgb,var(--accent) 70%,var(--bg));--g2:color-mix(in srgb,var(--primary) 45%,var(--bg));--g3:color-mix(in srgb,var(--accent) 40%,var(--bg))}';
  const lum = (h) => { const c = h.match(/\w\w/g).map((x) => parseInt(x, 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const darkCover = lum(pal.bg) < 0.2 && lum(pal.primary) > 0.5 && coverHero && L.hero !== 'card'
    ? '.hero.no-media{color:var(--ink);background:radial-gradient(900px 500px at 80% 10%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 60%),linear-gradient(160deg,var(--surface),var(--bg))}.hero.no-media .btn.solid{background:var(--primary);color:var(--on-primary)}' : '';
  const css = BASE_CSS(pal, fonts) + g + tokenCss(t.tokens) + CSS.nav[L.nav] + CSS.hero[L.hero] + (CSS.deco[usedDeco] ?? '') + (marks.length ? CSS.hl[L.hl] : '')
    + CSS.svc[L.svc] + CSS.about[L.about] + CSS.faq[L.faq] + CSS.band[L.band] + CSS.contact[L.contact] + CSS.footer[L.footer] + darkCover + '.hero .cta-row{display:flex;gap:12px;flex-wrap:wrap}footer .wrap{align-items:center}';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)}${city ? ` · ${esc(city)}, TX` : ''}</title><meta name="description" content="${esc(p['business.tagline'] || name)}">
<meta name="theme-color" content="${pal.bg}"><style>${css}</style></head>
<body class="d-${esc(Object.keys(COMPOSED).find((k) => COMPOSED[k] === t) ?? '')}">${nav}${hero}${strip}${servicesSec}${aboutSec}${faqSec}${bandSec}${contactSec}${footer}</body></html>`;
}
