import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchGithubPR, resolveGithubCoords, userSafeErrorMessage } from '@/lib/githubClient';
import { writeAudit } from '@/lib/audit';

interface RouteContext {
  params: { id: string };
}

// POST /api/github-prs/[id]/refresh — re-fetch PR metadata from GitHub and update stored record
export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = params;

  // Load the stored PR and its project's repo coordinates
  let pr: {
    id: string; projectId: string; prNumber: number; prUrl: string | null;
    project: { repoOwner: string | null; repoName: string | null };
  } | null;

  try {
    pr = await prisma.githubPR.findUnique({
      where: { id },
      select: {
        id: true, projectId: true, prNumber: true, prUrl: true,
        project: { select: { repoOwner: true, repoName: true } },
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to look up PR record' }, { status: 500 });
  }

  if (!pr) {
    return NextResponse.json({ error: 'PR not found' }, { status: 404 });
  }

  const coords = resolveGithubCoords(
    pr.project.repoOwner,
    pr.project.repoName,
    pr.prUrl,
    pr.prNumber,
  );

  if (!coords) {
    return NextResponse.json(
      { error: 'Cannot determine GitHub repository for this PR. Set repoOwner and repoName on the project.' },
      { status: 422 },
    );
  }

  // Fetch latest data from GitHub — token server-side only, never returned to client
  const token = process.env.GITHUB_TOKEN || undefined;
  const result = await fetchGithubPR(coords.owner, coords.repo, coords.prNumber, token);

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

  try {
    const updated = await prisma.githubPR.update({
      where: { id },
      data: {
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
        githubUpdatedAt: d.githubUpdatedAt ? new Date(d.githubUpdatedAt) : null,
        githubMergedAt: d.githubMergedAt ? new Date(d.githubMergedAt) : null,
      },
    });

    await writeAudit({
      event: 'github_pr_refreshed',
      details: JSON.stringify({
        prId: id,
        projectId: pr.projectId,
        prNumber: d.prNumber,
        owner: coords.owner,
        repo: coords.repo,
        newState: d.state,
        newCiStatus: d.ciStatus,
        refreshedAt: updated.updatedAt.toISOString(),
      }),
      userId: null,
    });

    return NextResponse.json({ pr: updated, refreshedAt: updated.updatedAt });
  } catch {
    return NextResponse.json({ error: 'Failed to save refreshed PR data' }, { status: 500 });
  }
}
