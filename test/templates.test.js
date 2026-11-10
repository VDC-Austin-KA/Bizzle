import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, renderSite, resolveDesign } from '../public/site-template.js';
import { validateProfile } from '../public/workflows.js';

// WCAG 2.x relative luminance / contrast ratio.
const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('every curated palette is readable (WCAG AA)', () => {
  for (const [tid, t] of Object.entries(TEMPLATES)) for (const [pid, p] of Object.entries(t.palettes)) {
    const id = `${tid}/${pid}`;
    assert.ok(contrast(p.ink, p.bg) >= 7, `${id}: body text vs background ${contrast(p.ink, p.bg).toFixed(2)}`);
    assert.ok(contrast(p.muted, p.bg) >= 4.5, `${id}: secondary text ${contrast(p.muted, p.bg).toFixed(2)}`);
    assert.ok(contrast(p.ink, p.surface) >= 4.5, `${id}: text on cards`);
    assert.ok(contrast(p.muted, p.surface) >= 4.5, `${id}: secondary text on cards ${contrast(p.muted, p.surface).toFixed(2)}`);
    assert.ok(contrast(p.onPrimary, p.primary) >= 4.5, `${id}: button text ${contrast(p.onPrimary, p.primary).toFixed(2)}`);
    assert.ok(contrast(p.accent, p.bg) >= 3, `${id}: accent details ${contrast(p.accent, p.bg).toFixed(2)}`);
  }
});

test('every template × palette × typography renders safely', () => {
  const evil = { 'business.name': '<script>x</script>', 'business.tagline': '"><img src=x onerror=alert(1)> done', 'business.services': 'A\n<b>B</b>', 'business.about': 'Hi\n<i>there</i>',
    'content.faq': 'Q<1>? | A & B', 'business.highlights': 'Licensed', 'business.phone': '512', 'business.city': 'Kyle', 'links.booking': 'javascript:alert(1)' };
  for (const [tid, t] of Object.entries(TEMPLATES)) for (const pid of Object.keys(t.palettes)) for (const fid of Object.keys(t.fonts)) {
    const html = renderSite({ ...evil, 'brand.template': tid, 'brand.palette': pid, 'brand.fonts': fid }, { heroSrc: '/s/x/hero', logoSrc: '/s/x/logo', workflows: ['textback'] });
    assert.ok(!/<script/i.test(html), `${tid}/${pid}/${fid} has a script tag`);
    assert.ok(!/<img src=x/i.test(html) && !/<b>B/.test(html) && !html.includes('javascript:'));
    assert.ok(html.includes(t.palettes[pid].bg) && html.includes(`/fonts/${t.fonts[fid].display}.woff2`));
  }
});

test('unknown or mismatched design choices fall back to a valid combination', () => {
  assert.equal(resolveDesign({ 'brand.template': 'nope' }).tid, 'atelier');
  const d = resolveDesign({ 'brand.template': 'midnight', 'brand.palette': 'ivory', 'brand.fonts': 'classic' }); // palette/fonts from another template
  assert.equal(d.pid, 'amber'); assert.equal(d.fid, 'geometric');
});

test('design fields only accept curated values', () => {
  const { errors } = validateProfile({ 'business.name': 'X', 'brand.template': 'hacker', 'brand.palette': '#ff0000' }, []);
  assert.equal(errors.length, 2);
  assert.equal(validateProfile({ 'business.since': '1850' }, []).errors.length, 1);
  assert.equal(validateProfile({ 'business.since': '2011' }, []).errors.length, 0);
});

test('50 designs, each with a unique layout recipe and name', async () => {
  const { COMPOSED } = await import('../public/site-compose.js');
  assert.equal(Object.keys(TEMPLATES).length, 50);
  const sigs = Object.values(COMPOSED).map((t) => JSON.stringify([t.layout, t.tokens]));
  assert.equal(new Set(sigs).size, sigs.length, 'two designs share the same recipe');
  const names = Object.values(TEMPLATES).map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of Object.values(TEMPLATES)) assert.equal(Object.keys(t.palettes).length, 4, `${t.name} needs 4 palettes`);
});
