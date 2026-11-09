// Enrichment pipeline: each step pulls one real data source and records when it was checked.
import { updateLead, rowToLead } from './db.js';
import { placesEnabled, matchPlace } from './sources/places.js';
import { scanWebsite } from './sources/website.js';
import { fetchMixedBevRevenue, fetchOutletStats } from './sources/comptroller.js';

// True when at least one enrichment step hasn't run yet for this lead.
export const needsEnrichment = (l) => (placesEnabled() && !l.places_checked_at) || (l.website && !l.web_checked_at) ||
  (l.taxpayer_number && l.outlets_total == null) || (l.industry === 'restaurant' && l.taxpayer_number && !l.mb_checked_at);

export async function enrichLead(db, id, { fetchImpl } = {}) {
  const get = async () => rowToLead(await db.get('SELECT * FROM leads WHERE id = ?', id));
  let lead = await get();
  const log = [];
  const now = () => new Date().toISOString();
  const step = async (label, fn) => {
    try { log.push(`${label}: ${await fn()}`); } catch (e) { log.push(`${label}: failed (${e.message})`); }
    lead = await get();
  };

  if (placesEnabled() && !lead.places_id) await step('Google', async () => {
    const p = await matchPlace(lead, fetchImpl);
    if (!p) { await updateLead(db, id, { places_checked_at: now() }); return 'no confident match'; }
    await updateLead(db, id, { ...p, website: lead.website ?? p.website, phone: lead.phone ?? p.phone });
    return `matched (${p.rating ?? '–'}★, ${p.review_count} reviews)`;
  });

  if (lead.website) await step('Website', async () => {
    const s = await scanWebsite(lead.website, fetchImpl);
    await updateLead(db, id, { web_signals: s, web_checked_at: now() });
    return s.reachable ? 'scanned' : `unreachable (${s.error})`;
  });

  if (lead.taxpayer_number && (lead.outlets_total == null || lead.entity_formed_date == null)) await step('State registry', async () => {
    const st = (await fetchOutletStats([lead.taxpayer_number], fetchImpl))[lead.taxpayer_number];
    if (st) await updateLead(db, id, st);
    return st ? `${st.outlets_total} active location(s)${st.entity_formed_date ? `, entity formed ${st.entity_formed_date}` : ''}` : 'none found';
  });

  if (lead.industry === 'restaurant' && lead.taxpayer_number) await step('Alcohol sales (TX Comptroller)', async () => {
    const r = await fetchMixedBevRevenue(lead, fetchImpl);
    const active = r?.found && r.revenue12 > 0; // a permit with $0 reported for a year isn't a revenue signal
    await updateLead(db, id, { mb_checked_at: now(), ...(active ? { mb_revenue_12mo: r.revenue12, mb_revenue_prev_12mo: r.revenuePrev12, mb_latest_month: r.latestMonth } : {}) });
    return active ? `$${r.revenue12.toLocaleString()} alcohol sales, trailing 12 mo` : r?.found ? 'permit found, no sales reported in last 12 mo' : 'no mixed-beverage permit at this address';
  });

  return { lead, log };
}
