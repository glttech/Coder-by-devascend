/**
 * PR Policy Engine — deterministic, file-aware policy evaluation for GitHub PRs.
 *
 * Sits on top of prIntelligence.ts: takes the signal output plus raw PR metadata
 * and produces a full policy verdict with founder-readable explanations,
 * audit-friendly summaries, and merge recommendations.
 *
 * Design rules:
 *   - Pure functions, no I/O, no LLM calls.
 *   - Honest confidence: degrades when file list is absent.
 *   - Every verdict comes with an evidence list.
 *   - Founder-facing text uses plain English.
 */

import {
  type PrIntelligence,
  type PrIntelInput,
  type SignalCategory,
  analyzePrImportance,
} from './prIntelligence';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PolicyVerdict = 'pass' | 'review_required' | 'blocked';

export type PrPolicyCategory =
  | 'env_secrets'
  | 'ci_failure'
  | 'migration'
  | 'auth_security'
  | 'rbac_permission'
  | 'infra_deploy'
  | 'billing'
  | 'api_contract'
  | 'dependency'
  | 'large_diff'
  | 'test_coverage'
  | 'unknown_files'
  | 'none';

export type PolicySeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type RequiredApprover = 'none' | 'engineer' | 'security_reviewer' | 'senior_engineer' | 'cto';
export type MergeRecommendation = 'safe_to_merge' | 'review_first' | 'do_not_merge';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface PrPolicyRule {
  id: string;
  name: string;
  category: PrPolicyCategory;
  severity: PolicySeverity;
  verdict: PolicyVerdict;
  requiredApprover: RequiredApprover;
  description: string; // technical
  founderText: string; // plain English for founder/CTO
}

export interface PrPolicyViolation {
  ruleId: string;
  ruleName: string;
  category: PrPolicyCategory;
  severity: PolicySeverity;
  verdict: PolicyVerdict;
  requiredApprover: RequiredApprover;
  reason: string;
  evidence: string;
}

export interface PrPolicyResult {
  verdict: PolicyVerdict;
  /** 0–100: 100 = most policy risk */
  policyScore: number;
  violatedPolicies: PrPolicyViolation[];
  /** Category of the highest-severity violation */
  topCategory: PrPolicyCategory;
  severity: PolicySeverity;
  requiredApprover: RequiredApprover;
  reason: string;
  evidence: string[];
  recommendedNextAction: string;
  mergeRecommendation: MergeRecommendation;
  /** Plain English for a founder / CTO who is not in the code */
  founderExplanation: string;
  /** Single-line for audit log */
  auditSummary: string;
  /** Degrades when no file list provided */
  confidenceLevel: ConfidenceLevel;
}

// ── Severity ordering ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<PolicySeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const VERDICT_RANK: Record<PolicyVerdict, number> = {
  pass: 0,
  review_required: 1,
  blocked: 2,
};

const SEVERITY_SCORE: Record<PolicySeverity, number> = {
  none: 0,
  low: 8,
  medium: 20,
  high: 35,
  critical: 50,
};

// ── Policy rules ─────────────────────────────────────────────────────────────

