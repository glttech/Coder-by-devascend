/**
 * Reports Engine — generates founder/CTO reports from live repo data.
 *
 * All functions are pure and deterministic. No LLM calls. No fake metrics.
 * Uses only live data from the caller; empty states are clearly labelled.
 */

import {
  type PrPolicyResult,
  type PolicyVerdictCounts,
  VERDICT_META,
  APPROVER_LABEL,
  CATEGORY_LABEL,
  summarizePolicyVerdicts,
} from './prPolicyEngine';
import { type PrIntelligence, PRIORITY_META } from './prIntelligence';

// ── Shared data types the caller assembles from DB ───────────────────────────

export interface ReportPR {
  id: string;
  projectId: string;
  prNumber: number;
  title: string;
  ciStatus: string | null;
  state: string;
  merged: boolean;
  githubUpdatedAt: Date | null;
  githubMergedAt: Date | null;
  prUrl: string | null;
  filesChangedCount: number | null;
  intel: PrIntelligence;
  policy: PrPolicyResult;
  projectName: string;
  repoLabel: string; // "owner/repo" or project name
}

export interface ReportProject {
  id: string;
  name: string;
  repoOwner: string | null;
  repoName: string | null;
  openPRs: number;
  blockedPRs: number;
  needsReviewPRs: number;
  failedCIPRs: number;
  policyBlocked: number;
  policyReviewRequired: number;
  policyPass: number;
}

export interface ReportAgentRun {
  id: string;
  taskTitle: string;
  projectName: string;
  status: string;
  riskScore: number | null;
  startedAt: Date;
  endedAt: Date | null;
  modelUsed: string | null;
}

export interface ReportInput {
  prs: ReportPR[];
  projects: ReportProject[];
  agentRuns?: ReportAgentRun[];
  totalTasks?: number;
  openIncidents?: number;
  generatedAt?: Date;
  repoFilter?: string;
}

// ── Report output type ────────────────────────────────────────────────────────

export type ReportType =
  | 'weekly_founder_brief'
  | 'engineering_risk'
  | 'pr_governance'
  | 'repo_health'
  | 'merge_readiness'
  | 'agent_quality';

export interface ReportSection {
  title: string;
  markdown: string;
  isEmpty: boolean;
}

export interface GeneratedReport {
  type: ReportType;
  title: string;
  subtitle: string;
  generatedAt: Date;
  markdownContent: string;
  sections: ReportSection[];
  /** Prioritised list of actions for the founder/CTO */
  founderActionList: string[];
  /** One-paragraph summary in plain English */
  executiveSummary: string;
  /** Verdict counts for chart display */
  policyVerdicts: PolicyVerdictCounts;
  /** Counts for at-a-glance metrics */
  metrics: Record<string, number | string>;
  isEmpty: boolean;
}

// ── Markdown helpers ──────────────────────────────────────────────────────────

function mdHeading(level: 1 | 2 | 3, text: string): string {
  return `${'#'.repeat(level)} ${text}\n\n`;
}

