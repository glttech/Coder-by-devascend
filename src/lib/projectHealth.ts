import { summarisePR } from './prSummary';

export interface PRHealthInput {
  title: string;
  body: string | null;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  importedAt: Date;
  updatedAt: Date;
}

export interface PRHealthInputWithId extends PRHealthInput {
  id: string;
  prNumber: number;
}

export interface StalePR {
  id: string;
  prNumber: number;
  title: string;
  daysSinceRefresh: number;
}

export interface ProjectHealth {
  total: number;
  mergedCount: number;
  openCount: number;
  failedCICount: number;
  pendingCICount: number;
  highRiskCount: number;
  staleCount: number;
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Compute project health metrics from an array of imported PR records.
 * Pure function — no DB or network calls.
 */
export function computeProjectHealth(prs: PRHealthInput[], now: Date = new Date()): ProjectHealth {
  let mergedCount = 0;
  let openCount = 0;
  let failedCICount = 0;
  let pendingCICount = 0;
  let highRiskCount = 0;
  let staleCount = 0;

  for (const pr of prs) {
    if (pr.merged) mergedCount++;
    if (pr.state === 'open' && !pr.merged) openCount++;
    if (pr.ciStatus === 'failure') failedCICount++;
    if (pr.ciStatus === 'pending' || pr.ciStatus === null) pendingCICount++;

    const summary = summarisePR(pr.title, pr.body);
    if (summary.riskLevel === 'high') highRiskCount++;

    // Stale: open, unmerged, and last activity > 7 days ago
    if (!pr.merged && pr.state === 'open') {
      const lastActivity = pr.updatedAt > pr.importedAt ? pr.updatedAt : pr.importedAt;
      if (now.getTime() - lastActivity.getTime() > STALE_MS) staleCount++;
    }
  }

  return { total: prs.length, mergedCount, openCount, failedCICount, pendingCICount, highRiskCount, staleCount };
}

export interface CISummary {
  failed: number;
  pending: number;
  unknown: number;
  success: number;
  total: number;
}

/**
 * Compute a per-status CI breakdown from a list of PR CI statuses.
 * Pure function — no DB or network calls.
 */
export function computeCISummary(prs: { ciStatus: string | null }[]): CISummary {
  let failed = 0, pending = 0, unknown = 0, success = 0;
  for (const { ciStatus } of prs) {
    if (ciStatus === 'failure') failed++;
    else if (ciStatus === 'pending') pending++;
    else if (ciStatus === null) unknown++;
    else if (ciStatus === 'success') success++;
  }
  return { failed, pending, unknown, success, total: prs.length };
}

/**
 * Overall health signal derived from the computed metrics.
 *
 * critical — CI failures, multiple high-risk PRs, severe staleness (3+), or combined
 *            signals (any high-risk alongside stale or pending evidence).
 * warning  — a single high-risk PR, or minor stale/pending evidence in isolation.
 * clear    — no actionable issues.
 */
export function healthSignal(h: ProjectHealth): 'critical' | 'warning' | 'clear' {
  if (h.failedCICount > 0) return 'critical';
  if (h.highRiskCount > 1) return 'critical';
  if (h.staleCount >= 3) return 'critical';
  if (h.highRiskCount > 0 && (h.staleCount > 0 || h.pendingCICount > 0)) return 'critical';

  if (h.highRiskCount === 1 || h.staleCount > 0 || h.pendingCICount > 0) return 'warning';

  return 'clear';
}

export interface PRHealthInputFull extends PRHealthInputWithId {
  githubMergedAt: Date | null;
}

export interface RecentMergedPR {
  id: string;
  prNumber: number;
  title: string;
  githubMergedAt: Date | null;
}

export interface ReleaseReadiness {
  signal: 'ready' | 'caution' | 'blocked';
  suggestedAction: string;
  recentMergedPRs: RecentMergedPR[];
  failedCICount: number;
  pendingCICount: number;
  staleCount: number;
  highRiskCount: number;
}

/**
 * Compute a release readiness snapshot from imported PR evidence.
 * Pure function — no DB or network calls.
 */
export function computeReleaseReadiness(
  prs: PRHealthInputFull[],
  now: Date = new Date(),
  recentLimit = 5,
): ReleaseReadiness {
  const h = computeProjectHealth(prs, now);

  let signal: 'ready' | 'caution' | 'blocked';
  let suggestedAction: string;

  if (h.failedCICount > 0 || h.highRiskCount > 1) {
    signal = 'blocked';
    const parts: string[] = [];
    if (h.failedCICount > 0) parts.push(`${h.failedCICount} CI failure${h.failedCICount > 1 ? 's' : ''}`);
    if (h.highRiskCount > 1) parts.push(`${h.highRiskCount} high-risk PRs`);
    suggestedAction = `Resolve ${parts.join(' and ')} before releasing.`;
  } else if (h.highRiskCount === 1 || h.staleCount > 0 || h.pendingCICount > 0) {
    signal = 'caution';
    const parts: string[] = [];
    if (h.highRiskCount === 1) parts.push('1 high-risk PR');
    if (h.staleCount > 0) parts.push(`${h.staleCount} stale PR${h.staleCount > 1 ? 's' : ''}`);
    if (h.pendingCICount > 0) parts.push(`${h.pendingCICount} pending CI result${h.pendingCICount > 1 ? 's' : ''}`);
    suggestedAction = `Review ${parts.join(', ')} before releasing.`;
  } else {
    signal = 'ready';
    suggestedAction = 'All checks clear — safe to release.';
  }

  const recentMergedPRs = prs
    .filter((pr) => pr.merged)
    .sort((a, b) => {
      const at = a.githubMergedAt?.getTime() ?? 0;
      const bt = b.githubMergedAt?.getTime() ?? 0;
      return bt !== at ? bt - at : b.prNumber - a.prNumber;
    })
    .slice(0, recentLimit)
    .map((pr) => ({ id: pr.id, prNumber: pr.prNumber, title: pr.title, githubMergedAt: pr.githubMergedAt }));

  return {
    signal,
    suggestedAction,
    recentMergedPRs,
    failedCICount: h.failedCICount,
    pendingCICount: h.pendingCICount,
    staleCount: h.staleCount,
    highRiskCount: h.highRiskCount,
  };
}

/**
 * Return open PRs that have not been refreshed in 7+ days, sorted oldest-first.
 * Pure function — no DB or network calls.
 */
export function computeStalePRs(prs: PRHealthInputWithId[], now: Date = new Date()): StalePR[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return prs
    .filter((pr) => !pr.merged && pr.state === 'open')
    .filter((pr) => {
      const lastActivity = pr.updatedAt > pr.importedAt ? pr.updatedAt : pr.importedAt;
      return now.getTime() - lastActivity.getTime() > STALE_MS;
    })
    .map((pr) => {
      const lastActivity = pr.updatedAt > pr.importedAt ? pr.updatedAt : pr.importedAt;
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        title: pr.title,
        daysSinceRefresh: Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS),
      };
    })
    .sort((a, b) => b.daysSinceRefresh - a.daysSinceRefresh);
}
