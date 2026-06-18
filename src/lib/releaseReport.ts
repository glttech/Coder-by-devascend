/**
 * Release Intelligence Report — deterministic report generation.
 * Assembles merged PRs, bugs fixed, migrations, security changes,
 * risks, and pending items for a given date range / milestone / project.
 * No LLM required; all classification is based on existing PR fields.
 */

import { computeTimelineSummary, TimelinePR, TimelineClassification } from './buildTimeline';
import { extractBugs, computeBugSummary } from './bugIntelligence';

export interface ReportFilters {
  projectId?: string;
  milestoneId?: string;
  since?: Date;
  until?: Date;
}

export interface RiskItem {
  prNumber: number;
  prTitle: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PendingItem {
  prNumber: number;
  prTitle: string;
  type: 'open_bug' | 'regression_risk' | 'needs_retest' | 'migration_unverified';
}

export interface ReleaseReport {
  generatedAt: string;
  filters: ReportFilters;
  summary: {
    totalPRs: number;
    features: number;
    bugsFixed: number;
    securityChanges: number;
    migrations: number;
    incidents: number;
    openBugs: number;
    regressionRisks: number;
  };
  sections: {
    features: TimelinePR[];
    bugFixes: TimelinePR[];
    security: TimelinePR[];
    migrations: TimelinePR[];
    deployments: TimelinePR[];
    incidents: TimelinePR[];
    other: TimelinePR[];
  };
  risks: RiskItem[];
  pending: PendingItem[];
}

/** Classify PRs into report sections based on their classification field. */
export function buildReportSections(prs: TimelinePR[]): ReleaseReport['sections'] {
  const sections: ReleaseReport['sections'] = {
    features: [], bugFixes: [], security: [], migrations: [],
    deployments: [], incidents: [], other: [],
  };

  const SECTION_MAP: Partial<Record<TimelineClassification, keyof ReleaseReport['sections']>> = {
    feature:     'features',
    bug_fix:     'bugFixes',
    security:    'security',
    migration:   'migrations',
    deployment:  'deployments',
    incident:    'incidents',
  };

  for (const pr of prs) {
    const key = SECTION_MAP[pr.classification];
    if (key) {
      sections[key].push(pr);
    } else {
      sections.other.push(pr);
    }
  }

  return sections;
}

/** Derive risk items from PR metadata. */
export function buildRisks(prs: TimelinePR[]): RiskItem[] {
  const seen = new Set<number>();
  const risks: RiskItem[] = [];

  function addRisk(pr: TimelinePR, reason: string, severity: RiskItem['severity']) {
    if (seen.has(pr.prNumber)) return;
    seen.add(pr.prNumber);
    risks.push({ prNumber: pr.prNumber, prTitle: pr.title, reason, severity });
  }

  for (const pr of prs) {
    if (pr.bugState === 'regression_risk') {
      addRisk(pr, 'CI failed after merge — potential regression introduced', 'high');
    } else if (pr.classification === 'incident') {
      addRisk(pr, 'Incident fix merged — verify root cause is fully resolved', 'medium');
    } else if (pr.classification === 'security') {
      addRisk(pr, 'Security change — confirm no unintended permission regression', 'medium');
    } else if (pr.classification === 'migration') {
      addRisk(pr, 'Schema migration — ensure rollback plan and data backfill are verified', 'low');
    }
  }

  return risks;
}

/** Build list of pending smoke-test items. */
export function buildPending(prs: TimelinePR[]): PendingItem[] {
  const pending: PendingItem[] = [];

  for (const pr of prs) {
    if (pr.bugState === 'known_issue') {
      pending.push({ prNumber: pr.prNumber, prTitle: pr.title, type: 'open_bug' });
    } else if (pr.bugState === 'regression_risk') {
      pending.push({ prNumber: pr.prNumber, prTitle: pr.title, type: 'regression_risk' });
    } else if (pr.bugState === 'needs_retest') {
      pending.push({ prNumber: pr.prNumber, prTitle: pr.title, type: 'needs_retest' });
    } else if (pr.classification === 'migration' && pr.ciStatus !== 'success') {
      pending.push({ prNumber: pr.prNumber, prTitle: pr.title, type: 'migration_unverified' });
    }
  }

  return pending;
}

/** Assemble the full release report from a flat list of PRs. */
export function buildReleaseReport(prs: TimelinePR[], filters: ReportFilters): ReleaseReport {
  const summary = computeTimelineSummary(prs);
  const bugs = extractBugs(prs);
  const bugSummary = computeBugSummary(bugs);

  return {
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalPRs: summary.totalPRs,
      features: summary.totalFeatures,
      bugsFixed: summary.totalBugsFixed,
      securityChanges: summary.totalSecurity,
      migrations: summary.totalMigrations,
      incidents: summary.totalIncidents,
      openBugs: bugSummary.open,
      regressionRisks: bugSummary.regressionRisk,
    },
    sections: buildReportSections(prs),
    risks: buildRisks(prs),
    pending: buildPending(prs),
  };
}
