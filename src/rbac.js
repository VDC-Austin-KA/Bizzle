// Role → permission map. Each permission gates one "zone" of the app.
export const PERMISSIONS = {
  LEADS_READ: 'leads:read',       // Lead Finder zone
  LEADS_WRITE: 'leads:write',     // create / import / discover leads
  PIPELINE_WRITE: 'pipeline:write', // Pipeline zone: move stages, log notes
  ANALYTICS_READ: 'analytics:read', // Analytics zone
  STRATEGY_READ: 'strategy:read', // Strategy zone: playbooks, pitch, ROI
  ADMIN_USERS: 'admin:users',     // Admin zone
};

const P = PERMISSIONS;
export const ROLES = {
  owner: Object.values(P),
  analyst: [P.LEADS_READ, P.LEADS_WRITE, P.ANALYTICS_READ, P.STRATEGY_READ],
  sales: [P.LEADS_READ, P.PIPELINE_WRITE, P.STRATEGY_READ],
};

export const can = (user, perm) => !!user && (ROLES[user.role] ?? []).includes(perm);
