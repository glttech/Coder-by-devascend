import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { fetchGithubPR } from '@/lib/githubClient';
import { buildClassificationFields } from '@/lib/prClassifier';
import { writeAudit } from '@/lib/audit';
import { checkLimit, getClientIp, Bucket } from '@/lib/rateLimiter';

const _syncBuckets = new Map<string, Bucket>();

export const dynamic = 'force-dynamic';

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubPRListItem {
  number: number;
  updated_at: string;
}

/**
 * Fetch all PRs (open + closed) from GitHub, newest first, stopping when we
 * reach a PR that hasn't changed since lastSyncedAt.
 * Returns up to maxPages * 100 PR numbers.
 */
async function listPRsSinceDate(
  owner: string,
  repo: string,
  token: string | undefined,
  since: Date | null,
  maxPages = 10,
): Promise<{ ok: true; prNumbers: number[] } | { ok: false; status: number; message: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const prNumbers: number[] = [];
  let page = 1;

  while (page <= maxPages) {
    let res: Response;
    try {
      // state=all: includes open, closed, merged
      res = await fetch(
        `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        { headers },
      );
    } catch {
      return { ok: false, status: 502, message: 'Failed to reach GitHub API' };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, message: 'GitHub API authentication required' };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, message: `Repository ${owner}/${repo} not found on GitHub` };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, message: 'GitHub API rate limit exceeded' };
    }
    if (!res.ok) {
      return { ok: false, status: 502, message: `GitHub API returned ${res.status}` };
    }

    let items: GitHubPRListItem[];
    try {
      items = (await res.json()) as GitHubPRListItem[];
    } catch {
      return { ok: false, status: 502, message: 'GitHub returned unexpected response' };
    }

    if (items.length === 0) break;

    let hitOldData = false;
    for (const item of items) {
      // Stop early if we've already synced up to this point
      if (since && new Date(item.updated_at) <= since) {
        hitOldData = true;
        break;
      }
      prNumbers.push(item.number);
    }

    if (hitOldData || items.length < 100) break;
    page++;
  }

  return { ok: true, prNumbers };
}

/**
 * POST /api/github-prs/sync
 * Incremental sync: imports all new/updated PRs for a project.
 * Uses PrSyncState to track progress and avoid re-importing unchanged PRs.
 *
 * Body: { projectId: string; fullSync?: boolean }
 * fullSync=true ignores lastSyncedAt and re-fetches everything (up to 10 pages).
 *
 * Auth: admin only — requires GITHUB_TOKEN env var to be useful on private repos.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'));
  const rl = checkLimit(_syncBuckets, ip, 5);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many sync requests — try again shortly' }, {
      status: 429, headers: { 'Retry-After': String(rl.retryAfter) },
    });
  }

  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.projectId !== 'string') {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const { projectId, fullSync = false } = body as { projectId: string; fullSync?: boolean };

  // Load project with repo coords
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoOwner: true, repoName: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (!project.repoOwner || !project.repoName) {
    return NextResponse.json(
      { error: 'Project does not have a GitHub repository configured (repoOwner / repoName missing)' },
      { status: 422 },
    );
  }

  const { repoOwner, repoName } = project;

  // Load or create PrSyncState
  let syncState = await prisma.prSyncState.findUnique({ where: { projectId } });
  if (!syncState) {
    syncState = await prisma.prSyncState.create({
      data: { projectId, syncStatus: 'running', updatedAt: new Date() },
    });
  } else {
    await prisma.prSyncState.update({
      where: { projectId },
      data: { syncStatus: 'running', errorMessage: null, updatedAt: new Date() },
    });
  }

  const since = fullSync ? null : (syncState.lastSyncedAt ?? null);

  // Fetch PR list from GitHub
  const token = process.env.GITHUB_TOKEN || undefined;
  const listResult = await listPRsSinceDate(repoOwner, repoName, token, since);

  if (!listResult.ok) {
    await prisma.prSyncState.update({
      where: { projectId },
      data: { syncStatus: 'error', errorMessage: listResult.message, updatedAt: new Date() },
    });
    return NextResponse.json({ error: listResult.message }, { status: listResult.status });
  }

  const { prNumbers } = listResult;
  let imported = 0;
  let updated = 0;
  let errors = 0;
  let maxPrNumber = syncState.lastSyncedPrNumber ?? 0;

  for (const prNumber of prNumbers) {
    const result = await fetchGithubPR(repoOwner, repoName, prNumber, token);
    if (!result.ok) {
      errors++;
      continue;
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

    const commonData = {
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
    };

    try {
      const existing = await prisma.githubPR.findUnique({
        where: { projectId_prNumber: { projectId, prNumber: d.prNumber } },
        select: { id: true, classificationSource: true },
      });

      if (existing) {
        // Only reclassify if not manually overridden
        const updateData: typeof commonData & { classification?: string; classificationSource?: string; bugState?: string | null } = { ...commonData };
        if (existing.classificationSource === 'manual') {
          delete (updateData as Record<string, unknown>)['classification'];
          delete (updateData as Record<string, unknown>)['classificationSource'];
          delete (updateData as Record<string, unknown>)['bugState'];
        }
        await prisma.githubPR.update({
          where: { projectId_prNumber: { projectId, prNumber: d.prNumber } },
          data: updateData,
        });
        updated++;
      } else {
        await prisma.githubPR.create({
          data: { projectId, prNumber: d.prNumber, ...commonData },
        });
        imported++;
      }

      if (prNumber > maxPrNumber) maxPrNumber = prNumber;
    } catch {
      errors++;
    }
  }

  const syncedAt = new Date();
  await prisma.prSyncState.update({
    where: { projectId },
    data: {
      syncStatus: 'idle',
      lastSyncedAt: syncedAt,
      lastSyncedPrNumber: maxPrNumber > 0 ? maxPrNumber : undefined,
      totalSynced: { increment: imported + updated },
      errorMessage: null,
      updatedAt: syncedAt,
    },
  });

  await writeAudit({
    event: 'github_prs_synced',
    details: JSON.stringify({
      projectId,
      repoOwner,
      repoName,
      imported,
      updated,
      errors,
      fullSync,
      at: syncedAt.toISOString(),
    }),
    userId:
      ('userId' in auth.user ? auth.user.userId : undefined) ??
      ('id' in auth.user ? (auth.user as { id: string }).id : undefined) ??
      null,
  });

  return NextResponse.json({ imported, updated, errors, syncedAt: syncedAt.toISOString() });
}
