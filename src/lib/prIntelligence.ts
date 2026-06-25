/**
 * PR Intelligence engine — deterministic, file-aware importance & risk scoring.
 *
 * No LLM calls, no network. Given a PR's metadata (title, body, labels, changed
 * file paths, CI status, classification, diff size) it produces:
 *   - importance signals (which roadmap rules fired, with honest evidence)
 *   - an importance score (0–100) and a priority bucket
 *   - a triage bucket: "blocked" | "needs_review" | "safe"
 *   - a "needs review" flag (the "Needs Rahul review" signal)
 *   - a merge-readiness verdict with concrete blockers and warnings
 *
 * Design rules:
 *   - Honest signals only. We have file *paths* (not add/delete status), so we
 *     never claim a line was deleted — test-removal is only flagged when the
 *     title/body explicitly says so.
 *   - Pure functions, fully unit-testable without a DB or network.
 */

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SignalCategory =
  | 'migration'
  | 'auth_security'
  | 'env_secrets'
  | 'infra_deploy'
  | 'api_contract'
  | 'billing'
  | 'rbac_permission'
  | 'dependency'
  | 'test_change'
  | 'large_diff'
  | 'ci';

export interface ImportanceSignal {
  key: string;
  label: string;
  category: SignalCategory;
  severity: SignalSeverity;
  /** Concrete, human-readable reason this signal fired (no invented facts). */
  evidence: string;
}

export type PrPriority = 'low' | 'medium' | 'high' | 'critical';
export type PrTriage = 'safe' | 'needs_review' | 'blocked';

export interface MergeReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export interface PrIntelligence {
  signals: ImportanceSignal[];
  importanceScore: number; // 0–100
  priority: PrPriority;
  triage: PrTriage;
  needsReview: boolean;
  mergeReadiness: MergeReadiness;
}

export interface PrIntelInput {
  title: string;
  body?: string | null;
  labels?: string[];
  filesChanged?: string[];
  filesChangedCount?: number | null;
  ciStatus?: string | null; // "success" | "failure" | "pending" | "neutral" | null
  state?: string | null; // "open" | "closed" | "merged"
  merged?: boolean;
  classification?: string | null;
}

// ── Severity weights for the importance score ────────────────────────────────

const SEVERITY_WEIGHT: Record<SignalSeverity, number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
};

// ── File-path rules (the heart of "which PRs matter") ────────────────────────

interface FileRule {
  key: string;
  label: string;
  category: SignalCategory;
  severity: SignalSeverity;
  pattern: RegExp;
  evidence: string;
}

const FILE_RULES: FileRule[] = [
  {
    key: 'env-secrets-file',
    label: 'Env / secrets file touched',
    category: 'env_secrets',
    severity: 'critical',
    pattern: /(^|\/)\.env(\.|$)|(^|\/)secrets?\/|\.pem$|\.key$|(^|\/)credentials?(\.|\/|$)|id_rsa/i,
    evidence: 'Changes an environment or secrets file — verify nothing sensitive is committed.',
  },
  {
    key: 'db-migration-file',
    label: 'Database migration / schema',
    category: 'migration',
    severity: 'high',
    pattern: /prisma\/migrations\/|schema\.prisma$|\.sql$|(^|\/)migrations?\//i,
    evidence: 'Modifies a database migration or schema file — irreversible data risk.',
  },
  {
    key: 'auth-security-file',
    label: 'Auth / security path',
    category: 'auth_security',
    severity: 'high',
    pattern: /(^|\/)auth\/|(^|\/)middleware(\.|\/)|(^|\/)security\/|session|login|oauth|jwt|passport|bcrypt/i,
    evidence: 'Touches an authentication or security-sensitive path.',
  },
  {
    key: 'rbac-permission-file',
    label: 'Permission / RBAC change',
    category: 'rbac_permission',
    severity: 'high',
    pattern: /rbac|permission|(^|\/)roles?(\.|\/)|access[-_]?control|policy|policies/i,
    evidence: 'Changes role, permission, or access-control logic.',
  },
  {
    key: 'infra-deploy-file',
    label: 'Infra / deploy / CI config',
    category: 'infra_deploy',
    severity: 'high',
    pattern: /dockerfile|docker-compose|\.github\/workflows\/|\.github\/actions\/|terraform|\.tf$|k8s|kubernetes|helm|ansible|vercel\.json|fly\.toml|nginx/i,
    evidence: 'Modifies infrastructure, container, or CI/CD configuration.',
  },
  {
    key: 'billing-file',
    label: 'Billing / payment path',
    category: 'billing',
    severity: 'high',
    pattern: /billing|stripe|payment|checkout|subscription|invoice/i,
    evidence: 'Touches billing or payment code.',
  },
  {
    key: 'api-contract-file',
    label: 'API contract surface',
    category: 'api_contract',
    severity: 'medium',
    pattern: /(^|\/)api\/|route\.[jt]sx?$|openapi|swagger|\.proto$|graphql|schema\.graphql/i,
    evidence: 'Changes an API route or contract — may affect callers.',
  },
  {
    key: 'dependency-file',
    label: 'Dependency change',
    category: 'dependency',
    severity: 'medium',
    pattern: /package\.json$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|requirements\.txt$|go\.mod$|go\.sum$|gemfile|cargo\.toml$|composer\.json$/i,
    evidence: 'Adds, removes, or upgrades dependencies.',
  },
];