function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_No data._\n\n';
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}\n\n`;
}

function mdBullet(items: string[]): string {
  if (items.length === 0) return '_None._\n\n';
  return items.map((i) => `- ${i}`).join('\n') + '\n\n';
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function policyBadge(verdict: PrPolicyResult['verdict']): string {
  const m = VERDICT_META[verdict];
  return m.label;
}

// ── Weekly Founder Brief ──────────────────────────────────────────────────────

function generateWeeklyFounderBrief(input: ReportInput, now: Date): GeneratedReport {
  const { prs, projects, agentRuns = [], openIncidents = 0 } = input;
  const openPRs = prs.filter((p) => p.state === 'open' && !p.merged);
  const blockedPRs = prs.filter((p) => p.policy.verdict === 'blocked');
  const reviewRequired = prs.filter((p) => p.policy.verdict === 'review_required');
  const passedPRs = prs.filter((p) => p.policy.verdict === 'pass');
  const failedCI = prs.filter((p) => p.ciStatus === 'failure');
  const mergedThisWeek = prs.filter(
    (p) =>
      p.merged &&
      p.githubMergedAt &&
      now.getTime() - p.githubMergedAt.getTime() < 7 * 24 * 60 * 60 * 1000,
  );

  const policyVerdicts = summarizePolicyVerdicts(prs.map((p) => p.policy));

  // Action list
  const actions: string[] = [];
  if (blockedPRs.length > 0) {
    actions.push(`Review and unblock ${blockedPRs.length} blocked PR${blockedPRs.length > 1 ? 's' : ''} — these cannot merge until you act.`);
  }
  if (failedCI.length > 0) {
    actions.push(`Fix CI failures on ${failedCI.length} PR${failedCI.length > 1 ? 's' : ''} — broken tests block the merge queue.`);
  }
  if (reviewRequired.length > 0) {
    actions.push(`Review ${reviewRequired.length} PR${reviewRequired.length > 1 ? 's' : ''} flagged for human review.`);
  }
  if (openIncidents > 0) {
    actions.push(`Resolve ${openIncidents} active incident${openIncidents > 1 ? 's' : ''}.`);
  }
  if (actions.length === 0) {
    actions.push('No urgent actions — all tracked PRs are policy-compliant and CI is green.');
  }

  // Executive summary
  const summaryParts: string[] = [];
  summaryParts.push(
    `As of ${fmtDate(now)}, there ${openPRs.length === 1 ? 'is' : 'are'} ${openPRs.length} open pull request${openPRs.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}.`,
  );
  if (blockedPRs.length > 0) {
    summaryParts.push(`${blockedPRs.length} PR${blockedPRs.length > 1 ? 's are' : ' is'} blocked by policy — these require your personal attention before they can merge.`);
  }
  if (failedCI.length > 0) {
    summaryParts.push(`${failedCI.length} PR${failedCI.length > 1 ? 's have' : ' has'} failing CI checks.`);
  }
  if (mergedThisWeek.length > 0) {
    summaryParts.push(`${mergedThisWeek.length} PR${mergedThisWeek.length > 1 ? 's were' : ' was'} merged this week.`);
  }
  if (passedPRs.length === openPRs.length && openPRs.length > 0) {
    summaryParts.push('All open PRs pass automated policy checks.');
  }
  const executiveSummary = summaryParts.join(' ');

  // Markdown sections
  let md = '';
  md += mdHeading(1, 'Weekly Founder Brief');
  md += `_Generated ${fmtTime(now)}_\n\n`;

  md += mdHeading(2, 'Executive Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Your Action List');
  md += mdBullet(actions);

  md += mdHeading(2, 'PR Overview');
  md += `| Metric | Count |\n| --- | --- |\n`;
  md += `| Open PRs | ${openPRs.length} |\n`;
  md += `| Blocked (policy) | ${blockedPRs.length} |\n`;
  md += `| Review Required | ${reviewRequired.length} |\n`;
  md += `| Policy Pass | ${passedPRs.length} |\n`;
  md += `| CI Failing | ${failedCI.length} |\n`;
  md += `| Merged This Week | ${mergedThisWeek.length} |\n\n`;

  md += mdHeading(2, 'Blocked PRs — Immediate Action Required');
  if (blockedPRs.length === 0) {
    md += '_No blocked PRs — all clear._\n\n';
  } else {
    md += mdTable(
      ['PR', 'Repo', 'Policy Violation', 'Required Approver', 'Next Action'],
      blockedPRs.slice(0, 10).map((p) => [
        `#${p.prNumber}`,
        truncate(p.repoLabel, 30),
        truncate(p.policy.reason, 50),
        APPROVER_LABEL[p.policy.requiredApprover],
        truncate(p.policy.recommendedNextAction, 60),
      ]),
    );
  }

  md += mdHeading(2, 'Review Required');
  if (reviewRequired.length === 0) {
    md += '_No PRs require review._\n\n';
  } else {
    md += mdTable(
      ['PR', 'Repo', 'Priority', 'Top Concern', 'Approver'],
      reviewRequired.slice(0, 10).map((p) => [
        `#${p.prNumber}`,
        truncate(p.repoLabel, 30),
        PRIORITY_META[p.intel.priority].label,
        truncate(p.policy.reason, 50),
        APPROVER_LABEL[p.policy.requiredApprover],
      ]),
    );
  }

  md += mdHeading(2, 'Merged This Week');
  if (mergedThisWeek.length === 0) {
    md += '_No PRs merged in the last 7 days._\n\n';
  } else {
    md += mdTable(
      ['PR', 'Repo', 'Merged', 'Policy'],
      mergedThisWeek.slice(0, 10).map((p) => [
        `#${p.prNumber}`,
        truncate(p.repoLabel, 30),
        fmtDate(p.githubMergedAt),
        policyBadge(p.policy.verdict),
      ]),
    );
  }

  const sections: ReportSection[] = [
    { title: 'Executive Summary', markdown: executiveSummary, isEmpty: !executiveSummary },
    { title: 'Action List', markdown: mdBullet(actions), isEmpty: actions.length === 0 },
    { title: 'Blocked PRs', markdown: blockedPRs.length === 0 ? '_None._' : `${blockedPRs.length} blocked`, isEmpty: blockedPRs.length === 0 },
    { title: 'Review Required', markdown: reviewRequired.length === 0 ? '_None._' : `${reviewRequired.length} need review`, isEmpty: reviewRequired.length === 0 },
    { title: 'Merged This Week', markdown: mergedThisWeek.length === 0 ? '_None._' : `${mergedThisWeek.length} merged`, isEmpty: mergedThisWeek.length === 0 },
  ];

  return {
    type: 'weekly_founder_brief',
    title: 'Weekly Founder Brief',
    subtitle: `${openPRs.length} open PRs · ${blockedPRs.length} blocked · ${mergedThisWeek.length} merged this week`,
    generatedAt: now,
    markdownContent: md,
    sections,
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      openPRs: openPRs.length,
      blocked: blockedPRs.length,
      reviewRequired: reviewRequired.length,
      failedCI: failedCI.length,
      mergedThisWeek: mergedThisWeek.length,
      projects: projects.length,
      openIncidents,
    },
    isEmpty: prs.length === 0 && projects.length === 0,
  };
}

