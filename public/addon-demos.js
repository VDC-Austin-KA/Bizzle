// Interactive previews of each upgrade, rendered INSIDE the client's own site preview so they can see how a tool
// would look and work for their business. Preview-only: never published, always labelled "Preview", and never
// shows invented reviews, ratings or statistics. Styled with the active template's CSS variables, so they match
// all 50 designs. No JavaScript (the floating chat opens with a CSS-only <details>).
import { esc, lines } from './site-core.js';

const DEMO_CSS = `
.demos{padding:clamp(56px,8vw,104px) 0;border-top:1px dashed var(--line)}
.demos .demo-head{display:flex;align-items:center;gap:12px;margin-bottom:28px;flex-wrap:wrap}
.demo-tag{display:inline-block;font:600 11px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;padding:6px 10px;border-radius:999px;border:1px dashed var(--accent);color:var(--accent)}
.demo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.demo{border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);position:relative}
.demo h3{font-family:var(--body);font-size:17px;font-weight:600;margin:0 0 4px;text-transform:none;letter-spacing:-.01em}.demo>p{margin:0 0 16px;font-size:14px;color:var(--muted)}
.cal{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center;font-size:12px}
.cal b{font-weight:600;color:var(--muted);padding-bottom:4px}.cal span{border:1px solid var(--line);border-radius:8px;padding:7px 0;background:var(--bg)}
.cal span.pick{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}.cal span.off{opacity:.35;text-decoration:line-through}
.phone{max-width:280px;margin:0 auto;border-radius:26px;border:8px solid #16171a;background:#f4f4f6;padding:14px 12px;font:13px/1.4 system-ui,sans-serif;color:#111}
.phone .who{text-align:center;font-size:11px;color:#777;margin-bottom:10px}
.msg{max-width:85%;padding:8px 12px;border-radius:16px;margin:6px 0}.msg.in{background:#e5e5ea}.msg.out{background:#0b84ff;color:#fff;margin-left:auto}
.msg.sys{max-width:100%;text-align:center;background:none;color:#888;font-size:11px}
.call{font-size:14px;display:grid;gap:8px}.call div{padding:10px 12px;border-radius:12px;background:var(--bg);border:1px solid var(--line)}
.call div.ai{border-left:3px solid var(--accent)}.call small{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
.formmock{display:grid;gap:8px}.formmock span{display:block;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:var(--bg);color:var(--muted);font-size:13px}
.demo .go{display:inline-block;margin-top:14px;padding:10px 18px;border-radius:999px;background:var(--primary);color:var(--on-primary);font-weight:600;font-size:14px;text-decoration:none}
.chatdock{position:fixed;right:22px;bottom:22px;z-index:20;font:14px/1.45 system-ui,sans-serif}
.chatdock summary{list-style:none;cursor:pointer;width:58px;height:58px;border-radius:50%;background:var(--primary);color:var(--on-primary);display:grid;place-items:center;font-size:24px;box-shadow:0 12px 30px -8px #0006;margin-left:auto}
.chatdock summary::-webkit-details-marker{display:none}
.chatdock .panel{position:absolute;right:0;bottom:72px;width:300px;background:#fff;color:#111;border-radius:18px;box-shadow:0 24px 60px -16px #0005;overflow:hidden}
.chatdock .panel header{background:var(--primary);color:var(--on-primary);padding:14px 16px;font-weight:600}.chatdock .panel .body{padding:12px 14px}
.chatdock .msg.mine{background:var(--primary);color:var(--on-primary)}.formmock b{float:right;color:var(--accent)}
.chatdock .tag{position:absolute;right:66px;bottom:16px;white-space:nowrap}`;

const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const firstName = (n) => esc(String(n || 'us').split(/\s+/).slice(0, 3).join(' '));