// ── Title / body classification → signal fallbacks ───────────────────────────
// Used when file paths are unavailable (PR imported without file list).

const TEXT_RULES: Array<{
  key: string;
  label: string;
  category: SignalCategory;
  severity: SignalSeverity;
  pattern: RegExp;
  evidence: string;
}> = [
  {
    key: 'env-secrets-text',
    label: 'Env / secrets reference',
    category: 'env_secrets',
    severity: 'high',
    pattern: /\b(env(?:ironment)?\s+var|secret|api[_\s-]?key|credential|\.env\b)\b/i,
    evidence: 'Title or description references environment variables or secrets.',
  },
  {
    key: 'migration-text',
    label: 'Migration mentioned',
    category: 'migration',
    severity: 'high',
    pattern: /\b(migration|migrate|alter\s+table|drop\s+column|add\s+column|schema\s+change)\b/i,
    evidence: 'Title or description mentions a database migration or schema change.',
  },
  {
    key: 'auth-security-text',
    label: 'Auth / security mentioned',
    category: 'auth_security',
    severity: 'high',
    pattern: /\b(authentication|authorization|security\s+fix|vulnerability|cve-\d|xss|csrf|sql\s+injection)\b/i,
    evidence: 'Title or description references security or authentication work.',
  },
  {
    key: 'billing-text',
    label: 'Billing / payment mentioned',
    category: 'billing',
    severity: 'medium',
    pattern: /\b(billing|payment|stripe|checkout|subscription|invoice)\b/i,
    evidence: 'Title or description references billing or payments.',
  },
];

// Test-removal is only asserted when the author says so — we cannot see deletions
// from file paths alone.
// Allows up to 3 intervening words between the verb and "test(s)", so that
// "remove flaky tests" / "skip the integration tests" / "delete tests" all match.
const TEST_REMOVAL_PATTERN =
  /\b(remov(?:e|ed|ing)|delet(?:e|ed|ing)|drop(?:ped|ping)?|skip(?:ped|ping)?|disabl(?:e|ed|ing))\s+(?:\w+\s+){0,3}tests?\b/i;

const TEST_FILE_PATTERN = /(^|\/)__tests__\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$/i;

// ── Diff-size thresholds ─────────────────────────────────────────────────────

const LARGE_DIFF_HIGH = 40;
const LARGE_DIFF_MEDIUM = 18;

// ── Core analyzer ────────────────────────────────────────────────────────────

