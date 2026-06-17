/**
 * Build Timeline grouping logic — pure functions, no DB calls.
 * Groups PRs into time buckets (week/day) and classification sections
 * so the timeline page can render product evolution clearly.
 */

export type TimelineGrouping = 'week' | 'day' | 'milestone';

export type TimelineClassification =
  | 'feature'
  | 'bug_fix'
  | 'security'
  | 'migration'
  | 'deployment'
  | 'rollback'
  | 'incident'
  | 'chore'
  | 'test'
  | 'docs'
  | 'unclassified';

export interface TimelinePR {
  id: string;
  prNumber: number;
  title: string;
  author: string | null;
  prUrl: string | null;
  state: string;
  merged: boolean;
  ciStatus: string | null;
  classification: TimelineClassification;
  bugState: string | null;
  labels: string[];
  filesChangedCount: number | null;
  githubMergedAt: Date | null;
  githubCreatedAt: Date | null;
  milestoneId: string | null;
  milestoneTitle?: string | null;
}

export interface TimelineSection {
  classification: TimelineClassification;
  label: string;
  prs: TimelinePR[];
}

export interface TimelineBucket {
  key: string;        // ISO week like "2026-W24" or "2026-06-17"
  label: string;      // Human readable: "Week of Jun 15–21, 2026"
  startDate: Date;
  endDate: Date;
  milestoneId?: string;
  milestoneTitle?: string;
  sections: TimelineSection[];
  prCount: number;
  featuresCount: number;
  bugsFixedCount: number;
  securityCount: number;
  migrationCount: number;
}

// Human-readable labels for each classification
export const CLASSIFICATION_LABELS: Record<TimelineClassification, string> = {
  feature:     'Features Added',
  bug_fix:     'Bugs Fixed',
  security:    'Security Changes',
  migration:   'Migrations',
  deployment:  'Deployments',
  rollback:    'Rollbacks',
  incident:    'Incidents',
  chore:       'Maintenance',
  test:        'Tests',
  docs:        'Documentation',
  unclassified: 'Other',
};

// Display order for sections within a bucket (most important first)
export const SECTION_ORDER: TimelineClassification[] = [
  'incident',
  'security',
  'bug_fix',
  'feature',
  'migration',
  'deployment',
  'rollback',
  'test',
  'chore',
  'docs',
  'unclassified',
];

/**
 * Get the Monday of the ISO week containing `date`.
 */
function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday (end) of the ISO week containing `date`.
 */
