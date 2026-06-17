import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { extractBugs, linkBugs, computeBugSummary, sortBugs } from '@/lib/bugIntelligence';
import type { TimelinePR } from '@/lib/buildTimeline';

export const dynamic = 'force-dynamic';

/**
 * GET /api/github-prs/bugs?projectId=...
 * Returns sorted bug records with summary stats.
 *
 * Query params:
 *   projectId  required
 *   bugState   known_issue|fixed|regression_risk|needs_retest (optional filter)
 *   area       auth|payments|database|api|ui|agents|... (optional filter)
 *   limit      max results (default 100, max 500)
 *   offset     pagination offset
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const bugStateFilter = searchParams.get('bugState') ?? undefined;
  const areaFilter = searchParams.get('area') ?? undefined;
  const limitRaw = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 100;
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  // Load bug-relevant PRs: classification is bug_fix/incident OR bugState is set
  const rawPRs = await prisma.githubPR.findMany({
    where: {
      projectId,
      OR: [
        { classification: 'bug_fix' },
        { classification: 'incident' },
        { bugState: { not: null } },
      ],
    },
    orderBy: [{ githubMergedAt: 'desc' }, { githubCreatedAt: 'desc' }],
    select: {
      id: true, prNumber: true, title: true, author: true, prUrl: true,
      state: true, merged: true, ciStatus: true, classification: true,
      bugState: true, labels: true, filesChangedCount: true,
      githubMergedAt: true, githubCreatedAt: true, milestoneId: true,
    },
  });

  // Load all PRs for link analysis (lightweight select)
  const allPRsForLinks = await prisma.githubPR.findMany({
    where: { projectId },
    select: {
      id: true, prNumber: true, title: true, author: true, prUrl: true,
      state: true, merged: true, ciStatus: true, classification: true,
      bugState: true, labels: true, filesChangedCount: true,
      githubMergedAt: true, githubCreatedAt: true, milestoneId: true,
    },
  });

  const toPR = (pr: typeof rawPRs[0]): TimelinePR => ({
    ...pr,
    classification: (pr.classification as TimelinePR['classification']) ?? 'unclassified',
    milestoneTitle: null,
  });

  const prs = rawPRs.map(toPR);
  const allPRs = allPRsForLinks.map(toPR);

  let bugs = extractBugs(prs);
  bugs = linkBugs(bugs, allPRs);
  bugs = sortBugs(bugs);

  const summary = computeBugSummary(bugs);

  // Apply optional filters
  if (bugStateFilter) bugs = bugs.filter((b) => b.bugState === bugStateFilter);
  if (areaFilter) bugs = bugs.filter((b) => b.riskArea === areaFilter);

  const total = bugs.length;
  const page = bugs.slice(offset, offset + limit);

  return NextResponse.json({ bugs: page, summary, total, limit, offset });
}
