// Renders a client's one-page website from their profile. Used for the live preview in the client portal
// AND for the published site, so what they approve is exactly what goes live. No JavaScript in the output;
// every client-provided value is HTML-escaped; colors are validated hex; links are http(s)/tel/sms only.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? c : d);
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const digits = (p) => String(p ?? '').replace(/[^0-9+]/g, '');
const lines = (t) => String(t ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

const FONTS = {
  modern: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  friendly: "'Trebuchet MS', 'Verdana', sans-serif",
};

export function renderSite(p, { logoSrc = null, workflows = [] } = {}) {
  const primary = hex(p['brand.primary'], '#1f4e79'), accent = hex(p['brand.accent'], '#e07a1f');
  const theme = p['brand.theme'] ?? 'clean';
  const font = FONTS[p['brand.font']] ?? FONTS.modern;
  const name = esc(p['business.name'] || 'Your business');
  const phone = digits(p['business.phone']);
  const booking = safeUrl(p['links.booking']), review = safeUrl(p['links.review']), ordering = safeUrl(p['links.ordering']);
  const social = [['Facebook', safeUrl(p['links.facebook'])], ['Instagram', safeUrl(p['links.instagram'])]].filter(([, u]) => u);
  const faq = lines(p['wf.chat.faq']).map((l) => l.split('|')).filter((x) => x.length >= 2).slice(0, 12);
  const headerBg = theme === 'bold' ? primary : '#ffffff', headerFg = theme === 'bold' ? '#ffffff' : primary;
  const bodyBg = theme === 'warm' ? '#fbf6ee' : '#ffffff';
  const btn = (href, label, solid = true) => `<a class="btn${solid ? '' : ' ghost'}" href="${esc(href)}" rel="noopener">${esc(label)}</a>`;
  const ctas = [booking && btn(booking, 'Book online'), ordering && btn(ordering, 'Order online'), phone && btn(`tel:${phone}`, `Call ${p['business.phone']}`, !booking),
    phone && workflows.includes('textback') && btn(`sms:${phone}`, 'Text us', false)].filter(Boolean).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${p['business.city'] ? ` · ${esc(p['business.city'])}, TX` : ''}</title>
<meta name="description" content="${esc(p['business.tagline'] || name)}">
<style>
*{box-sizing:border-box}body{margin:0;font-family:${font};color:#222;background:${bodyBg};line-height:1.55}
header{display:flex;align-items:center;gap:14px;padding:14px 6vw;background:${headerBg};color:${headerFg};border-bottom:1px solid #0001}
header img{height:48px;max-width:180px;object-fit:contain}header strong{font-size:22px}
.hero{padding:56px 6vw;background:linear-gradient(135deg,${primary},${primary}cc);color:#fff}
.hero h1{margin:0 0 8px;font-size:clamp(28px,5vw,44px)}.hero p{margin:0 0 22px;font-size:19px;opacity:.95;max-width:700px}
.btn{display:inline-block;margin:0 10px 10px 0;padding:12px 20px;border-radius:8px;background:${accent};color:#fff;text-decoration:none;font-weight:600}
.btn.ghost{background:transparent;border:2px solid #fff}
main{padding:24px 6vw 48px;max-width:1100px}section{margin:32px 0}h2{color:${primary};margin:0 0 12px}
.services{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:0;list-style:none}
.services li{background:#fff;border:1px solid #0001;border-left:4px solid ${accent};padding:14px;border-radius:8px}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.info pre{font:inherit;white-space:pre-wrap;margin:0}
dt{font-weight:600;margin-top:12px}dd{margin:4px 0 0}footer{padding:24px 6vw;background:#0000000a;font-size:14px}footer a{color:${primary}}
</style></head><body>
<header>${logoSrc ? `<img src="${esc(logoSrc)}" alt="${name} logo">` : ''}<strong>${name}</strong></header>
<div class="hero"><h1>${name}</h1>${p['business.tagline'] ? `<p>${esc(p['business.tagline'])}</p>` : ''}${ctas}</div>
<main>
${lines(p['business.services']).length ? `<section><h2>Services</h2><ul class="services">${lines(p['business.services']).map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
${p['business.about'] ? `<section><h2>About us</h2><p>${esc(p['business.about']).replace(/\n/g, '<br>')}</p></section>` : ''}
${faq.length ? `<section><h2>Questions we hear a lot</h2><dl>${faq.map(([q, ...a]) => `<dt>${esc(q.trim())}</dt><dd>${esc(a.join('|').trim())}</dd>`).join('')}</dl></section>` : ''}
<section class="info">
<div><h2>Contact</h2>${phone ? `<p><a href="tel:${phone}">${esc(p['business.phone'])}</a></p>` : ''}${p['business.email'] ? `<p><a href="mailto:${esc(p['business.email'])}">${esc(p['business.email'])}</a></p>` : ''}${p['business.address'] ? `<p>${esc(p['business.address'])}${p['business.city'] ? `, ${esc(p['business.city'])}` : ''}</p>` : p['business.city'] ? `<p>Serving ${esc(p['business.city'])} and nearby</p>` : ''}</div>
${p['business.hours'] ? `<div><h2>Hours</h2><pre>${esc(p['business.hours'])}</pre></div>` : ''}
${review ? `<div><h2>Reviews</h2><p>Happy with our work? <a href="${esc(review)}" rel="noopener">Leave us a Google review</a>.</p></div>` : ''}
</section></main>
<footer>© ${new Date().getFullYear()} ${name}${social.length ? ' · ' + social.map(([l, u]) => `<a href="${esc(u)}" rel="noopener">${l}</a>`).join(' · ') : ''}</footer>
</body></html>`;
}
