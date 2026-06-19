import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchGithubPR, resolveGithubCoords, userSafeErrorMessage } from '@/lib/githubClient';
import { writeAudit } from '@/lib/audit';
import { buildClassificationFields } from '@/lib/prClassifier';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

interface RouteContext {
  params: { id: string };
}

export type RefreshErrorCode =
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

export interface RefreshSuccessResponse {
  ok: true;
  pr: {
    id: string;
    title: string;
    state: string;
    ciStatus: string | null;
    updatedAt: string;
  };
}

export interface RefreshErrorResponse {
  ok: false;
  error: string;
  code: RefreshErrorCode;
}

export type RefreshResponse = RefreshSuccessResponse | RefreshErrorResponse;

/** Map GithubClientError codes to our public RefreshErrorCode. */
function toRefreshErrorCode(githubCode: string): RefreshErrorCode {
  switch (githubCode) {
    case 'RATE_LIMITED':   return 'RATE_LIMITED';
    case 'NOT_FOUND':      return 'NOT_FOUND';
    case 'AUTH_REQUIRED':  return 'AUTH_ERROR';
    case 'NETWORK_ERROR':  return 'NETWORK_ERROR';
    case 'PARSE_ERROR':    return 'PARSE_ERROR';
    default:               return 'UNKNOWN';
  }
}

const HTTP_STATUS_MAP: Partial<Record<RefreshErrorCode, number>> = {
  NOT_FOUND:    404,
  RATE_LIMITED: 429,
  AUTH_ERROR:   401,
  NETWORK_ERROR: 502,
  PARSE_ERROR:   502,
  UNKNOWN:       500,
};

// POST /api/github-prs/[id]/refresh — re-fetch PR metadata from GitHub and update stored record
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
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
    const body: RefreshErrorResponse = {
      ok: false,
      error: 'Failed to look up PR record',
      code: 'UNKNOWN',
    };
    return NextResponse.json(body, { status: 500 });
  }

  if (!pr) {
    const body: RefreshErrorResponse = { ok: false, error: 'PR not found', code: 'NOT_FOUND' };
    return NextResponse.json(body, { status: 404 });
  }

  const coords = resolveGithubCoords(
    pr.project.repoOwner,
    pr.project.repoName,
    pr.prUrl,
    pr.prNumber,
  );

  if (!coords) {
    const body: RefreshErrorResponse = {
      ok: false,
      error: 'Cannot determine GitHub repository for this PR. Set repoOwner and repoName on the project.',
      code: 'UNKNOWN',
    };
    return NextResponse.json(body, { status: 422 });
  }

  // Fetch latest data from GitHub — token server-side only, never returned to client
  const token = process.env.GITHUB_TOKEN || undefined;
  const result = await fetchGithubPR(coords.owner, coords.repo, coords.prNumber, token);

  if (!result.ok) {
    const code = toRefreshErrorCode(result.error.code);
    const body: RefreshErrorResponse = {
      ok: false,
      error: userSafeErrorMessage(result.error.code),
      code,
    };
    return NextResponse.json(body, { status: HTTP_STATUS_MAP[code] ?? 502 });
  }

  const d = result.data;

  // Load existing record to check if manually classified
  const existingPr = await prisma.githubPR.findUnique({
    where: { id },
    select: { classificationSource: true },
  });

  // Auto-reclassify unless the user has manually overridden the classification
  const classificationUpdate =
    existingPr?.classificationSource !== 'manual'
      ? buildClassificationFields({
          title: d.title,
          body: d.body,
          labels: d.labels,
          filesChanged: d.filesChanged,
          ciStatus: d.ciStatus,
          state: d.state,
        })
      : {};

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
        ...classificationUpdate,
        syncedAt: new Date(),
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

    const body: RefreshSuccessResponse = {
      ok: true,
      pr: {
        id: updated.id,
        title: updated.title,
        state: updated.state,
        ciStatus: updated.ciStatus,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
    return NextResponse.json(body);
  } catch {
    const body: RefreshErrorResponse = {
      ok: false,
      error: 'Failed to save refreshed PR data',
      code: 'UNKNOWN',
    };
    return NextResponse.json(body, { status: 500 });
  }
}
