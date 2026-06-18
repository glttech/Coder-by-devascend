import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET /api/github-prs/memory
 * Search the PR memory index with optional filters.
 *
 * Query params:
 *   projectId      required
 *   q              full-text search against title + body (case-insensitive)
 *   classification feature|bug_fix|security|migration|deployment|rollback|incident|chore|test|docs
 *   bugState       known_issue|fixed|regression_risk|needs_retest
 *   author         GitHub username
 *   since          ISO date — merged or created after
 *   until          ISO date — merged or created before
 *   dateField      "merged" (default) | "created" | "imported"
 *   limit          max results (default 50, max 200)
 *   offset         pagination offset
 *
 * Returns: { prs: GithubPR[], total: number }
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

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const q = searchParams.get('q')?.trim() ?? '';
  const classification = searchParams.get('classification') ?? undefined;
  const bugState = searchParams.get('bugState') ?? undefined;
  const author = searchParams.get('author')?.trim() ?? undefined;
  const since = searchParams.get('since') ?? undefined;
  const until = searchParams.get('until') ?? undefined;
  const dateField = (searchParams.get('dateField') ?? 'merged') as 'merged' | 'created' | 'imported';

  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50;
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  // Build where clause
  type DateFilter = { gte?: Date; lte?: Date };
  const dateFilter: DateFilter = {};
  if (since) { try { dateFilter.gte = new Date(since); } catch { /* ignore bad date */ } }
  if (until) { try { dateFilter.lte = new Date(until); } catch { /* ignore bad date */ } }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const dateFieldMap: Record<typeof dateField, string> = {
    merged: 'githubMergedAt',
    created: 'githubCreatedAt',
    imported: 'importedAt',
  };
  const prismaDateField = dateFieldMap[dateField] ?? 'githubMergedAt';

  const where: Record<string, unknown> = { projectId };

  if (classification) where['classification'] = classification;
  if (bugState) where['bugState'] = bugState;
  if (author) where['author'] = { equals: author, mode: 'insensitive' };
  if (hasDateFilter) where[prismaDateField] = dateFilter;

  // Full-text search: filter by title and body using case-insensitive contains
  if (q) {
    where['OR'] = [
      { title: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
      { author: { contains: q, mode: 'insensitive' } },
    ];
  }

  try {
    const [prs, total] = await Promise.all([
      prisma.githubPR.findMany({
        where,
        orderBy: [
          { githubMergedAt: 'desc' },
          { githubCreatedAt: 'desc' },
          { importedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          projectId: true,
          taskId: true,
          milestoneId: true,
          agentRunId: true,
          prNumber: true,
          title: true,
          author: true,
          sourceBranch: true,
          baseBranch: true,
          state: true,
          merged: true,
          mergeSha: true,
          labels: true,
          filesChangedCount: true,
          filesChanged: true,
          ciStatus: true,
          prUrl: true,
          classification: true,
          classificationSource: true,
          bugState: true,
          reviewDecision: true,
          commentCount: true,
          syncedAt: true,
          githubCreatedAt: true,
          githubUpdatedAt: true,
          githubMergedAt: true,
          importedAt: true,
          updatedAt: true,
        },
      }),
      prisma.githubPR.count({ where }),
    ]);

    return NextResponse.json({ prs, total, limit, offset });
  } catch {
    return NextResponse.json({ error: 'Failed to search PR memory index' }, { status: 500 });
  }
}