// ── Engineering Risk Report ───────────────────────────────────────────────────

function generateEngineeringRisk(input: ReportInput, now: Date): GeneratedReport {
  const { prs, projects } = input;
  const openPRs = prs.filter((p) => p.state === 'open' && !p.merged);
  const blockedPRs = openPRs.filter((p) => p.policy.verdict === 'blocked');
  const criticalPRs = openPRs.filter((p) => p.intel.priority === 'critical');
  const highPRs = openPRs.filter((p) => p.intel.priority === 'high');
  const failedCI = openPRs.filter((p) => p.ciStatus === 'failure');

  // Group violations by category
  const violationsByCategory: Map<string, number> = new Map();
  for (const pr of openPRs) {
    for (const v of pr.policy.violatedPolicies) {
      const key = CATEGORY_LABEL[v.category];
      violationsByCategory.set(key, (violationsByCategory.get(key) ?? 0) + 1);
    }
  }
  const categoryRows = Array.from(violationsByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => [cat, String(count)]);

  const policyVerdicts = summarizePolicyVerdicts(openPRs.map((p) => p.policy));

  const actions: string[] = [];
  if (failedCI.length > 0) actions.push(`Fix failing CI on ${failedCI.length} PR${failedCI.length > 1 ? 's' : ''} immediately.`);
  if (blockedPRs.length > 0) actions.push(`Unblock ${blockedPRs.length} policy-blocked PR${blockedPRs.length > 1 ? 's' : ''}.`);
  if (criticalPRs.length > 0) actions.push(`Review ${criticalPRs.length} critical-priority PR${criticalPRs.length > 1 ? 's' : ''} touching sensitive areas.`);
  if (actions.length === 0) actions.push('No immediate engineering risks detected across tracked PRs.');

  const executiveSummary =
    openPRs.length === 0
      ? 'No open pull requests to assess.'
      : `Risk assessment across ${openPRs.length} open PR${openPRs.length > 1 ? 's' : ''}: ${blockedPRs.length} blocked by policy, ${criticalPRs.length + highPRs.length} high/critical priority, ${failedCI.length} with CI failures. ${policyVerdicts.pass} PR${policyVerdicts.pass !== 1 ? 's' : ''} pass all policy checks.`;

  let md = '';
  md += mdHeading(1, 'Engineering Risk Report');
  md += `_Generated ${fmtTime(now)}_\n\n`;
  md += mdHeading(2, 'Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Risk by Category');
  if (categoryRows.length === 0) {
    md += '_No policy violations on open PRs._\n\n';
  } else {
    md += mdTable(['Risk Category', 'Open PRs Affected'], categoryRows);
  }

  md += mdHeading(2, 'Top Risky PRs');
  const riskyPRs = [...openPRs].sort((a, b) => b.policy.policyScore - a.policy.policyScore).slice(0, 10);
  md += mdTable(
    ['PR', 'Repo', 'Score', 'Verdict', 'Severity', 'Primary Risk', 'CI'],
    riskyPRs.map((p) => [
      `#${p.prNumber}`,
      truncate(p.repoLabel, 28),
      String(p.policy.policyScore),
      policyBadge(p.policy.verdict),
      p.policy.severity,
      truncate(CATEGORY_LABEL[p.policy.topCategory], 28),
      p.ciStatus ?? '—',
    ]),
  );

  md += mdHeading(2, 'Failed CI');
  if (failedCI.length === 0) {
    md += '_No CI failures on open PRs._\n\n';
  } else {
    md += mdTable(
      ['PR', 'Repo', 'Title', 'Policy'],
      failedCI.slice(0, 10).map((p) => [
        `#${p.prNumber}`,
        truncate(p.repoLabel, 28),
        truncate(p.title, 50),
        policyBadge(p.policy.verdict),
      ]),
    );
  }

  md += mdHeading(2, 'Repo Risk Summary');
  md += mdTable(
    ['Repo', 'Open PRs', 'Blocked', 'Review Required', 'Pass', 'Failed CI'],
    projects.map((p) => [
      p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name,
      String(p.openPRs),
      String(p.policyBlocked),
      String(p.policyReviewRequired),
      String(p.policyPass),
      String(p.failedCIPRs),
    ]),
  );

  md += mdHeading(2, 'Action List');
  md += mdBullet(actions);

  return {
    type: 'engineering_risk',
    title: 'Engineering Risk Report',
    subtitle: `${blockedPRs.length} blocked · ${criticalPRs.length + highPRs.length} high/critical priority · ${failedCI.length} CI failures`,
    generatedAt: now,
    markdownContent: md,
    sections: [
      { title: 'Summary', markdown: executiveSummary, isEmpty: !executiveSummary },
      { title: 'Risk by Category', markdown: categoryRows.length === 0 ? '_None._' : String(categoryRows.length) + ' categories', isEmpty: categoryRows.length === 0 },
      { title: 'Top Risky PRs', markdown: `${riskyPRs.length} PRs`, isEmpty: riskyPRs.length === 0 },
    ],
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      openPRs: openPRs.length,
      blocked: blockedPRs.length,
      critical: criticalPRs.length,
      high: highPRs.length,
      failedCI: failedCI.length,
      policyPass: policyVerdicts.pass,
    },
    isEmpty: openPRs.length === 0,
  };
}

