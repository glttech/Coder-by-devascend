/**
 * Deterministic PR classifier — no LLM calls, no external dependencies.
 * Classifies PRs by type and detects bug-related state from title, body,
 * labels, and changed file paths.
 */

export type PrClassificationType =
  | 'feature'
  | 'bug_fix'
  | 'security'
  | 'migration'
  | 'deployment'
  | 'rollback'
  | 'incident'
  | 'chore'
  | 'test'
  | 'docs';

export type PrClassificationSource = 'auto_title' | 'auto_label' | 'auto_files' | 'manual';

export type BugState = 'known_issue' | 'fixed' | 'regression_risk' | 'needs_retest' | null;

export interface PrClassification {
  classification: PrClassificationType;
  classificationSource: PrClassificationSource;
  confidence: 'high' | 'medium' | 'low';
}

export interface PrClassifierInput {
  title: string;
  body: string | null;
  labels: string[];
  filesChanged: string[];
  ciStatus?: string | null;
}

// ── Label-based classification (highest confidence) ─────────────────────────

const LABEL_MAP: Record<string, PrClassificationType> = {
  bug: 'bug_fix',
  bugfix: 'bug_fix',
  'bug fix': 'bug_fix',
  fix: 'bug_fix',
  hotfix: 'bug_fix',
  security: 'security',
  vulnerability: 'security',
  cve: 'security',
  migration: 'migration',
  'database migration': 'migration',
  feature: 'feature',
  enhancement: 'feature',
  feat: 'feature',
  deploy: 'deployment',
  deployment: 'deployment',
  release: 'deployment',
  rollback: 'rollback',
  revert: 'rollback',
  incident: 'incident',
  'hotfix/incident': 'incident',
  chore: 'chore',
  maintenance: 'chore',
  dependencies: 'chore',
  deps: 'chore',
  test: 'test',
  tests: 'test',
  testing: 'test',
  documentation: 'docs',
  docs: 'docs',
};

// ── Title prefix patterns (second priority) ──────────────────────────────────

const TITLE_PATTERNS: Array<{ pattern: RegExp; type: PrClassificationType }> = [
  { pattern: /^(?:fix|hotfix|bugfix)(?:\(.*?\))?!?:/i, type: 'bug_fix' },
  { pattern: /^(?:revert|rollback)(?:\(.*?\))?!?:/i, type: 'rollback' },
  { pattern: /^(?:security|sec)(?:\(.*?\))?!?:/i, type: 'security' },
  { pattern: /^(?:feat|feature)(?:\(.*?\))?!?:/i, type: 'feature' },
  { pattern: /^(?:chore|ci|build|deps?)(?:\(.*?\))?!?:/i, type: 'chore' },
  { pattern: /^(?:test|tests?)(?:\(.*?\))?!?:/i, type: 'test' },
  { pattern: /^(?:docs?|documentation)(?:\(.*?\))?!?:/i, type: 'docs' },
  { pattern: /^(?:refactor|perf|style)(?:\(.*?\))?!?:/i, type: 'chore' },
  // Keyword-in-title patterns (lower confidence)
  { pattern: /\b(?:fix(?:es|ed)?|bug|hotfix|patch)\b/i, type: 'bug_fix' },
  { pattern: /\b(?:migration|migrate|alter\s+table|add\s+column|drop\s+column)\b/i, type: 'migration' },
  { pattern: /\b(?:deploy(?:ment)?|release|ship|launch)\b/i, type: 'deployment' },
  { pattern: /\b(?:revert|rollback|undo)\b/i, type: 'rollback' },
  { pattern: /\b(?:security|vulnerability|cve-\d|xss|sqli|csrf)\b/i, type: 'security' },
  { pattern: /\b(?:incident|outage|postmortem|post-mortem)\b/i, type: 'incident' },
];

// ── File path signals (lowest priority) ──────────────────────────────────────

