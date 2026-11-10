// Shared building blocks for every client website template (escaping, fonts, base CSS).
// Imported by site-template.js (the original four templates) and site-compose.js (the composable templates).

export const FONT_FACES = {
  inter: "@font-face{font-family:'Inter';src:url(/fonts/inter.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  cormorant: "@font-face{font-family:'Cormorant Garamond';src:url(/fonts/cormorant.woff2) format('woff2');font-weight:400 700;font-display:swap}@font-face{font-family:'Cormorant Garamond';font-style:italic;src:url(/fonts/cormorant-italic.woff2) format('woff2');font-weight:400 700;font-display:swap}",
  fraunces: "@font-face{font-family:'Fraunces';src:url(/fonts/fraunces.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  manrope: "@font-face{font-family:'Manrope';src:url(/fonts/manrope.woff2) format('woff2');font-weight:300 800;font-display:swap}",
  playfair: "@font-face{font-family:'Playfair Display';src:url(/fonts/playfair.woff2) format('woff2');font-weight:400 800;font-display:swap}",
  dmserif: "@font-face{font-family:'DM Serif Display';src:url(/fonts/dmserif.woff2) format('woff2');font-weight:400;font-display:swap}",
  spacegrotesk: "@font-face{font-family:'Space Grotesk';src:url(/fonts/spacegrotesk.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  instrument: "@font-face{font-family:'Instrument Serif';src:url(/fonts/instrument.woff2) format('woff2');font-weight:400;font-display:swap}@font-face{font-family:'Instrument Serif';font-style:italic;src:url(/fonts/instrument-italic.woff2) format('woff2');font-weight:400;font-display:swap}",
  outfit: "@font-face{font-family:'Outfit';src:url(/fonts/outfit.woff2) format('woff2');font-weight:300 700;font-display:swap}",
  syne: "@font-face{font-family:'Syne';src:url(/fonts/syne.woff2) format('woff2');font-weight:400 800;font-display:swap}",
};
export const STACK = { inter: "'Inter',system-ui,sans-serif", cormorant: "'Cormorant Garamond',Georgia,serif", fraunces: "'Fraunces',Georgia,serif", manrope: "'Manrope','Inter',system-ui,sans-serif",
  playfair: "'Playfair Display',Georgia,serif", dmserif: "'DM Serif Display',Georgia,serif", spacegrotesk: "'Space Grotesk','Inter',system-ui,sans-serif",
  instrument: "'Instrument Serif',Georgia,serif", outfit: "'Outfit','Inter',system-ui,sans-serif", syne: "'Syne','Inter',system-ui,sans-serif" };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
export const digits = (p) => String(p ?? '').replace(/[^0-9+]/g, '');
export const lines = (t) => String(t ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
export const pad = (n) => String(n + 1).padStart(2, '0');

export const BASE_CSS = (pal, f) => `
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