// ── PR Governance Report ──────────────────────────────────────────────────────

function generatePrGovernance(input: ReportInput, now: Date): GeneratedReport {
  const { prs } = input;
  const openPRs = prs.filter((p) => p.state === 'open' && !p.merged);
  const policyVerdicts = summarizePolicyVerdicts(openPRs.map((p) => p.policy));

  // Violations grouped by rule
  const ruleCount: Map<string, { name: string; count: number; verdict: string }> = new Map();
  for (const pr of openPRs) {
    for (const v of pr.policy.violatedPolicies) {
      const existing = ruleCount.get(v.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleCount.set(v.ruleId, { name: v.ruleName, count: 1, verdict: v.verdict });
      }
    }
  }
  const ruleRows = Array.from(ruleCount.values())
    .sort((a, b) => b.count - a.count)
    .map((r) => [r.name, String(r.count), r.verdict]);

  const actions: string[] = [];
  if (policyVerdicts.blocked > 0) {
    actions.push(`${policyVerdicts.blocked} PR${policyVerdicts.blocked > 1 ? 's are' : ' is'} blocked — review policy violations and approve or reject.`);
  }
  if (policyVerdicts.review_required > 0) {
    actions.push(`${policyVerdicts.review_required} PR${policyVerdicts.review_required > 1 ? 's need' : ' needs'} human review before merge.`);
  }
  if (actions.length === 0) actions.push('All tracked PRs pass governance checks.');

  const executiveSummary =
    openPRs.length === 0
      ? 'No open PRs to evaluate for governance.'
      : `Policy evaluation of ${openPRs.length} open PR${openPRs.length > 1 ? 's' : ''}: ${policyVerdicts.pass} pass, ${policyVerdicts.review_required} need review, ${policyVerdicts.blocked} are blocked. ${ruleCount.size} distinct policy rules triggered.`;

  let md = '';
  md += mdHeading(1, 'PR Governance Report');
  md += `_Generated ${fmtTime(now)}_\n\n`;
  md += mdHeading(2, 'Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Policy Verdicts');
  md += `| Verdict | Count |\n| --- | --- |\n| Pass | ${policyVerdicts.pass} |\n| Review Required | ${policyVerdicts.review_required} |\n| Blocked | ${policyVerdicts.blocked} |\n| Total | ${policyVerdicts.total} |\n\n`;

  md += mdHeading(2, 'Policy Rules Triggered (most frequent)');
  md += ruleRows.length === 0 ? '_No violations._\n\n' : mdTable(['Rule', 'PRs Affected', 'Verdict'], ruleRows);

  md += mdHeading(2, 'All Open PRs — Governance View');
  md += mdTable(
    ['PR', 'Repo', 'Title', 'Verdict', 'Score', 'Approver', 'CI'],
    openPRs.slice(0, 30).map((p) => [
      `#${p.prNumber}`,
      truncate(p.repoLabel, 24),
      truncate(p.title, 40),
      policyBadge(p.policy.verdict),
      String(p.policy.policyScore),
      APPROVER_LABEL[p.policy.requiredApprover],
      p.ciStatus ?? '—',
    ]),
  );

  md += mdHeading(2, 'Founder Action List');
  md += mdBullet(actions);

  return {
    type: 'pr_governance',
    title: 'PR Governance Report',
    subtitle: `${policyVerdicts.pass} pass · ${policyVerdicts.review_required} review · ${policyVerdicts.blocked} blocked`,
    generatedAt: now,
    markdownContent: md,
    sections: [
      { title: 'Summary', markdown: executiveSummary, isEmpty: !executiveSummary },
      { title: 'Policy Verdicts', markdown: JSON.stringify(policyVerdicts), isEmpty: policyVerdicts.total === 0 },
      { title: 'All PRs', markdown: `${openPRs.length} PRs`, isEmpty: openPRs.length === 0 },
    ],
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      total: openPRs.length,
      pass: policyVerdicts.pass,
      reviewRequired: policyVerdicts.review_required,
      blocked: policyVerdicts.blocked,
      rulesTriggered: ruleCount.size,
    },
    isEmpty: openPRs.length === 0,
  };
}

