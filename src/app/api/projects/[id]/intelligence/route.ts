import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/:id/intelligence
 * Repository intelligence aggregate: PR stats, classification breakdown,
 * sync state, and recent PR activity.
 * Auth: any authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, repoOwner: true, repoName: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const [
    totalPRs,
    mergedPRs,
    openPRs,
    failedCIPRs,
    regressionRisks,
    syncState,
    recentPRs,
    classificationRows,
    incidentCount,
    agentRunCount,
  ] = await Promise.all([
    prisma.githubPR.count({ where: { projectId: params.id } }),
    prisma.githubPR.count({ where: { projectId: params.id, merged: true } }),
    prisma.githubPR.count({ where: { projectId: params.id, state: 'open' } }),
    prisma.githubPR.count({ where: { projectId: params.id, ciStatus: 'failure' } }),
    prisma.githubPR.count({ where: { projectId: params.id, bugState: 'regression_risk' } }),
    prisma.prSyncState.findUnique({ where: { projectId: params.id } }),
    prisma.githubPR.findMany({
      where: { projectId: params.id },
      orderBy: [{ githubUpdatedAt: 'desc' }, { importedAt: 'desc' }],
      take: 15,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        classification: true,
        bugState: true,
        author: true,
        prUrl: true,
        githubMergedAt: true,
        githubCreatedAt: true,
        githubUpdatedAt: true,
      },
    }),
    prisma.githubPR.groupBy({
      by: ['classification'],
      where: { projectId: params.id },
      _count: { _all: true },
    }),
    prisma.incident.count({
      where: { task: { projectId: params.id } },
    }),
    prisma.agentRun.count({
      where: { task: { projectId: params.id } },
    }),
  ]);

  const recentActivity = recentPRs.map((pr) => ({
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    state: pr.state,
    merged: pr.merged,
    ciStatus: pr.ciStatus ?? null,
    classification: pr.classification ?? 'unclassified',
    bugState: pr.bugState ?? null,
    author: pr.author ?? null,
    prUrl: pr.prUrl ?? null,
    githubMergedAt: pr.githubMergedAt?.toISOString() ?? null,
    githubCreatedAt: pr.githubCreatedAt?.toISOString() ?? null,
    githubUpdatedAt: pr.githubUpdatedAt?.toISOString() ?? null,
  }));

  const breakdown = classificationRows.map((r) => ({
    classification: r.classification ?? 'unclassified',
    count: r._count._all,
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
    repoOwner: project.repoOwner ?? null,
    repoName: project.repoName ?? null,
    summary: {
      totalPRs,
      mergedPRs,
      openPRs,
      failedCIPRs,
      regressionRisks,
      incidentCount,
      agentRunCount,
    },
    syncState: {
      status: syncState?.syncStatus ?? 'idle',
      lastSyncedAt: syncState?.lastSyncedAt?.toISOString() ?? null,
      totalSynced: syncState?.totalSynced ?? 0,
      errorMessage: syncState?.errorMessage ?? null,
    },
    classificationBreakdown: breakdown,
    recentActivity,
  });
}