function weekEnd(date: Date): Date {
  const start = weekStart(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWeekLabel(start: Date, end: Date): string {
  const s = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const e = `${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `Week of ${s}–${e}, ${end.getUTCFullYear()}`;
}

function isoWeekKey(date: Date): string {
  const start = weekStart(date);
  const year = start.getUTCFullYear();
  // ISO week number
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekNum = Math.ceil(
    ((start.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function prDate(pr: TimelinePR): Date {
  return pr.githubMergedAt ?? pr.githubCreatedAt ?? new Date(0);
}

/**
 * Group a flat list of PRs into timeline buckets by week.
 * Returns buckets sorted newest-first.
 */
export function groupByWeek(prs: TimelinePR[]): TimelineBucket[] {
  const buckets = new Map<string, { start: Date; end: Date; prs: TimelinePR[] }>();

  for (const pr of prs) {
    const date = prDate(pr);
    if (date.getTime() === 0) continue; // skip undated
    const key = isoWeekKey(date);
    if (!buckets.has(key)) {
      buckets.set(key, { start: weekStart(date), end: weekEnd(date), prs: [] });
    }
    buckets.get(key)!.prs.push(pr);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b.localeCompare(a)) // newest week first
    .map(([key, { start, end, prs: weekPRs }]) =>
      buildBucket(key, formatWeekLabel(start, end), start, end, weekPRs),
    );
}

/**
 * Group a flat list of PRs into timeline buckets by day.
 * Returns buckets sorted newest-first.
 */
export function groupByDay(prs: TimelinePR[]): TimelineBucket[] {
  const buckets = new Map<string, { date: Date; prs: TimelinePR[] }>();

  for (const pr of prs) {
    const date = prDate(pr);
    if (date.getTime() === 0) continue;
    const key = dayKey(date);
    if (!buckets.has(key)) {
      buckets.set(key, { date, prs: [] });
    }
    buckets.get(key)!.prs.push(pr);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, { date, prs: dayPRs }]) => {
      const start = new Date(key + 'T00:00:00Z');
      const end = new Date(key + 'T23:59:59Z');
      return buildBucket(key, dayLabel(date), start, end, dayPRs);
    });
}

/**
 * Group a flat list of PRs into timeline buckets by milestone.
 * PRs without a milestone go into an "Unassigned" bucket.
 */
export function groupByMilestone(
  prs: TimelinePR[],
): TimelineBucket[] {
  const buckets = new Map<string, { label: string; prs: TimelinePR[] }>();

  for (const pr of prs) {
    const key = pr.milestoneId ?? 'unassigned';
    const label = pr.milestoneTitle ?? (pr.milestoneId ? pr.milestoneId : 'Unassigned');
    if (!buckets.has(key)) {
      buckets.set(key, { label, prs: [] });
    }
    buckets.get(key)!.prs.push(pr);
  }

  return [...buckets.entries()].map(([key, { label, prs: milestonePRs }]) => {
    const sorted = [...milestonePRs].sort(
      (a, b) => prDate(b).getTime() - prDate(a).getTime(),
    );
    const dates = sorted.map(prDate).filter((d) => d.getTime() > 0);
    const start = dates.length > 0 ? dates[dates.length - 1] : new Date(0);
    const end = dates.length > 0 ? dates[0] : new Date(0);
    return buildBucket(key, label, start, end, sorted);
  });
}

function buildBucket(
  key: string,
  label: string,
  startDate: Date,
  endDate: Date,
  prs: TimelinePR[],
): TimelineBucket {
  // Group PRs by classification within this bucket
  const byClass = new Map<TimelineClassification, TimelinePR[]>();
  for (const pr of prs) {
    const cls = pr.classification;
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls)!.push(pr);
  }

  // Build sections in display order, skip empty
  const sections: TimelineSection[] = SECTION_ORDER
    .filter((cls) => byClass.has(cls))
    .map((cls) => ({
      classification: cls,
      label: CLASSIFICATION_LABELS[cls],
      prs: byClass.get(cls)!,
    }));

  return {
    key,
    label,
    startDate,
    endDate,
    sections,
    prCount: prs.length,
    featuresCount: byClass.get('feature')?.length ?? 0,
    bugsFixedCount: (byClass.get('bug_fix') ?? []).filter((p) => p.bugState === 'fixed').length,
    securityCount: byClass.get('security')?.length ?? 0,
    migrationCount: byClass.get('migration')?.length ?? 0,
  };
}

/**
 * Dispatch to the correct grouping function based on the grouping parameter.
 */
export function groupPRs(prs: TimelinePR[], grouping: TimelineGrouping): TimelineBucket[] {
  if (grouping === 'day') return groupByDay(prs);
  if (grouping === 'milestone') return groupByMilestone(prs);
  return groupByWeek(prs);
}

/**
 * Summary stats across all buckets.
 */
export interface TimelineSummary {
  totalPRs: number;
  totalFeatures: number;
  totalBugsFixed: number;
  totalSecurity: number;
  totalMigrations: number;
  totalIncidents: number;
  openBugs: number;
  regressionRisks: number;
}

export function computeTimelineSummary(prs: TimelinePR[]): TimelineSummary {
  return {
    totalPRs: prs.length,
    totalFeatures: prs.filter((p) => p.classification === 'feature').length,
    totalBugsFixed: prs.filter((p) => p.classification === 'bug_fix' && p.bugState === 'fixed').length,
    totalSecurity: prs.filter((p) => p.classification === 'security').length,
    totalMigrations: prs.filter((p) => p.classification === 'migration').length,
    totalIncidents: prs.filter((p) => p.classification === 'incident').length,
    openBugs: prs.filter((p) => p.bugState === 'known_issue').length,
    regressionRisks: prs.filter((p) => p.bugState === 'regression_risk').length,
  };
}