// ── Repo Health Report ────────────────────────────────────────────────────────

function generateRepoHealth(input: ReportInput, now: Date): GeneratedReport {
  const { projects, prs } = input;

  const actions: string[] = [];
  for (const p of projects) {
    if (p.policyBlocked > 0) {
      const label = p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name;
      actions.push(`${label}: ${p.policyBlocked} PR${p.policyBlocked > 1 ? 's' : ''} blocked by policy.`);
    }
  }
  for (const p of projects) {
    if (p.failedCIPRs > 0) {
      const label = p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name;
      actions.push(`${label}: ${p.failedCIPRs} PR${p.failedCIPRs > 1 ? 's' : ''} with CI failures.`);
    }
  }
  if (actions.length === 0) actions.push('All repos are healthy — no blocked PRs or CI failures.');

  const unhealthyCount = projects.filter((p) => p.policyBlocked > 0 || p.failedCIPRs > 0).length;
  const executiveSummary =
    projects.length === 0
      ? 'No projects imported yet.'
      : `${projects.length} repo${projects.length > 1 ? 's' : ''} tracked. ${unhealthyCount} ${unhealthyCount === 1 ? 'has' : 'have'} blocked PRs or CI failures. ${projects.length - unhealthyCount} ${projects.length - unhealthyCount === 1 ? 'is' : 'are'} healthy.`;

  const policyVerdicts = summarizePolicyVerdicts(prs.map((p) => p.policy));

  let md = '';
  md += mdHeading(1, 'Repo Health Report');
  md += `_Generated ${fmtTime(now)}_\n\n`;
  md += mdHeading(2, 'Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Per-Repo Status');
  md += projects.length === 0
    ? '_No projects._\n\n'
    : mdTable(
        ['Repo', 'Open PRs', 'Blocked', 'Review Required', 'Pass', 'Failed CI', 'Health'],
        projects.map((p) => {
          const label = p.repoOwner && p.repoName ? `${p.repoOwner}/${p.repoName}` : p.name;
          const health = p.policyBlocked > 0 || p.failedCIPRs > 0 ? 'Unhealthy' : p.policyReviewRequired > 0 ? 'Caution' : 'Healthy';
          return [label, String(p.openPRs), String(p.policyBlocked), String(p.policyReviewRequired), String(p.policyPass), String(p.failedCIPRs), health];
        }),
      );

  md += mdHeading(2, 'Action List');
  md += mdBullet(actions);

  return {
    type: 'repo_health',
    title: 'Repo Health Report',
    subtitle: `${projects.length} repos · ${unhealthyCount} unhealthy`,
    generatedAt: now,
    markdownContent: md,
    sections: [
      { title: 'Summary', markdown: executiveSummary, isEmpty: !executiveSummary },
      { title: 'Per-Repo Status', markdown: `${projects.length} repos`, isEmpty: projects.length === 0 },
    ],
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      repos: projects.length,
      healthy: projects.length - unhealthyCount,
      unhealthy: unhealthyCount,
      totalOpenPRs: projects.reduce((sum, p) => sum + p.openPRs, 0),
    },
    isEmpty: projects.length === 0,
  };
}

