// Industry playbooks: how well AI fits, which use cases to lead with, and what pushback to expect.
// `gap` links a use case to a digital gap on the lead so gaps get prioritized in the pitch.
// Prices/hours are planning defaults — tune them as real deals close.
const uc = (name, hoursPerWeek, setup, monthly, gap = null) => ({ name, hoursPerWeek, setup, monthly, gap });

export const PLAYBOOKS = {
  hvac_plumbing: {
    label: 'HVAC & Plumbing', fit: 0.95,
    pains: ['Missed after-hours emergency calls', 'Dispatch juggling in summer peaks', 'Slow quote follow-up'],
    useCases: [uc('AI phone receptionist + emergency triage', 12, 1500, 400, 'chat'), uc('Online booking synced to dispatch', 6, 1200, 150, 'booking'), uc('Automated quote follow-up & review requests', 5, 800, 150, 'reviews')],
    objections: ['"Customers want a real person" → AI answers instantly and hands off hot leads live.'],
  },
  roofing_construction: {
    label: 'Roofing & Construction', fit: 0.8,
    pains: ['Storm-surge lead floods', 'Estimate paperwork', 'Sub-contractor coordination'],
    useCases: [uc('Lead intake & qualification bot', 8, 1200, 300, 'chat'), uc('AI estimate & proposal drafting', 10, 2000, 250), uc('Review response automation', 3, 600, 100, 'reviews')],
    objections: ['"Every job is custom" → AI drafts, your estimator approves.'],
  },
  dental: {
    label: 'Dental', fit: 0.9,
    pains: ['No-shows', 'Front-desk phone overload', 'Insurance verification'],
    useCases: [uc('Smart reminders & no-show recovery', 8, 1000, 250, 'booking'), uc('AI front-desk phone agent', 12, 1500, 400, 'chat'), uc('Insurance pre-verification assistant', 6, 1800, 300)],
    objections: ['"HIPAA" → BAA-covered vendors only; no PHI in prompts without one.'],
  },
  medical_clinic: {
    label: 'Medical Clinic', fit: 0.85,
    pains: ['Intake paperwork', 'Phone queues', 'Prior-auth admin'],
    useCases: [uc('Digital intake & triage forms', 10, 1500, 300, 'booking'), uc('AI scheduling line', 12, 1500, 400, 'chat'), uc('Visit-note summarization (clinician reviewed)', 8, 2500, 500)],
    objections: ['"Compliance" → BAA-covered stack, human-in-the-loop on clinical content.'],
  },
  veterinary: {
    label: 'Veterinary', fit: 0.85,
    pains: ['Appointment phone volume', 'Vaccine reminder tracking', 'Post-visit follow-up'],
    useCases: [uc('Online booking + AI phone overflow', 10, 1200, 300, 'booking'), uc('Automated wellness reminders', 5, 800, 150), uc('Review & follow-up automation', 3, 600, 100, 'reviews')],
    objections: ['"Pet owners are emotional" → AI routes urgent/sensitive calls to staff immediately.'],
  },
  legal: {
    label: 'Legal', fit: 0.85,
    pains: ['Unqualified intake calls', 'Document drafting time', 'After-hours lead loss'],
    useCases: [uc('24/7 intake & conflict pre-screen', 10, 1500, 400, 'chat'), uc('First-draft document assembly', 12, 2500, 400), uc('Client status updates bot', 4, 800, 150)],
    objections: ['"Ethics / confidentiality" → private deployment, attorney reviews every output.'],
  },
  accounting: {
    label: 'Accounting & Bookkeeping', fit: 0.85,
    pains: ['Tax-season document chasing', 'Receipt categorization', 'Repetitive client Q&A'],
    useCases: [uc('Client document collection automation', 10, 1500, 300), uc('AI transaction categorization review', 12, 2000, 350), uc('Client FAQ assistant', 5, 900, 150, 'chat')],
    objections: ['"Accuracy" → AI pre-sorts, CPA signs off; measurable error-rate tracking.'],
  },
  real_estate: {
    label: 'Real Estate', fit: 0.75,
    pains: ['Speed-to-lead', 'Listing copy', 'Showing coordination'],
    useCases: [uc('Instant lead response & qualification', 8, 1000, 300, 'chat'), uc('Listing description & social content', 5, 600, 150), uc('Showing scheduler', 4, 800, 100, 'booking')],
    objections: ['"My brand is personal" → AI trained on your voice; you approve outbound.'],
  },
  property_management: {
    label: 'Property Management', fit: 0.9,
    pains: ['Maintenance request triage', 'Tenant inquiries', 'Leasing follow-up'],
    useCases: [uc('Maintenance request triage bot', 12, 1500, 400, 'chat'), uc('Leasing inquiry & tour booking', 8, 1200, 250, 'booking'), uc('Owner report summarization', 4, 900, 150)],
    objections: ['"Tenants will hate it" → faster response times measurably reduce complaints.'],
  },
  restaurant: {
    label: 'Restaurant', fit: 0.65,
    pains: ['Phone orders during rush', 'Review management', 'Staff scheduling'],
    useCases: [uc('AI phone ordering & reservations', 10, 1200, 300, 'booking'), uc('Review response automation', 4, 500, 100, 'reviews'), uc('Demand-based staff scheduling', 4, 1000, 150)],
    objections: ['"Margins are thin" → start with phone orders; ROI shows in first month.'],
  },
  auto_repair: {
    label: 'Auto Repair', fit: 0.8,
    pains: ['Status-update calls', 'Estimate explanations', 'Booking by phone only'],
    useCases: [uc('Online booking + AI phone desk', 8, 1000, 250, 'booking'), uc('Automated repair status texts', 6, 800, 150, 'chat'), uc('Review request & response automation', 3, 500, 100, 'reviews')],
    objections: ['"Customers distrust shops" → transparent automated updates build trust.'],
  },
  salon_spa: {
    label: 'Salon & Spa', fit: 0.75,
    pains: ['Booking calls mid-service', 'No-shows', 'Rebooking'],
    useCases: [uc('Online booking + AI phone overflow', 8, 800, 200, 'booking'), uc('No-show & rebooking automation', 4, 600, 120), uc('Review response automation', 2, 400, 80, 'reviews')],
    objections: ['"Clients love the personal touch" → AI frees stylists to give more of it.'],
  },
  fitness: {
    label: 'Fitness', fit: 0.7,
    pains: ['Lead follow-up', 'Membership churn', 'Class scheduling'],
    useCases: [uc('Lead nurture & trial booking bot', 6, 900, 200, 'chat'), uc('Churn-risk outreach', 4, 1000, 150), uc('Class booking & waitlist automation', 4, 700, 120, 'booking')],
    objections: ['"We already have an app" → AI layers on top of your existing system.'],
  },
  insurance: {
    label: 'Insurance Agency', fit: 0.85,
    pains: ['Quote intake', 'Renewal reminders', 'Policy Q&A'],
    useCases: [uc('Quote intake & pre-fill assistant', 10, 1500, 300, 'chat'), uc('Renewal & cross-sell automation', 6, 1000, 200), uc('Policy FAQ assistant', 5, 900, 150)],
    objections: ['"Regulated industry" → licensed agent stays the decision-maker.'],
  },
};

export const DEFAULT_PLAYBOOK = {
  label: 'General Local Business', fit: 0.6,
  pains: ['Repetitive phone/email inquiries', 'Manual scheduling', 'Inconsistent follow-up'],
  useCases: [uc('AI inquiry assistant', 6, 1000, 200, 'chat'), uc('Online scheduling', 4, 800, 120, 'booking'), uc('Review response automation', 2, 400, 80, 'reviews')],
  objections: [],
};

export const playbookFor = (industry) => PLAYBOOKS[industry] ?? DEFAULT_PLAYBOOK;
