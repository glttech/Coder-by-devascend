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