// ── Merge Readiness Report ────────────────────────────────────────────────────

function generateMergeReadiness(input: ReportInput, now: Date): GeneratedReport {
  const { prs } = input;
  const openPRs = prs.filter((p) => p.state === 'open' && !p.merged);
  const readyToMerge = openPRs.filter((p) => p.policy.mergeRecommendation === 'safe_to_merge' && p.intel.mergeReadiness.ready);
  const reviewFirst = openPRs.filter((p) => p.policy.mergeRecommendation === 'review_first');
  const doNotMerge = openPRs.filter((p) => p.policy.mergeRecommendation === 'do_not_merge');
  const policyVerdicts = summarizePolicyVerdicts(openPRs.map((p) => p.policy));

  const actions: string[] = [];
  if (doNotMerge.length > 0) actions.push(`Block ${doNotMerge.length} PR${doNotMerge.length > 1 ? 's' : ''} from merging until blockers are resolved.`);
  if (reviewFirst.length > 0) actions.push(`Get ${reviewFirst.length} PR${reviewFirst.length > 1 ? 's' : ''} reviewed before merging.`);
  if (readyToMerge.length > 0) actions.push(`${readyToMerge.length} PR${readyToMerge.length > 1 ? 's are' : ' is'} ready to merge — approve when you're ready.`);
  if (actions.length === 0) actions.push('No open PRs to assess for merge readiness.');

  const executiveSummary =
    openPRs.length === 0
      ? 'No open PRs to assess for merge readiness.'
      : `${openPRs.length} open PR${openPRs.length > 1 ? 's' : ''}: ${readyToMerge.length} ready to merge, ${reviewFirst.length} need review first, ${doNotMerge.length} must not merge yet.`;

  let md = '';
  md += mdHeading(1, 'Merge Readiness Report');
  md += `_Generated ${fmtTime(now)}_\n\n`;
  md += mdHeading(2, 'Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Ready to Merge');
  md += readyToMerge.length === 0
    ? '_No PRs are fully ready to merge._\n\n'
    : mdTable(
        ['PR', 'Repo', 'Title', 'Priority', 'CI'],
        readyToMerge.slice(0, 10).map((p) => [
          `#${p.prNumber}`,
          truncate(p.repoLabel, 28),
          truncate(p.title, 48),
          PRIORITY_META[p.intel.priority].label,
          p.ciStatus ?? '—',
        ]),
      );

  md += mdHeading(2, 'Review First');
  md += reviewFirst.length === 0
    ? '_None._\n\n'
    : mdTable(
        ['PR', 'Repo', 'Title', 'Top Policy Concern', 'Approver'],
        reviewFirst.slice(0, 10).map((p) => [
          `#${p.prNumber}`,
          truncate(p.repoLabel, 28),
          truncate(p.title, 40),
          truncate(p.policy.reason, 48),
          APPROVER_LABEL[p.policy.requiredApprover],
        ]),
      );

  md += mdHeading(2, 'Do Not Merge');
  md += doNotMerge.length === 0
    ? '_None blocked._\n\n'
    : mdTable(
        ['PR', 'Repo', 'Title', 'Blocking Policy', 'Approver'],
        doNotMerge.slice(0, 10).map((p) => [
          `#${p.prNumber}`,
          truncate(p.repoLabel, 28),
          truncate(p.title, 40),
          truncate(p.policy.reason, 48),
          APPROVER_LABEL[p.policy.requiredApprover],
        ]),
      );

  md += mdHeading(2, 'Action List');
  md += mdBullet(actions);

  return {
    type: 'merge_readiness',
    title: 'Merge Readiness Report',
    subtitle: `${readyToMerge.length} ready · ${reviewFirst.length} review first · ${doNotMerge.length} blocked`,
    generatedAt: now,
    markdownContent: md,
    sections: [
      { title: 'Ready to Merge', markdown: `${readyToMerge.length} PRs`, isEmpty: readyToMerge.length === 0 },
      { title: 'Review First', markdown: `${reviewFirst.length} PRs`, isEmpty: reviewFirst.length === 0 },
      { title: 'Do Not Merge', markdown: `${doNotMerge.length} PRs`, isEmpty: doNotMerge.length === 0 },
    ],
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      openPRs: openPRs.length,
      readyToMerge: readyToMerge.length,
      reviewFirst: reviewFirst.length,
      doNotMerge: doNotMerge.length,
    },
    isEmpty: openPRs.length === 0,
  };
}