export function analyzePrImportance(input: PrIntelInput): PrIntelligence {
  const title = input.title ?? '';
  const body = input.body ?? '';
  const labels = input.labels ?? [];
  const files = input.filesChanged ?? [];
  const fileCount = input.filesChangedCount ?? files.length;
  const ci = (input.ciStatus ?? '').toLowerCase();
  const state = (input.state ?? '').toLowerCase();
  const merged = input.merged ?? state === 'merged';

  const signals: ImportanceSignal[] = [];
  const seenCategories = new Set<SignalCategory>();

  // 1. File-path rules (highest fidelity)
  const joined = files.join('\n');
  if (files.length > 0) {
    for (const rule of FILE_RULES) {
      if (rule.pattern.test(joined)) {
        const matched = files.filter((f) => rule.pattern.test(f));
        signals.push({
          key: rule.key,
          label: rule.label,
          category: rule.category,
          severity: rule.severity,
          evidence:
            matched.length > 0
              ? `${rule.evidence} (${matched.length} file${matched.length === 1 ? '' : 's'}, e.g. ${matched[0]})`
              : rule.evidence,
        });
        seenCategories.add(rule.category);
      }
    }
  }

  // 2. Text fallbacks (only add a category not already covered by files)
  const text = `${title}\n${body}`;
  for (const rule of TEXT_RULES) {
    if (seenCategories.has(rule.category)) continue;
    if (rule.pattern.test(text)) {
      signals.push({
        key: rule.key,
        label: rule.label,
        category: rule.category,
        severity: rule.severity,
        evidence: rule.evidence,
      });
      seenCategories.add(rule.category);
    }
  }

  // 3. Classification-driven signal (migration/security/deployment carry weight)
  const cls = (input.classification ?? '').toLowerCase();
  if (cls === 'migration' && !seenCategories.has('migration')) {
    signals.push({
      key: 'classified-migration',
      label: 'Classified as migration',
      category: 'migration',
      severity: 'high',
      evidence: 'PR classifier tagged this as a migration.',
    });
    seenCategories.add('migration');
  }
  if (cls === 'security' && !seenCategories.has('auth_security')) {
    signals.push({
      key: 'classified-security',
      label: 'Classified as security',
      category: 'auth_security',
      severity: 'high',
      evidence: 'PR classifier tagged this as a security change.',
    });
    seenCategories.add('auth_security');
  }

  // 4. Test-coverage removal (honest: only when author states it)
  if (TEST_REMOVAL_PATTERN.test(text)) {
    const touchesTests = files.some((f) => TEST_FILE_PATTERN.test(f));
    signals.push({
      key: 'test-removal',
      label: 'Possible test removal',
      category: 'test_change',
      severity: touchesTests ? 'high' : 'medium',
      evidence: touchesTests
        ? 'Description mentions removing tests and test files are in the changeset — confirm coverage is preserved.'
        : 'Description mentions removing/skipping tests — confirm coverage is preserved.',
    });
  }

  // 5. Large diff
  if (fileCount >= LARGE_DIFF_HIGH) {
    signals.push({
      key: 'large-diff-high',
      label: 'Very large diff',
      category: 'large_diff',
      severity: 'high',
      evidence: `${fileCount} files changed — large surface area for regressions.`,
    });
  } else if (fileCount >= LARGE_DIFF_MEDIUM) {
    signals.push({
      key: 'large-diff-medium',
      label: 'Large diff',
      category: 'large_diff',
      severity: 'medium',
      evidence: `${fileCount} files changed — review scope carefully.`,
    });
  }

  // 6. CI signal
  if (ci === 'failure') {
    signals.push({
      key: 'ci-failure',
      label: 'CI failing',
      category: 'ci',
      severity: 'critical',
      evidence: 'CI checks are failing on the head commit.',
    });
  }

  // ── Score & priority ───────────────────────────────────────────────────────
  const rawScore = signals.reduce((sum, s) => sum + SEVERITY_WEIGHT[s.severity], 0);
  const importanceScore = Math.min(100, rawScore);

  const hasCritical = signals.some((s) => s.severity === 'critical');
  const hasHigh = signals.some((s) => s.severity === 'high');

  let priority: PrPriority;
  if (hasCritical || importanceScore >= 70) priority = 'critical';
  else if (hasHigh || importanceScore >= 37) priority = 'high';
  else if (importanceScore >= 12) priority = 'medium';
  else priority = 'low';

  // ── Merge readiness ────────────────────────────────────────────────────────
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (ci === 'failure') blockers.push('CI is failing — cannot merge until checks pass.');
  if (signals.some((s) => s.category === 'env_secrets')) {
    blockers.push('Touches env/secrets — requires explicit human approval before merge.');
  }
  if (ci === 'pending' || ci === '') {
    warnings.push('CI status is not green yet — wait for checks to complete.');
  }
  if (signals.some((s) => s.category === 'migration')) {
    warnings.push('Contains a migration — verify it has been validated before merge.');
  }
  if (signals.some((s) => s.category === 'large_diff')) {
    warnings.push('Large diff — allow extra review time.');
  }
  if (signals.some((s) => s.key === 'test-removal')) {
    warnings.push('Possible test removal — confirm coverage is preserved.');
  }

  // ── Triage bucket ──────────────────────────────────────────────────────────
  let triage: PrTriage;
  if (blockers.length > 0) triage = 'blocked';
  else if (priority === 'critical' || priority === 'high') triage = 'needs_review';
  else triage = 'safe';

  const needsReview = triage !== 'safe';

  // mergeReadiness.ready: open, no blockers, CI green
  const ready =
    !merged &&
    state !== 'closed' &&
    blockers.length === 0 &&
    (ci === 'success' || ci === 'neutral');

  return {
    signals,
    importanceScore,
    priority,
    triage,
    needsReview,
    mergeReadiness: { ready, blockers, warnings },
  };
}

// ── List helpers for UI ──────────────────────────────────────────────────────

export interface TriageCounts {
  blocked: number;
  needsReview: number;
  safe: number;
  total: number;
}

export function summarizeTriage(items: PrIntelligence[]): TriageCounts {
  const counts: TriageCounts = { blocked: 0, needsReview: 0, safe: 0, total: items.length };
  for (const it of items) {
    if (it.triage === 'blocked') counts.blocked++;
    else if (it.triage === 'needs_review') counts.needsReview++;
    else counts.safe++;
  }
  return counts;
}

const PRIORITY_RANK: Record<PrPriority, number> = { critical: 3, high: 2, medium: 1, low: 0 };

/** Sort comparator: most important first (priority, then score). */
export function compareByImportance(a: PrIntelligence, b: PrIntelligence): number {
  const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (pr !== 0) return pr;
  return b.importanceScore - a.importanceScore;
}

// ── Display metadata ─────────────────────────────────────────────────────────

export const PRIORITY_META: Record<PrPriority, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'var(--red)' },
  high: { label: 'High', color: 'var(--amber)' },
  medium: { label: 'Medium', color: 'var(--blue)' },
  low: { label: 'Low', color: 'var(--text-muted)' },
};

export const TRIAGE_META: Record<PrTriage, { label: string; color: string; badge: string }> = {
  blocked: { label: 'Blocked', color: 'var(--red)', badge: 'badge-sev-high' },
  needs_review: { label: 'Needs Review', color: 'var(--amber)', badge: 'badge-warning' },
  safe: { label: 'Safe', color: 'var(--green)', badge: 'badge-success' },
};
