/**
 * Bug Intelligence — deterministic analysis of bug-related PRs.
 * No LLM required. Detects bug PRs, links cause→fix chains, and
 * infers bug state from CI, labels, and PR metadata.
 */

import type { TimelinePR } from './buildTimeline.js';

export type BugState = 'known_issue' | 'fixed' | 'regression_risk' | 'needs_retest';

export interface BugRecord {
  id: string;           // GithubPR.id of the bug-introducing or fixing PR
  prNumber: number;
  title: string;
  author: string | null;
  prUrl: string | null;
  state: 'open' | 'merged' | 'closed';
  bugState: BugState;
  ciStatus: string | null;
  labels: string[];
  githubMergedAt: Date | null;
  githubCreatedAt: Date | null;
  milestoneId: string | null;
  milestoneTitle: string | null;

  // Linked PRs (populated by linkBugs)
  causedByPrId: string | null;       // PR that likely introduced this bug
  fixedByPrId: string | null;        // PR that fixed this bug
  relatedPrIds: string[];             // Other related PRs (e.g., follow-up tests)

  // Risk signals
  riskArea: string | null;            // Inferred area (auth, payments, db, api, ...)
  hasTestsAdded: boolean;             // Fix PR added test files
  filesAffected: string[];
}

export interface BugSummary {
  total: number;
  open: number;
  fixed: number;
  regressionRisk: number;
  needsRetest: number;
  byArea: Record<string, number>;
}

// ── Area detection ─────────────────────────────────────────────────────────────

const AREA_PATTERNS: Array<{ area: string; patterns: RegExp[] }> = [
  { area: 'auth', patterns: [/auth|login|session|password|token|oauth/i] },
  { area: 'payments', patterns: [/payment|billing|stripe|checkout|invoice/i] },
  { area: 'database', patterns: [/database|migration|schema|prisma|sql/i] },
  { area: 'api', patterns: [/api|endpoint|route|webhook/i] },
  { area: 'ui', patterns: [/ui|component|page|layout|style|css/i] },
  { area: 'agents', patterns: [/agent|llm|prompt|embedding|rag/i] },
  { area: 'notifications', patterns: [/notification|email|alert/i] },
  { area: 'rbac', patterns: [/rbac|role|permission|access/i] },
  { area: 'ci', patterns: [/ci|build|workflow|action/i] },
];

function inferRiskArea(title: string, files: string[]): string | null {
  const text = (title + ' ' + files.join(' ')).toLowerCase();
  for (const { area, patterns } of AREA_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return area;
  }
  return null;
}

function hasTestFiles(filesChanged: string[]): boolean {
  return filesChanged.some((f) =>
    /\/__tests__\/|\.test\.[jt]sx?$|\.spec\.[jt]sx?$/.test(f),
  );
}

// ── Bug record builder ─────────────────────────────────────────────────────────

export function buildBugRecord(pr: TimelinePR): BugRecord | null {
  // Only build records for bug-relevant PRs
  if (
    pr.classification !== 'bug_fix' &&
    pr.classification !== 'incident' &&
    pr.bugState == null
  ) {
    return null;
  }

  const bugState: BugState = (pr.bugState as BugState | null) ?? inferDefaultBugState(pr);

  return {
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    author: pr.author,
    prUrl: pr.prUrl,
    state: pr.merged ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
    bugState,
    ciStatus: pr.ciStatus,
    labels: pr.labels,
    githubMergedAt: pr.githubMergedAt,
    githubCreatedAt: pr.githubCreatedAt,
    milestoneId: pr.milestoneId,
    milestoneTitle: pr.milestoneTitle ?? null,
    causedByPrId: null,
    fixedByPrId: null,
    relatedPrIds: [],
    riskArea: inferRiskArea(pr.title, []),
    hasTestsAdded: false,
    filesAffected: [],
  };
}

function inferDefaultBugState(pr: TimelinePR): BugState {
  if (pr.merged && (pr.ciStatus === 'success' || pr.ciStatus === null)) return 'fixed';
  if (pr.merged && pr.ciStatus === 'failure') return 'regression_risk';
  if (!pr.merged) return 'known_issue';
  return 'needs_retest';
}