// ── Agent Quality Report ──────────────────────────────────────────────────────

function generateAgentQuality(input: ReportInput, now: Date): GeneratedReport {
  const { agentRuns = [], totalTasks = 0 } = input;
  const policyVerdicts = summarizePolicyVerdicts(input.prs.map((p) => p.policy));

  const succeeded = agentRuns.filter((r) => r.status === 'succeeded');
  const failed = agentRuns.filter((r) => r.status === 'failed');
  const avgRisk = agentRuns.length > 0
    ? agentRuns.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / agentRuns.length
    : 0;

  const executiveSummary =
    agentRuns.length === 0
      ? 'No agent runs recorded yet. Agent quality data will appear here once Claude sessions are tracked.'
      : `${agentRuns.length} agent run${agentRuns.length > 1 ? 's' : ''} recorded: ${succeeded.length} succeeded, ${failed.length} failed. Average risk score: ${avgRisk.toFixed(1)}/100.`;

  const actions: string[] = [];
  if (failed.length > 0) actions.push(`Investigate ${failed.length} failed agent run${failed.length > 1 ? 's' : ''}.`);
  if (avgRisk > 60) actions.push(`Average agent risk score (${avgRisk.toFixed(0)}/100) is elevated — review recent runs.`);
  if (actions.length === 0) actions.push('Agent runs are performing within acceptable risk parameters.');

  let md = '';
  md += mdHeading(1, 'Agent / Session Quality Report');
  md += `_Generated ${fmtTime(now)}_\n\n`;
  md += mdHeading(2, 'Summary');
  md += executiveSummary + '\n\n';

  md += mdHeading(2, 'Run Overview');
  md += `| Metric | Count |\n| --- | --- |\n| Total Runs | ${agentRuns.length} |\n| Succeeded | ${succeeded.length} |\n| Failed | ${failed.length} |\n| Avg Risk Score | ${avgRisk.toFixed(1)}/100 |\n| Total Tasks | ${totalTasks} |\n\n`;

  if (agentRuns.length > 0) {
    md += mdHeading(2, 'Recent Agent Runs');
    md += mdTable(
      ['Task', 'Project', 'Status', 'Risk', 'Model', 'Started'],
      agentRuns.slice(0, 10).map((r) => [
        truncate(r.taskTitle, 40),
        truncate(r.projectName, 24),
        r.status,
        r.riskScore != null ? `${r.riskScore.toFixed(0)}/100` : '—',
        r.modelUsed ?? '—',
        fmtTime(r.startedAt),
      ]),
    );
  }

  md += mdHeading(2, 'Action List');
  md += mdBullet(actions);

  return {
    type: 'agent_quality',
    title: 'Agent / Session Quality Report',
    subtitle: agentRuns.length === 0 ? 'No sessions recorded' : `${agentRuns.length} runs · ${succeeded.length} succeeded · ${failed.length} failed`,
    generatedAt: now,
    markdownContent: md,
    sections: [
      { title: 'Summary', markdown: executiveSummary, isEmpty: !executiveSummary },
      { title: 'Recent Runs', markdown: `${agentRuns.length} runs`, isEmpty: agentRuns.length === 0 },
    ],
    founderActionList: actions,
    executiveSummary,
    policyVerdicts,
    metrics: {
      totalRuns: agentRuns.length,
      succeeded: succeeded.length,
      failed: failed.length,
      avgRisk: parseFloat(avgRisk.toFixed(1)),
      totalTasks,
    },
    isEmpty: agentRuns.length === 0,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function generateReport(
  type: ReportType,
  input: ReportInput,
): GeneratedReport {
  const now = input.generatedAt ?? new Date();
  switch (type) {
    case 'weekly_founder_brief':
      return generateWeeklyFounderBrief(input, now);
    case 'engineering_risk':
      return generateEngineeringRisk(input, now);
    case 'pr_governance':
      return generatePrGovernance(input, now);
    case 'repo_health':
      return generateRepoHealth(input, now);
    case 'merge_readiness':
      return generateMergeReadiness(input, now);
    case 'agent_quality':
      return generateAgentQuality(input, now);
  }
}

export const REPORT_TYPE_META: Record<ReportType, { label: string; description: string; icon: string }> = {
  weekly_founder_brief: {
    label: 'Weekly Founder Brief',
    description: 'Top-line status, your action list, blocked PRs, and what merged this week.',
    icon: '◈',
  },
  engineering_risk: {
    label: 'Engineering Risk Report',
    description: 'Risk breakdown by category, top risky PRs, CI failures, and repo risk summary.',
    icon: '⚑',
  },
  pr_governance: {
    label: 'PR Governance Report',
    description: 'Full policy verdict for every open PR, rules triggered, approvers required.',
    icon: '◉',
  },
  repo_health: {
    label: 'Repo Health Report',
    description: 'Per-repo health status, blocked counts, CI state, and policy pass rate.',
    icon: '⬟',
  },
  merge_readiness: {
    label: 'Merge Readiness Report',
    description: 'Which PRs are safe to merge, which need review, and which are blocked.',
    icon: '◑',
  },
  agent_quality: {
    label: 'Agent / Session Quality',
    description: 'Claude session outcomes, risk scores, success rates, and model usage.',
    icon: '◭',
  },
};
