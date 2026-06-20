import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchGithubPR, parsePRUrl, userSafeErrorMessage } from '@/lib/githubClient';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { buildClassificationFields } from '@/lib/prClassifier';

// GET /api/github-prs?projectId=...&limit=50&cursor=...
// Auth: any authenticated user.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 });
  }

  const rawLimit = parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 100 : Math.min(rawLimit, 500);
  const cursor = searchParams.get('cursor');

  try {
    const prs = await prisma.githubPR.findMany({
      where: {
        projectId,
        ...(cursor ? { importedAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { importedAt: 'desc' },
      take: limit,
    });
    const nextCursor = prs.length === limit ? prs[prs.length - 1].importedAt.toISOString() : null;
    return NextResponse.json({ prs, nextCursor });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch GitHub PRs' }, { status: 500 });
  }
}

// POST /api/github-prs — import PR by URL or owner/repo/prNumber
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const data = await request.json().catch(() => null);
  if (!data) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { projectId, prUrl, owner, repo, prNumber } = data;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId is required' }, { status: 422 });
  }

  let resolvedOwner: string | undefined;
  let resolvedRepo: string | undefined;
  let resolvedPrNumber: number | undefined;

  if (prUrl) {
    const parsed = parsePRUrl(prUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/123 or owner/repo#123' },
        { status: 422 },
      );
    }
    resolvedOwner = parsed.owner;
    resolvedRepo = parsed.repo;
    resolvedPrNumber = parsed.prNumber;
  } else if (owner && repo && prNumber) {
    if (typeof owner !== 'string' || typeof repo !== 'string') {
      return NextResponse.json({ error: 'owner and repo must be strings' }, { status: 422 });
    }
    const num = Number(prNumber);
    if (!Number.isInteger(num) || num < 1) {
      return NextResponse.json({ error: 'prNumber must be a positive integer' }, { status: 422 });
    }
    resolvedOwner = owner;
    resolvedRepo = repo;
    resolvedPrNumber = num;
  } else {
    return NextResponse.json(
      { error: 'Provide either prUrl or owner + repo + prNumber' },
      { status: 422 },
    );
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Failed to verify project' }, { status: 500 });
  }

  const token = process.env.GITHUB_TOKEN || undefined;
  const result = await fetchGithubPR(resolvedOwner, resolvedRepo, resolvedPrNumber, token);

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
      AUTH_REQUIRED: 401,
      NETWORK_ERROR: 502,
      PARSE_ERROR: 502,
    };
    return NextResponse.json(
      { error: userSafeErrorMessage(result.error.code), code: result.error.code },
      { status: statusMap[result.error.code] ?? 502 },
    );
  }

  const d = result.data;
  const classification = buildClassificationFields({
    title: d.title,
    body: d.body,
    labels: d.labels,
    filesChanged: d.filesChanged,
    ciStatus: d.ciStatus,
    state: d.state,
  });

  try {
    const pr = await prisma.githubPR.upsert({
      where: { projectId_prNumber: { projectId, prNumber: d.prNumber } },
      create: {
        projectId,
        prNumber: d.prNumber,
        title: d.title,
        body: d.body,
        author: d.author,
        sourceBranch: d.sourceBranch,
        baseBranch: d.baseBranch,
        state: d.state,
        merged: d.merged,
        mergeSha: d.mergeSha,
        labels: d.labels,
        filesChangedCount: d.filesChangedCount,
        filesChanged: d.filesChanged,
        ciStatus: d.ciStatus,
        prUrl: d.prUrl,
        githubCreatedAt: d.githubCreatedAt ? new Date(d.githubCreatedAt) : null,
        githubUpdatedAt: d.githubUpdatedAt ? new Date(d.githubUpdatedAt) : null,
        githubMergedAt: d.githubMergedAt ? new Date(d.githubMergedAt) : null,
        ...classification,
        syncedAt: new Date(),
      },
      update: {
        title: d.title,
        body: d.body,
        author: d.author,
        sourceBranch: d.sourceBranch,
        baseBranch: d.baseBranch,
        state: d.state,
        merged: d.merged,
        mergeSha: d.mergeSha,
        labels: d.labels,
        filesChangedCount: d.filesChangedCount,
        filesChanged: d.filesChanged,
        ciStatus: d.ciStatus,
        prUrl: d.prUrl,
        ...classification,
        syncedAt: new Date(),
        githubUpdatedAt: d.githubUpdatedAt ? new Date(d.githubUpdatedAt) : null,
        githubMergedAt: d.githubMergedAt ? new Date(d.githubMergedAt) : null,
      },
    });

    await writeAudit({
      event: 'github_pr_imported',
      details: JSON.stringify({
        projectId,
        prNumber: d.prNumber,
        title: d.title,
        owner: resolvedOwner,
        repo: resolvedRepo,
        at: new Date().toISOString(),
      }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json(pr, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save PR evidence' }, { status: 500 });
  }
}