export const PR_POLICY_RULES: PrPolicyRule[] = [
  {
    id: 'env-secrets-blocked',
    name: 'Env / Secrets Change Blocked',
    category: 'env_secrets',
    severity: 'critical',
    verdict: 'blocked',
    requiredApprover: 'cto',
    description: 'Environment files or secret/credential files are modified. Merging without explicit human approval risks exposing credentials.',
    founderText: 'This PR touches secrets or environment config files. It cannot merge automatically — you must personally review what changed before approving.',
  },
  {
    id: 'ci-failure-blocks',
    name: 'CI Failure Blocks Merge',
    category: 'ci_failure',
    severity: 'critical',
    verdict: 'blocked',
    requiredApprover: 'engineer',
    description: 'CI checks are failing on the head commit. Merging broken code is blocked by policy.',
    founderText: 'The automated tests are failing on this PR. It must not merge until they pass — broken code should not reach the main branch.',
  },
  {
    id: 'migration-requires-approval',
    name: 'Database Migration Requires Approval',
    category: 'migration',
    severity: 'high',
    verdict: 'review_required',
    requiredApprover: 'senior_engineer',
    description: 'Schema or migration files are modified. Irreversible database changes require human validation.',
    founderText: 'This PR changes the database structure. These changes can be difficult to reverse once deployed, so a senior engineer must review and confirm it\'s safe.',
  },
  {
    id: 'auth-security-requires-approval',
    name: 'Auth / Security Path Requires Approval',
    category: 'auth_security',
    severity: 'high',
    verdict: 'review_required',
    requiredApprover: 'security_reviewer',
    description: 'Authentication, session, or security-critical paths are modified. Vulnerabilities in this area can compromise all user accounts.',
    founderText: 'This PR changes how users log in or how the app handles security. These paths need a security-conscious review before merging.',
  },
  {
    id: 'rbac-requires-approval',
    name: 'RBAC / Permission Change Requires Approval',
    category: 'rbac_permission',
    severity: 'high',
    verdict: 'review_required',
    requiredApprover: 'security_reviewer',
    description: 'Role-based access control or permission logic is modified. Incorrect changes can allow unauthorized access.',
    founderText: 'This PR changes who can access what in the application. Permission logic errors can expose data or features to the wrong users — it needs review.',
  },
  {
    id: 'infra-deploy-requires-review',
    name: 'Infra / Deploy Config Requires Review',
    category: 'infra_deploy',
    severity: 'medium',
    verdict: 'review_required',
    requiredApprover: 'senior_engineer',
    description: 'Dockerfile, CI/CD workflows, or infrastructure config are modified. Errors can break deployments for all users.',
    founderText: 'This PR changes how the application is built or deployed. Infrastructure mistakes can cause outages — it needs a review before merging.',
  },
  {
    id: 'billing-requires-review',
    name: 'Billing / Payment Code Requires Review',
    category: 'billing',
    severity: 'medium',
    verdict: 'review_required',
    requiredApprover: 'senior_engineer',
    description: 'Billing or payment processing code is modified. Errors can cause incorrect charges or revenue loss.',
    founderText: 'This PR changes payment or billing code. Bugs here directly affect revenue and customer trust — it needs careful review.',
  },
  {
    id: 'api-contract-requires-review',
    name: 'API Contract Change Requires Review',
    category: 'api_contract',
    severity: 'medium',
    verdict: 'review_required',
    requiredApprover: 'engineer',
    description: 'API routes or contracts are modified. Breaking changes can affect downstream callers.',
    founderText: 'This PR modifies an API — the interface other parts of the system rely on. Changes here can break integrations if not reviewed carefully.',
  },
  {
    id: 'dependency-requires-review',
    name: 'Dependency Change Requires Review',
    category: 'dependency',
    severity: 'low',
    verdict: 'review_required',
    requiredApprover: 'engineer',
    description: 'Package dependencies are added, removed, or upgraded. Supply-chain risk and compatibility must be checked.',
    founderText: 'This PR adds or changes external code libraries. New dependencies can introduce security vulnerabilities or compatibility issues.',
  },
  {
    id: 'large-diff-requires-review',
    name: 'Large Diff Requires Review',
    category: 'large_diff',
    severity: 'low',
    verdict: 'review_required',
    requiredApprover: 'engineer',
    description: 'The PR touches many files, increasing the surface area for undetected regressions.',
    founderText: 'This PR is very large, changing many files at once. Large changes are harder to review and more likely to introduce bugs that are hard to trace.',
  },
  {
    id: 'test-deletion-warning',
    name: 'Test Deletion Warning',
    category: 'test_coverage',
    severity: 'low',
    verdict: 'review_required',
    requiredApprover: 'engineer',
    description: 'The PR description indicates tests are being removed or skipped, reducing coverage and the ability to catch regressions.',
    founderText: 'This PR removes or disables automated tests. Tests are what catch bugs before they reach users — removing them increases risk.',
  },
  {
    id: 'unknown-files-low-confidence',
    name: 'File List Missing — Low Confidence',
    category: 'unknown_files',
    severity: 'low',
    verdict: 'review_required',
    requiredApprover: 'engineer',
    description: 'The PR was imported without a file change list. Policy evaluation is based on title/description only and may miss file-level risks.',
    founderText: 'We don\'t have the full list of changed files for this PR. Our risk assessment is less reliable — a human should verify what this PR actually touches.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function higher(a: PolicySeverity, b: PolicySeverity): PolicySeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function highestVerdict(a: PolicyVerdict, b: PolicyVerdict): PolicyVerdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

function highestApprover(a: RequiredApprover, b: RequiredApprover): RequiredApprover {
  const rank: Record<RequiredApprover, number> = { none: 0, engineer: 1, security_reviewer: 2, senior_engineer: 3, cto: 4 };
  return rank[a] >= rank[b] ? a : b;
}

const APPROVER_LABEL: Record<RequiredApprover, string> = {
  none: 'None',
  engineer: 'Engineer',
  security_reviewer: 'Security Reviewer',
  senior_engineer: 'Senior Engineer',
  cto: 'Founder / CTO',
};

const CATEGORY_LABEL: Record<PrPolicyCategory, string> = {
  env_secrets: 'Env / Secrets',
  ci_failure: 'CI Failure',
  migration: 'Database Migration',
  auth_security: 'Auth / Security',
  rbac_permission: 'RBAC / Permissions',
  infra_deploy: 'Infra / Deploy',
  billing: 'Billing',
  api_contract: 'API Contract',
  dependency: 'Dependencies',
  large_diff: 'Large Diff',
  test_coverage: 'Test Coverage',
  unknown_files: 'Unknown Files',
  none: 'None',
};

export { APPROVER_LABEL, CATEGORY_LABEL };

// ── Signal category → policy category ─────────────────────────────────────────

const SIGNAL_TO_POLICY: Partial<Record<SignalCategory, PrPolicyCategory>> = {
  env_secrets: 'env_secrets',
  migration: 'migration',
  auth_security: 'auth_security',
  rbac_permission: 'rbac_permission',
  infra_deploy: 'infra_deploy',
  billing: 'billing',
  api_contract: 'api_contract',
  dependency: 'dependency',
  large_diff: 'large_diff',
  test_change: 'test_coverage',
  ci: 'ci_failure',
};

// ── Core evaluator ────────────────────────────────────────────────────────────

export interface PrPolicyInput extends PrIntelInput {
  /** Pass pre-computed intel to avoid re-running the analyzer */
  _intel?: PrIntelligence;
}

export function evaluatePrPolicy(input: PrPolicyInput): PrPolicyResult {
  const intel = input._intel ?? analyzePrImportance(input);

  const files = input.filesChanged ?? [];
  const hasFileList = files.length > 0 || (input.filesChangedCount ?? 0) > 0;
  const ci = (input.ciStatus ?? '').toLowerCase();
  const violations: PrPolicyViolation[] = [];

  // ── Map intelligence signals to policy violations ─────────────────────────
  for (const sig of intel.signals) {
    const policyCategory = SIGNAL_TO_POLICY[sig.category];
    if (!policyCategory) continue;

    const rule = PR_POLICY_RULES.find((r) => r.category === policyCategory);
    if (!rule) continue;

    // CI failure is handled separately below (needs ciStatus check)
    if (policyCategory === 'ci_failure') continue;

    violations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      verdict: rule.verdict,
      requiredApprover: rule.requiredApprover,
      reason: rule.description,
      evidence: sig.evidence,
    });
  }

  // ── CI failure check ──────────────────────────────────────────────────────
  if (ci === 'failure') {
    const rule = PR_POLICY_RULES.find((r) => r.id === 'ci-failure-blocks')!;
    violations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      verdict: rule.verdict,
      requiredApprover: rule.requiredApprover,
      reason: rule.description,
      evidence: 'CI checks are failing on the head commit.',
    });
  }

  // ── Unknown files degrades confidence ─────────────────────────────────────
  const confidenceLevel: ConfidenceLevel = !hasFileList
    ? 'low'
    : intel.signals.length === 0
    ? 'high'
    : 'high';

  // Add low-confidence violation only when files absent and non-trivial PR
  if (!hasFileList && (input.filesChangedCount == null || input.filesChangedCount === 0)) {
    const rule = PR_POLICY_RULES.find((r) => r.id === 'unknown-files-low-confidence')!;
    violations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      verdict: rule.verdict,
      requiredApprover: rule.requiredApprover,
      reason: rule.description,
      evidence: 'No file change list available — risk evaluation based on title/description only.',
    });
  }

  // ── Aggregate results ─────────────────────────────────────────────────────
  let verdict: PolicyVerdict = 'pass';
  let severity: PolicySeverity = 'none';
  let topCategory: PrPolicyCategory = 'none';
  let requiredApprover: RequiredApprover = 'none';

  for (const v of violations) {
    verdict = highestVerdict(verdict, v.verdict);
    severity = higher(severity, v.severity);
    requiredApprover = highestApprover(requiredApprover, v.requiredApprover);
    if (SEVERITY_RANK[v.severity] >= SEVERITY_RANK[severity]) {
      topCategory = v.category;
    }
  }

  // Score: sum of severity weights, capped at 100
  const rawScore = violations.reduce((sum, v) => sum + SEVERITY_SCORE[v.severity], 0);
  const policyScore = Math.min(100, rawScore);

  const evidence = violations.map((v) => v.evidence).filter(Boolean);

  // ── Recommended next action ───────────────────────────────────────────────
  let recommendedNextAction: string;
  if (verdict === 'blocked') {
    const blockingViolation = violations.find((v) => v.verdict === 'blocked');
    recommendedNextAction = blockingViolation
      ? `${blockingViolation.ruleName}: ${intel.nextAction}`
      : intel.nextAction;
  } else if (verdict === 'review_required') {
    const topViolation = violations.find((v) => v.verdict === 'review_required');
    const approver = APPROVER_LABEL[requiredApprover];
    recommendedNextAction = topViolation
      ? `${approver} must review: ${topViolation.reason}`
      : `${approver} review required before merging.`;
  } else {
    recommendedNextAction = intel.mergeReadiness.ready
      ? 'All policies pass. Approve and merge.'
      : 'All policies pass — wait for CI to complete, then merge.';
  }

  // ── Merge recommendation ──────────────────────────────────────────────────
  const mergeRecommendation: MergeRecommendation =
    verdict === 'blocked'
      ? 'do_not_merge'
      : verdict === 'review_required'
      ? 'review_first'
      : 'safe_to_merge';

  // ── Reason (primary explanation) ─────────────────────────────────────────
  let reason: string;
  if (violations.length === 0) {
    reason = 'No policy violations. PR appears safe to merge.';
  } else if (verdict === 'blocked') {
    const blocker = violations.find((v) => v.verdict === 'blocked');
    reason = blocker ? blocker.reason : 'A blocking policy violation was detected.';
  } else {
    reason = `${violations.length} policy concern${violations.length > 1 ? 's' : ''} require review before merge.`;
  }

  // ── Founder explanation ───────────────────────────────────────────────────
  let founderExplanation: string;
  if (violations.length === 0) {
    founderExplanation =
      'This PR passes all automated policy checks. No sensitive areas were detected in the changed files, CI is passing, and the change appears safe to merge.';
  } else {
    const blockingRules = violations.filter((v) => v.verdict === 'blocked');
    const reviewRules = violations.filter((v) => v.verdict === 'review_required');
    const parts: string[] = [];
    if (blockingRules.length > 0) {
      const rule = PR_POLICY_RULES.find((r) => r.id === blockingRules[0].ruleId);
      parts.push(rule?.founderText ?? blockingRules[0].reason);
    }
    if (reviewRules.length > 0 && blockingRules.length === 0) {
      const rule = PR_POLICY_RULES.find((r) => r.id === reviewRules[0].ruleId);
      parts.push(rule?.founderText ?? reviewRules[0].reason);
    }
    if (violations.length > 1) {
      parts.push(`There ${violations.length === 2 ? 'is' : 'are'} ${violations.length - 1} additional concern${violations.length === 2 ? '' : 's'}.`);
    }
    founderExplanation = parts.join(' ');
  }

  // ── Audit summary ─────────────────────────────────────────────────────────
  const violationList = violations.map((v) => v.ruleName).join(', ');
  const auditSummary =
    violations.length === 0
      ? `Policy: PASS — score ${policyScore}/100, no violations, merge=${mergeRecommendation}`
      : `Policy: ${verdict.toUpperCase()} — score ${policyScore}/100, violations=[${violationList}], approver=${requiredApprover}, merge=${mergeRecommendation}`;

  return {
    verdict,
    policyScore,
    violatedPolicies: violations,
    topCategory,
    severity,
    requiredApprover,
    reason,
    evidence,
    recommendedNextAction,
    mergeRecommendation,
    founderExplanation,
    auditSummary,
    confidenceLevel,
  };
}