/**
 * Extract all bug records from a flat list of PRs.
 */
export function extractBugs(prs: TimelinePR[]): BugRecord[] {
  return prs.flatMap((pr) => {
    const record = buildBugRecord(pr);
    return record ? [record] : [];
  });
}

// ── Link analysis ──────────────────────────────────────────────────────────────

const REVERT_PATTERNS = [
  /^revert:?\s+/i,
  /^rollback:?\s+/i,
  /reverts?\s+#(\d+)/i,
  /rolls?\s+back\s+#(\d+)/i,
];

const FIX_PATTERNS = [
  /fix(?:es|ed)?\s+#(\d+)/i,
  /closes?\s+#(\d+)/i,
  /resolves?\s+#(\d+)/i,
  /addresses?\s+#(\d+)/i,
];

/**
 * Extract a PR number reference from a title using given patterns.
 */
function extractPrRef(title: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const m = title.match(pattern);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Link bug records to their cause/fix PRs using title keyword heuristics.
 * Mutates the records in-place for efficiency.
 */
export function linkBugs(
  bugs: BugRecord[],
  allPrs: TimelinePR[],
): BugRecord[] {
  const prByNumber = new Map(allPrs.map((p) => [p.prNumber, p]));
  const bugById = new Map(bugs.map((b) => [b.id, b]));
  const bugByPrNumber = new Map(bugs.map((b) => [b.prNumber, b]));

  for (const bug of bugs) {
    const fixedRef = extractPrRef(bug.title, FIX_PATTERNS);
    if (fixedRef) {
      const fixPr = prByNumber.get(fixedRef);
      if (fixPr) {
        bug.causedByPrId = fixPr.id;
        // Also mark the original PR's fixedByPrId
        const causingBug = bugById.get(fixPr.id) ?? bugByPrNumber.get(fixPr.prNumber);
        if (causingBug) causingBug.fixedByPrId = bug.id;
      }
    }

    const revertRef = extractPrRef(bug.title, REVERT_PATTERNS.slice(2)); // only #-ref patterns
    if (revertRef) {
      const revertedPr = prByNumber.get(revertRef);
      if (revertedPr) bug.causedByPrId = revertedPr.id;
    }

    // Test-added detection (use filesChanged from allPrs)
    const sourcePr = prByNumber.get(bug.prNumber);
    if (sourcePr) {
      bug.hasTestsAdded = hasTestFiles(sourcePr.labels); // labels used as proxy — files not always available
    }
  }

  return bugs;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function computeBugSummary(bugs: BugRecord[]): BugSummary {
  const byArea: Record<string, number> = {};
  for (const bug of bugs) {
    if (bug.riskArea) {
      byArea[bug.riskArea] = (byArea[bug.riskArea] ?? 0) + 1;
    }
  }

  return {
    total: bugs.length,
    open: bugs.filter((b) => b.bugState === 'known_issue').length,
    fixed: bugs.filter((b) => b.bugState === 'fixed').length,
    regressionRisk: bugs.filter((b) => b.bugState === 'regression_risk').length,
    needsRetest: bugs.filter((b) => b.bugState === 'needs_retest').length,
    byArea,
  };
}

/**
 * Sort bug records: open/regression first, then by date descending.
 */
export function sortBugs(bugs: BugRecord[]): BugRecord[] {
  const priority: Record<BugState, number> = {
    regression_risk: 0,
    known_issue: 1,
    needs_retest: 2,
    fixed: 3,
  };
  return [...bugs].sort((a, b) => {
    const pa = priority[a.bugState] ?? 99;
    const pb = priority[b.bugState] ?? 99;
    if (pa !== pb) return pa - pb;
    const ta = (a.githubMergedAt ?? a.githubCreatedAt ?? new Date(0)).getTime();
    const tb = (b.githubMergedAt ?? b.githubCreatedAt ?? new Date(0)).getTime();
    return tb - ta; // newest first
  });
}