const FILE_PATTERNS: Array<{ pattern: RegExp; type: PrClassificationType }> = [
  { pattern: /prisma\/migrations\//i, type: 'migration' },
  { pattern: /\.sql$/i, type: 'migration' },
  { pattern: /\/__tests__\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$/i, type: 'test' },
  { pattern: /README|CHANGELOG|\.md$|docs?\//i, type: 'docs' },
  { pattern: /Dockerfile|docker-compose|\.github\/workflows\//i, type: 'deployment' },
  { pattern: /security|auth\/|middleware\//i, type: 'security' },
];

// ── Body keyword signals ─────────────────────────────────────────────────────

const BODY_BUG_PATTERNS = [
  /\bfix(?:es|ed)?\s+(?:a\s+)?bug\b/i,
  /\bbug\s+(?:fix|report|found)\b/i,
  /\bregression\b/i,
  /\bbroken\s+behavior\b/i,
  /\bcauses?\s+an?\s+error\b/i,
];

const BODY_SECURITY_PATTERNS = [
  /\bsecurity\s+(?:fix|patch|vulnerability|issue)\b/i,
  /\bCVE-\d/i,
  /\bXSS\b|\bSQL\s+injection\b|\bCSRF\b/i,
  /\bauthentication\s+bypass\b/i,
];

const BODY_MIGRATION_PATTERNS = [
  /\bprisma\s+migrate\b|\bprisma\s+migration\b/i,
  /\bALTER\s+TABLE\b|\bCREATE\s+TABLE\b|\bDROP\s+TABLE\b/i,
  /\bnew\s+(?:database\s+)?migration\b/i,
  /\bschema\s+change\b/i,
];

/**
 * Classify a PR deterministically from its metadata.
 * Priority: labels → title prefix → body → file paths.
 */
export function classifyPR(input: PrClassifierInput): PrClassification {
  const { title, body, labels, filesChanged } = input;
  const normTitle = title.trim().toLowerCase();
  const normLabels = labels.map((l) => l.trim().toLowerCase());

  // 1. Label match (highest confidence)
  for (const label of normLabels) {
    if (label in LABEL_MAP) {
      return {
        classification: LABEL_MAP[label],
        classificationSource: 'auto_label',
        confidence: 'high',
      };
    }
  }
  // Partial label match
  for (const [key, type] of Object.entries(LABEL_MAP)) {
    if (normLabels.some((l) => l.includes(key))) {
      return { classification: type, classificationSource: 'auto_label', confidence: 'high' };
    }
  }

  // 2. Title prefix (conventional commit) — high confidence for prefixed, medium for keyword
  for (let i = 0; i < TITLE_PATTERNS.length; i++) {
    const { pattern, type } = TITLE_PATTERNS[i];
    if (pattern.test(title)) {
      const isPrefix = i < 8; // first 8 are conventional-commit prefix patterns
      return {
        classification: type,
        classificationSource: 'auto_title',
        confidence: isPrefix ? 'high' : 'medium',
      };
    }
  }

  // 3. Body keywords
  if (body) {
    if (BODY_SECURITY_PATTERNS.some((p) => p.test(body))) {
      return { classification: 'security', classificationSource: 'auto_title', confidence: 'medium' };
    }
    if (BODY_MIGRATION_PATTERNS.some((p) => p.test(body))) {
      return { classification: 'migration', classificationSource: 'auto_title', confidence: 'medium' };
    }
    if (BODY_BUG_PATTERNS.some((p) => p.test(body))) {
      return { classification: 'bug_fix', classificationSource: 'auto_title', confidence: 'medium' };
    }
  }

  // 4. File path signals
  const filePaths = filesChanged.join('\n');
  for (const { pattern, type } of FILE_PATTERNS) {
    if (pattern.test(filePaths)) {
      return { classification: type, classificationSource: 'auto_files', confidence: 'low' };
    }
  }

  // 5. Default: treat as feature if title starts with non-conventional word
  const seemsLikeFeature = /^add |^implement |^introduce |^create |^enable |^support /i.test(normTitle);
  if (seemsLikeFeature) {
    return { classification: 'feature', classificationSource: 'auto_title', confidence: 'low' };
  }

  return { classification: 'chore', classificationSource: 'auto_title', confidence: 'low' };
}

/**
 * Infer bug state from classification, CI result, labels, and title.
 * Only meaningful when classification is 'bug_fix' or 'incident'.
 */
export function detectBugState(
  classification: PrClassificationType,
  ciStatus: string | null | undefined,
  labels: string[],
  title: string,
  state: string,
): BugState {
  const normLabels = labels.map((l) => l.toLowerCase());
  const normTitle = title.toLowerCase();

  // Explicit known-issue label
  if (normLabels.some((l) => l.includes('known-issue') || l === 'known issue' || l === 'wont-fix')) {
    return 'known_issue';
  }

  // Regression label
  if (normLabels.some((l) => l.includes('regression'))) {
    return 'regression_risk';
  }

  // Needs retest
  if (normLabels.some((l) => l.includes('needs-retest') || l.includes('needs retest'))) {
    return 'needs_retest';
  }

  // Merged bug fix with passing CI → fixed
  if (
    (classification === 'bug_fix' || classification === 'incident') &&
    state === 'merged' &&
    (ciStatus === 'success' || ciStatus === null)
  ) {
    return 'fixed';
  }

  // Merged bug fix with failed CI → regression_risk
  if (
    (classification === 'bug_fix' || classification === 'incident') &&
    state === 'merged' &&
    ciStatus === 'failure'
  ) {
    return 'regression_risk';
  }

  // Open bug fix → known_issue
  if (
    (classification === 'bug_fix' || classification === 'incident') &&
    state === 'open'
  ) {
    return 'known_issue';
  }

  // Regression keyword in title
  if (/regression|broke|broken|regress/i.test(normTitle)) {
    return 'regression_risk';
  }

  return null;
}

/**
 * Apply classification and bug state to a PR's stored fields.
 * Returns a plain object ready to spread into a Prisma update/create.
 */
export function buildClassificationFields(input: PrClassifierInput & { state: string }): {
  classification: string;
  classificationSource: string;
  bugState: string | null;
} {
  const result = classifyPR(input);
  const bugState = detectBugState(
    result.classification,
    input.ciStatus ?? null,
    input.labels,
    input.title,
    input.state,
  );
  return {
    classification: result.classification,
    classificationSource: result.classificationSource,
    bugState,
  };
}