// ── List helpers ──────────────────────────────────────────────────────────────

export interface PolicyVerdictCounts {
  pass: number;
  review_required: number;
  blocked: number;
  total: number;
}

export function summarizePolicyVerdicts(
  results: PrPolicyResult[],
): PolicyVerdictCounts {
  const counts: PolicyVerdictCounts = { pass: 0, review_required: 0, blocked: 0, total: results.length };
  for (const r of results) {
    counts[r.verdict]++;
  }
  return counts;
}

// ── Display metadata ──────────────────────────────────────────────────────────

export const VERDICT_META: Record<PolicyVerdict, { label: string; color: string; badge: string }> = {
  pass: { label: 'Pass', color: 'var(--green)', badge: 'badge-success' },
  review_required: { label: 'Review Required', color: 'var(--amber)', badge: 'badge-warning' },
  blocked: { label: 'Blocked', color: 'var(--red)', badge: 'badge-sev-high' },
};

export const SEVERITY_META: Record<PolicySeverity, { label: string; color: string }> = {
  none: { label: 'None', color: 'var(--text-muted)' },
  low: { label: 'Low', color: 'var(--blue)' },
  medium: { label: 'Medium', color: 'var(--amber)' },
  high: { label: 'High', color: 'var(--red)' },
  critical: { label: 'Critical', color: 'var(--red)' },
};
