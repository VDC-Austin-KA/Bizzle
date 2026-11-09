// Texas Comptroller open data (data.texas.gov, Socrata). Free, no key; set SOCRATA_APP_TOKEN to raise rate limits.
//  - jrea-zgmq: Active Sales Tax Permit Holders → real registered outlets with NAICS, first-sale date, HQ address
//  - g5bj-yb6k: Mixed Beverage Sales Receipts → real monthly alcohol sales per licensed location
import { PLAYBOOKS, industryForNaics } from '../playbooks.js';

const BASE = 'https://data.texas.gov/resource';
// Comptroller county codes (verified against outlet_city in jrea-zgmq). Central Texas service area.
export const COUNTIES = {
  '227': 'Travis', '246': 'Williamson', '105': 'Hays', '011': 'Bastrop', '028': 'Caldwell', '014': 'Bell',
  '161': 'McLennan', '027': 'Burnet', '046': 'Comal', '094': 'Guadalupe', '016': 'Blanco', '144': 'Lee',
  '166': 'Milam', '050': 'Coryell', '150': 'Llano',
};
export const CORE_COUNTIES = ['227', '246', '105'];
const ORG_TYPES = { CL: 'Texas LLC', CT: 'Texas corporation', CI: 'Out-of-state LLC', CF: 'Out-of-state corporation',
  IS: 'Sole proprietor', PL: 'Limited partnership', PI: 'Partnership', PG: 'General partnership' };

const KEEP_UPPER = new Set(['LLC', 'INC', 'PLLC', 'LLP', 'LP', 'PC', 'DDS', 'DMD', 'MD', 'HVAC', 'BBQ', 'II', 'III', 'USA', 'TX', 'ATX', 'AC', 'CPA']);
export const titleCase = (s) => String(s ?? '').toLowerCase().replace(/[a-z0-9'’]+/g, (w) =>
  KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));

