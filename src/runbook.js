// Runbooks for operators and AI agents. By design they contain ONLY placeholders ({{business.phone}},
// {{secret:SQUARE_ACCESS_TOKEN}}) and progress flags — never a client's actual values — so a runbook can be given
// to any AI agent without sharing client information. Values are filled in by Bizzle's non-AI setup system.
import { WORKFLOW_DEFS, UNIVERSAL_SECURITY, fieldsFor } from '../public/workflows.js';
import { WORKFLOWS } from '../public/pricing.js';

const AGENT_RULES = [
  'You are helping deliver a setup for a local business. Work ONLY with the placeholders in this runbook.',
  'Never ask for, guess, print or store a value behind a {{secret:…}} placeholder. Secrets stay in the client\'s encrypted vault and are used only by Bizzle\'s non-AI setup system.',
  'Never ask the client or operator to paste their information into this conversation. Refer to fields by placeholder (e.g. {{business.phone}}).',
  'Prefer invitations and limited roles over passwords. Never request an account owner\'s password.',
  'Every change needs a rollback step and the client\'s approval before it goes live.',
  'If a step needs information that is not listed as provided, stop and mark it "waiting on client".',
];

export function buildRunbook(workflows, status = null) {
  const L = [];
  const has = (k) => (status ? (status.provided.includes(k) ? '✓ provided' : '— missing') : '');
  L.push(`# Setup runbook${status ? ` — workspace ${status.clientRef}` : ''}`, '');
  L.push('## Rules for AI agents and operators', ...AGENT_RULES.map((r) => `- ${r}`), '');
  L.push('## Security baseline (every engagement)', ...UNIVERSAL_SECURITY.map((r) => `- [ ] ${r}`), '');
  L.push('## Client inputs (placeholders)', '', '| Placeholder | Field | Status |', '|---|---|---|');
  for (const { fields } of fieldsFor(workflows)) for (const f of fields) L.push(`| \`{{${f.key}}}\` | ${f.label} | ${has(f.key)} |`);
  L.push('');
  for (const id of workflows) {
    const w = WORKFLOW_DEFS[id];
    if (!w) continue;
    L.push(`## ${WORKFLOWS[id]?.label ?? id}`, '', '### Access needed (least privilege)');
    for (const a of w.access) {
      const s = a.kind === 'secret' ? `\`{{secret:${a.name}}}\` — ${a.optional ? 'optional, ' : ''}${status ? (status.secrets.includes(a.name) ? 'stored in vault ✓' : 'not provided') : 'stored in client vault'}` : a.kind === 'invite' ? 'client invites us (no password shared)' : 'client changes a setting (we give exact steps)';
      L.push(`- **${a.label ?? a.name}** — ${s}. ${a.detail}`);
    }
    L.push('', '### Security checks', ...w.security.map((s) => `- [ ] ${s}`), '', '### Steps');
    w.steps.forEach((s, i) => L.push(`${i + 1}. ${s.auto ? '**[automated]**' : '[manual]'} ${s.title}`));
    L.push('', `**Verify:** ${w.verify}`, '', `**Rollback:** ${w.rollback}`, '');
  }
  return L.join('\n');
}
