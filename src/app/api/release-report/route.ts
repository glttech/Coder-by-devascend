import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { buildReleaseReport, ReportFilters } from '@/lib/releaseReport';
import { TimelinePR, TimelineClassification } from '@/lib/buildTimeline';

export const dynamic = 'force-dynamic';

const VALID_CLASSIFICATIONS = new Set<TimelineClassification>([
  'feature', 'bug_fix', 'security', 'migration', 'deployment',
  'rollback', 'incident', 'chore', 'test', 'docs', 'unclassified',
]);

function toClassification(v: string | null): TimelineClassification {
  return v && VALID_CLASSIFICATIONS.has(v as TimelineClassification)
    ? (v as TimelineClassification)
    : 'unclassified';
}

/**
 * GET /api/release-report
 * Generate a release intelligence report for merged PRs.
 * Query params: projectId?, milestoneId?, since?, until?
 * Auth: any authenticated user (read-only).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const projectId   = searchParams.get('projectId')   ?? undefined;
  const milestoneId = searchParams.get('milestoneId') ?? undefined;
  const sinceRaw    = searchParams.get('since')       ?? undefined;
  const untilRaw    = searchParams.get('until')       ?? undefined;

  const since = sinceRaw ? new Date(sinceRaw) : undefined;
  const until = untilRaw ? new Date(untilRaw) : undefined;

  if (since && isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid since date' }, { status: 422 });
  }
  if (until && isNaN(until.getTime())) {
    return NextResponse.json({ error: 'Invalid until date' }, { status: 422 });
  }

  const where: Record<string, unknown> = { state: 'closed' };
  if (projectId)   where['projectId']   = projectId;
  if (milestoneId) where['milestoneId'] = milestoneId;
  if (since || until) {
    const dateFilter: Record<string, Date> = {};
    if (since) dateFilter['gte'] = since;
    if (until) dateFilter['lte'] = until;
    where['githubMergedAt'] = dateFilter;
  }

  const rawPRs = await prisma.githubPR.findMany({
    where,
    orderBy: { githubMergedAt: 'desc' },
    take: 500,
  });

  const prs: TimelinePR[] = rawPRs.map((pr) => ({
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    author: pr.author ?? null,
    prUrl: null,
    state: pr.state,
    merged: !!pr.githubMergedAt,
    ciStatus: pr.ciStatus ?? null,
    classification: toClassification(pr.classification ?? null),
    bugState: pr.bugState ?? null,
    labels: [],
    filesChangedCount: null,
    githubMergedAt: pr.githubMergedAt ?? null,
    githubCreatedAt: pr.githubCreatedAt ?? null,
    milestoneId: pr.milestoneId ?? null,
  }));

  const filters: ReportFilters = { projectId, milestoneId, since, until };
  const report = buildReleaseReport(prs, filters);

  return NextResponse.json(report);
}