// "661 Louis Henna Blvd Unit 300" → "661 LOUIS" — enough to match the same storefront across sources.
export function addressKey(addr) {
  const t = String(addr ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const i = t.findIndex((x) => /^\d+[A-Z]?$/.test(x));
  if (i < 0 || !t[i + 1] || t[i - 1] === 'BOX') return null;
  const street = ['N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST'].includes(t[i + 1]) && t[i + 2] ? t[i + 2] : t[i + 1];
  return `${t[i]} ${street}`;
}

async function soql(dataset, params, fetchImpl = fetch) {
  const url = new URL(`${BASE}/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = process.env.SOCRATA_APP_TOKEN ? { 'X-App-Token': process.env.SOCRATA_APP_TOKEN } : {};
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Comptroller data ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const isoDate = (d) => d.toISOString().slice(0, 10);
const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d; };

// Pull active outlets for the given counties + industry. All inputs are whitelisted before reaching SoQL.
export async function fetchOutlets({ counties, industry, openedWithinYears, sort = 'newest', includeSoleProprietors = false, limit = 200 }, fetchImpl) {
  const codes = (counties?.length ? counties : CORE_COUNTIES).filter((c) => COUNTIES[c]);
  const pb = PLAYBOOKS[industry];
  if (!codes.length || !pb) throw new Error('Unknown county or industry');
  const where = [`outlet_county_code in(${codes.map((c) => `'${c}'`).join(',')})`,
    `(${pb.naics.map(([lo, hi]) => `outlet_naics_code between ${lo} and ${hi}`).join(' OR ')})`];
  const yrs = Number(openedWithinYears);
  if (yrs > 0) where.push(`outlet_first_sales_date >= '${isoDate(yearsAgo(yrs))}'`);
  if (!includeSoleProprietors) where.push(`taxpayer_organization_type != 'IS'`); // IS = individual sole proprietor
  const rows = await soql('jrea-zgmq', {
    $where: where.join(' AND '), $order: `outlet_first_sales_date ${sort === 'established' ? 'ASC' : 'DESC'}`,
    $limit: String(Math.min(Math.max(1, Number(limit) || 200), 1000)),
  }, fetchImpl);
  return rows.map(outletToLead);
}

export function outletToLead(r) {
  return {
    external_id: `txst:${r.taxpayer_number}:${r.outlet_number}`,
    name: titleCase(r.outlet_name || r.taxpayer_name),
    legal_name: r.taxpayer_name,
    org_type: ORG_TYPES[r.taxpayer_organization_type] ?? r.taxpayer_organization_type,
    industry: industryForNaics(r.outlet_naics_code),
    naics: r.outlet_naics_code,
    address: titleCase(r.outlet_address), city: titleCase(r.outlet_city), zip: r.outlet_zip_code?.slice(0, 5),
    county: COUNTIES[r.outlet_county_code] ?? null,
    taxpayer_number: r.taxpayer_number, outlet_number: r.outlet_number,
    hq_city: titleCase(r.taxpayer_city), hq_state: r.taxpayer_state,
    hq_local: r.taxpayer_state === 'TX' && !!COUNTIES[r.taxpayer_county_code],
    first_sale_date: r.outlet_first_sales_date?.slice(0, 10) ?? null,
    source: 'tx_comptroller',
  };
}

// Statewide active-outlet totals per taxpayer, and how many opened in the last 12 months.
export async function fetchOutletStats(taxpayers, fetchImpl) {
  const ids = [...new Set(taxpayers)].filter((t) => /^\d{11}$/.test(t));
  const stats = {};
  for (let i = 0; i < ids.length; i += 100) {
    const inList = ids.slice(i, i + 100).map((t) => `'${t}'`).join(',');
    const q = (extra) => soql('jrea-zgmq', { $select: 'taxpayer_number, count(*) as n', $where: `taxpayer_number in(${inList})${extra}`, $group: 'taxpayer_number', $limit: '1000' }, fetchImpl);
    // 9cir-efmm = Active Franchise Tax Permit Holders: the entity's Texas charter date (true business age;
    // a location's sales-tax first-sale date only says when *that permit* started).
    const charter = soql('9cir-efmm', { $select: 'taxpayer_number, sos_charter_date, responsibility_beginning_date', $where: `taxpayer_number in(${inList})`, $limit: '1000' }, fetchImpl);
    const [all, recent, formed] = await Promise.all([q(''), q(` AND outlet_first_sales_date >= '${isoDate(yearsAgo(1))}'`), charter]);
    for (const r of all) stats[r.taxpayer_number] = { outlets_total: Number(r.n), outlets_opened_12mo: 0 };
    for (const r of recent) if (stats[r.taxpayer_number]) stats[r.taxpayer_number].outlets_opened_12mo = Number(r.n);
    for (const r of formed) {
      const d = (r.sos_charter_date ?? r.responsibility_beginning_date)?.slice(0, 10);
      if (stats[r.taxpayer_number] && d) stats[r.taxpayer_number].entity_formed_date = d;
    }
  }
  return stats;
}

// Trailing-12-month mixed-beverage receipts for the location matching `address`, plus the prior 12 months.
export async function fetchMixedBevRevenue({ taxpayer_number, address }, fetchImpl) {
  if (!/^\d{11}$/.test(taxpayer_number ?? '')) return null;
  const rows = await soql('g5bj-yb6k', {
    $select: 'location_number, location_address, obligation_end_date, total_sales_receipts',
    $where: `taxpayer_number='${taxpayer_number}'`, $order: 'obligation_end_date DESC', $limit: '5000',
  }, fetchImpl);
  if (!rows.length) return { found: false };
  const byLoc = Object.groupBy(rows, (r) => r.location_number);
  const key = addressKey(address);
  const locs = Object.values(byLoc);
  const match = locs.find((l) => key && addressKey(l[0].location_address) === key) ?? (locs.length === 1 ? locs[0] : null);
  if (!match) return { found: false };
  const latest = new Date(match[0].obligation_end_date);
  const monthsBack = (r) => (latest.getFullYear() - new Date(r.obligation_end_date).getFullYear()) * 12 + latest.getMonth() - new Date(r.obligation_end_date).getMonth();
  const sum = (lo, hi) => match.filter((r) => { const m = monthsBack(r); return m >= lo && m <= hi; })
    .reduce((t, r) => t + Number(r.total_sales_receipts || 0), 0);
  const months = new Set(match.filter((r) => Number(r.total_sales_receipts) > 0).map(monthsBack)); // $0 months = not yet operating
  const hasPrev = [...Array(12)].every((_, i) => months.has(12 + i));
  return {
    found: true, latestMonth: match[0].obligation_end_date.slice(0, 7),
    revenue12: Math.round(sum(0, 11)), revenuePrev12: hasPrev ? Math.round(sum(12, 23)) : null,
  };
}
