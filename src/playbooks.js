// Industry playbooks. `naics` = inclusive NAICS ranges used to pull real businesses from the
// Texas Comptroller sales-tax permit registry. `fit` is Bizzle's editorial weighting of how much
// repetitive front-office work the industry has (the only non-data input to the score).
// Each use case names the observed `gap` that triggers it, so recommendations are evidence-based.
const uc = (name, gap, why) => ({ name, gap, why });
const BOOKING = (name = 'Online booking with AI phone overflow') => uc(name, 'booking', 'No online booking/scheduling tool detected on their website');
const CHAT = (name = 'AI chat / text-back on website') => uc(name, 'chat', 'No chat or text-messaging widget detected on their website');
const REVIEWS = uc('AI review-request & response automation', 'reviews', 'No review-generation tool detected; lift rating & volume');
const WEBSITE = uc('AI-built website with booking & chat', 'website', 'No website listed on Google');

export const PLAYBOOKS = {
  hvac_plumbing: { label: 'HVAC, Plumbing & Electrical', fit: 0.95, naics: [[238210, 238229]],
    pains: ['Missed after-hours emergency calls', 'Dispatch juggling in summer peaks', 'Slow quote follow-up'],
    useCases: [CHAT('AI receptionist + emergency triage'), BOOKING('Online booking synced to dispatch'), REVIEWS, WEBSITE],
    objections: ['"Customers want a real person" → AI answers instantly and hands hot leads to a tech live.'] },
  roofing_construction: { label: 'Roofing, Foundation & Remodeling', fit: 0.8, naics: [[236118, 236118], [238100, 238199]],
    pains: ['Storm-surge lead floods', 'Estimate paperwork', 'Sub-contractor coordination'],
    useCases: [CHAT('Lead intake & qualification bot'), BOOKING('Inspection scheduler'), REVIEWS, WEBSITE],
    objections: ['"Every job is custom" → AI drafts the estimate, your estimator approves.'] },
  auto_repair: { label: 'Auto Repair', fit: 0.8, naics: [[811100, 811199]],
    pains: ['Status-update phone calls', 'Phone-only booking', 'Explaining estimates'],
    useCases: [BOOKING('Online booking + AI phone desk'), CHAT('Automated repair-status texting'), REVIEWS, WEBSITE],
    objections: ['"Customers distrust shops" → transparent automated updates build trust.'] },
  restaurant: { label: 'Restaurants & Bars', fit: 0.65, naics: [[722300, 722599]],
    pains: ['Phone orders during rush', 'Review management', 'Staff scheduling'],
    useCases: [uc('AI phone ordering & online ordering', 'ordering', 'No online ordering platform detected on their website'),
      BOOKING('AI reservations line'), REVIEWS, WEBSITE],
    objections: ['"Margins are thin" → start with phone orders; missed-call recovery pays first.'] },
  salon_spa: { label: 'Salon & Spa', fit: 0.75, naics: [[812100, 812199]],
    pains: ['Booking calls mid-service', 'No-shows', 'Rebooking'],
    useCases: [BOOKING(), CHAT('Text-back for missed calls'), REVIEWS, WEBSITE],
    objections: ['"Clients love the personal touch" → AI frees stylists to give more of it.'] },
  fitness: { label: 'Fitness', fit: 0.7, naics: [[713940, 713940]],
    pains: ['Lead follow-up', 'Membership churn', 'Class scheduling'],
    useCases: [CHAT('Lead nurture & trial-booking bot'), BOOKING('Class booking & waitlist'), REVIEWS, WEBSITE],
    objections: ['"We already have an app" → AI layers on top of your existing system.'] },
  field_services: { label: 'Pest, Lawn & Cleaning Services', fit: 0.85, naics: [[561700, 561799]],
    pains: ['Quote requests by phone', 'Route scheduling', 'Recurring-service renewals'],
    useCases: [CHAT('Instant quote bot'), BOOKING('Online scheduling'), REVIEWS, WEBSITE],
    objections: ['"Our crews are in the field" → AI covers the phone so crews keep working.'] },
  veterinary: { label: 'Veterinary', fit: 0.85, naics: [[541940, 541940]],
    pains: ['Appointment phone volume', 'Vaccine reminders', 'Post-visit follow-up'],
    useCases: [BOOKING(), CHAT('AI phone/text overflow'), REVIEWS, WEBSITE],
    objections: ['"Pet owners are emotional" → urgent and sensitive calls route to staff immediately.'] },
  dental: { label: 'Dental', fit: 0.9, naics: [[621210, 621210]],
    pains: ['No-shows', 'Front-desk phone overload', 'Insurance verification'],
    useCases: [BOOKING('Online booking + no-show recovery'), CHAT('AI front-desk phone/text agent'), REVIEWS, WEBSITE],
    objections: ['"HIPAA" → BAA-covered vendors only; no PHI without one.'] },
  medical_clinic: { label: 'Medical Clinic', fit: 0.85, naics: [[621100, 621199]],
    pains: ['Intake paperwork', 'Phone queues', 'Prior-auth admin'],
    useCases: [BOOKING('Digital intake & online scheduling'), CHAT('AI scheduling line'), REVIEWS, WEBSITE],
    objections: ['"Compliance" → BAA-covered stack, clinician reviews clinical content.'] },
  legal: { label: 'Legal', fit: 0.85, naics: [[541100, 541199]],
    pains: ['Unqualified intake calls', 'Document drafting time', 'After-hours lead loss'],
    useCases: [CHAT('24/7 intake & conflict pre-screen'), BOOKING('Consultation scheduler'), REVIEWS, WEBSITE],
    objections: ['"Confidentiality" → private deployment; attorney reviews every output.'] },
  accounting: { label: 'Accounting & Bookkeeping', fit: 0.85, naics: [[541200, 541299]],
    pains: ['Tax-season document chasing', 'Receipt categorization', 'Repetitive client Q&A'],
    useCases: [CHAT('Client FAQ & document-request assistant'), BOOKING('Consultation scheduler'), REVIEWS, WEBSITE],
    objections: ['"Accuracy" → AI pre-sorts, the CPA signs off.'] },
  real_estate: { label: 'Real Estate Agents & Brokers', fit: 0.75, naics: [[531210, 531210]],
    pains: ['Speed-to-lead', 'Listing copy', 'Showing coordination'],
    useCases: [CHAT('Instant lead response & qualification'), BOOKING('Showing scheduler'), REVIEWS, WEBSITE],
    objections: ['"My brand is personal" → AI trained on your voice; you approve outbound.'] },
  property_management: { label: 'Property Management', fit: 0.9, naics: [[531311, 531312]],
    pains: ['Maintenance request triage', 'Tenant inquiries', 'Leasing follow-up'],
    useCases: [CHAT('Maintenance & tenant-inquiry triage bot'), BOOKING('Leasing tour booking'), REVIEWS, WEBSITE],
    objections: ['"Tenants will hate it" → faster responses reduce complaints.'] },
  insurance: { label: 'Insurance Agency', fit: 0.85, naics: [[524200, 524299]],
    pains: ['Quote intake', 'Renewal reminders', 'Policy Q&A'],
    useCases: [CHAT('Quote intake & policy FAQ assistant'), BOOKING('Review-call scheduler'), REVIEWS, WEBSITE],
    objections: ['"Regulated industry" → the licensed agent stays the decision-maker.'] },
};

export const DEFAULT_PLAYBOOK = { label: 'Other local business', fit: 0.6, naics: [],
  pains: ['Repetitive phone/email inquiries', 'Manual scheduling', 'Inconsistent follow-up'],
  useCases: [CHAT(), BOOKING('Online scheduling'), REVIEWS, WEBSITE], objections: [] };

export const playbookFor = (industry) => PLAYBOOKS[industry] ?? DEFAULT_PLAYBOOK;

export function industryForNaics(code) {
  const n = Number(code);
  return Object.entries(PLAYBOOKS).find(([, p]) => p.naics.some(([lo, hi]) => n >= lo && n <= hi))?.[0] ?? null;
}