// ids: workflow ids to preview. included: ids the client already has (badge says "Included").
export function demoSection(p, ids, included = []) {
  const name = firstName(p['business.name']);
  const faq = lines(p['content.faq'] || p['wf.chat.faq']).map((l) => l.split('|')).filter((x) => x.length >= 2);
  const services = lines(p['business.services']);
  const badge = (id) => `<span class="demo-tag">${included.includes(id) ? 'Included · preview' : 'Upgrade · preview'}</span>`;
  const cards = {
    booking: `<div class="demo">${badge('booking')}<h3>Book online, 24/7</h3><p>Customers pick a time that works — it lands on your calendar.</p>
<div class="cal">${day.map((d) => `<b>${d}</b>`).join('')}${['8:00', '9:30', '11:00', '1:00', '3:30'].flatMap((t, r) => day.map((_, c) => `<span class="${(r + c) % 4 === 0 ? 'off' : r === 1 && c === 2 ? 'pick' : ''}">${t}</span>`)).join('')}</div>
<span class="go">Book ${esc((services[0] || 'a visit').toLowerCase())} →</span></div>`,
    textback: `<div class="demo">${badge('textback')}<h3>Never lose a missed call</h3><p>Every missed call gets an instant text from your business number.</p>
<div class="phone"><div class="who">${name}</div><div class="msg sys">Missed call · just now</div><div class="msg out">${esc(p['wf.textback.message'] || `Sorry we missed your call! How can we help? Reply here and we'll get right back to you.`)}</div><div class="msg in">Hi! Do you have anything open tomorrow?</div></div></div>`,
    receptionist: `<div class="demo">${badge('receptionist')}<h3>Every call answered</h3><p>After hours or when you're busy, calls are answered, jobs are booked and urgent calls reach you.</p>
<div class="call"><div class="ai"><small>Receptionist</small>${esc(p['wf.receptionist.greeting'] || `Thanks for calling ${p['business.name'] || 'us'}! How can I help today?`)}</div><div><small>Caller</small>I'd like to schedule ${esc((services[0] || 'a service').toLowerCase())}.</div><div class="ai"><small>Receptionist</small>Happy to help — I have Thursday at 9:30 or 1:00. Which works better?</div></div></div>`,
    reviews: `<div class="demo">${badge('reviews')}<h3>More 5-star reviews, automatically</h3><p>After a job, happy customers get a friendly, one-tap review request. You approve every reply.</p>
<div class="phone"><div class="who">${name}</div><div class="msg out">Thanks for choosing ${name}! If we did a great job, would you leave us a quick review? It really helps a local business. ⭐</div><div class="msg in">Of course — happy to!</div></div></div>`,
    followup: `<div class="demo">${badge('followup')}<h3>Quotes that don't go cold</h3><p>A personal-sounding follow-up goes out automatically when a quote goes quiet.</p>
<div class="call"><div class="ai"><small>Sent ${esc(p['wf.followup.delay'] || '4')} days after your quote</small>${esc(p['wf.followup.message'] || `Hi! Just checking in on the quote we sent — happy to answer any questions or find a time that works.`)}</div></div></div>`,
    ordering: `<div class="demo">${badge('ordering')}<h3>Order online</h3><p>Customers order ahead for ${esc(p['wf.ordering.pickup'] === 'delivery' ? 'delivery' : 'pickup')} — straight to your kitchen.</p>
<div class="formmock">${(services.length ? services : ['Popular item', 'House special']).slice(0, 3).map((s) => `<span>${esc(s)}<b>+ Add</b></span>`).join('')}</div><span class="go">Start an order →</span></div>`,
    intake: `<div class="demo">${badge('intake')}<h3>Paperwork, done before they arrive</h3><p>New customers fill out a secure form online; it lands in your system — no retyping.</p>
<div class="formmock">${(lines(p['wf.intake.fields']).length ? lines(p['wf.intake.fields']) : ['Full name', 'Phone number', 'What do you need help with?']).slice(0, 4).map((f) => `<span>${esc(f)}</span>`).join('')}</div></div>`,
  };
  const shown = ids.filter((id) => cards[id]);
  const chat = ids.includes('chat') ? `<details class="chatdock" open><summary aria-label="Chat">💬</summary><div class="panel"><header>${name}</header><div class="body">
<div class="msg out mine">Hi! 👋 How can we help today?</div>
${faq[0] ? `<div class="msg in">${esc(faq[0][0].trim())}</div><div class="msg out mine">${esc(faq[0].slice(1).join('|').trim())}</div>` : '<div class="msg in">Do you offer free estimates?</div>'}
</div></div><span class="demo-tag tag">${included.includes('chat') ? 'Included' : 'Upgrade'} · preview</span></details>` : '';
  if (!shown.length && !chat) return { html: '', css: '' };
  return {
    css: DEMO_CSS,
    html: `${shown.length ? `<section class="demos"><div class="wrap"><div class="demo-head"><span class="demo-tag">Preview only</span><h2>See your tools in action</h2></div><div class="demo-grid">${shown.map((id) => cards[id]).join('')}</div></div></section>` : ''}${chat}`,
  };
}
