/**
 * Re-exports the policy rules from policyGates.ts with additional display
 * metadata for the Settings > Policy Reference UI.
 */

export { DEFAULT_POLICY_RULES } from './policyGates';
export type { PolicyRule, PolicyCategory } from './policyGates';

export const RISK_LEVEL_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const SEVERITY_LABEL: Record<string, string> = {
  block: 'Block',
  require_approval: 'Require Approval',
};

export const SEVERITY_COLOR: Record<string, string> = {
  block: 'var(--red)',
  require_approval: 'var(--amber)',
};

export const CATEGORY_LABEL: Record<string, string> = {
  migration: 'Database Migration',
  auth: 'Auth / Session',
  env_config: 'Env / Config',
  payment: 'Payment / Billing',
  production: 'Production',
  secrets: 'Secrets',
  destructive: 'Destructive Ops',
  infra: 'Infrastructure',
};

/**
 * Risk level priority: higher number = higher priority.
 * CRITICAL > HIGH > MEDIUM > LOW
 */
export function riskLevelPriority(level: string): number {
  return RISK_LEVEL_ORDER[level.toLowerCase()] ?? 0;
}

/**
 * Compute a risk summary from a list of tasks.
 * Returns counts per risk level.
 */
export function computeRiskSummary(
  tasks: Array<{ riskLevel: string }>,
): { critical: number; high: number; medium: number; low: number; unknown: number } {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const task of tasks) {
    const level = task.riskLevel?.toLowerCase();
    if (level === 'critical') summary.critical++;
    else if (level === 'high') summary.high++;
    else if (level === 'medium') summary.medium++;
    else if (level === 'low') summary.low++;
    else summary.unknown++;
  }
  return summary;
}

/**
 * Filter audit log events to only policy gate events.
 */
export function filterPolicyEvents(
  events: Array<{ event: string }>,
): Array<{ event: string }> {
  return events.filter(
    (e) => e.event === 'policy_gate_blocked' || e.event === 'policy_gate_approved',
  );
}
