import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchGithubPR } from '@/lib/githubClient';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubPRListItem {
  number: number;
}

/**
 * Fetch all open PRs from GitHub for owner/repo (paginates up to 10 pages / 1000 PRs).
 */
async function listOpenGithubPRs(
  owner: string,
  repo: string,
  token: string | undefined,
): Promise<{ ok: true; prNumbers: number[] } | { ok: false; status: number; message: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const prNumbers: number[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    let res: Response;
    try {
      res = await fetch(
        `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=100&page=${page}`,
        { headers },
      );
    } catch {
      return { ok: false, status: 502, message: 'Failed to reach GitHub API' };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, message: 'GitHub API authentication required or token lacks permissions' };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, message: `Repository ${owner}/${repo} not found on GitHub` };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, message: 'GitHub API rate limit exceeded. Try again later.' };
    }
    if (!res.ok) {
      return { ok: false, status: 502, message: `GitHub API returned ${res.status}` };
    }

    let items: GitHubPRListItem[];
    try {
      items = (await res.json()) as GitHubPRListItem[];
    } catch {
      return { ok: false, status: 502, message: 'GitHub returned an unexpected response' };
    }

    if (items.length === 0) break;
    for (const item of items) prNumbers.push(item.number);
    if (items.length < 100) break;
    page++;
  }

  return { ok: true, prNumbers };
}

// POST /api/projects/[id]/discover-prs
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  const projectId = params.id;

  // Load project and verify it has repo coords
  let project: { id: string; repoOwner: string | null; repoName: string | null } | null;
  try {
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, repoOwner: true, repoName: true },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { repoOwner, repoName } = project;
  if (!repoOwner || !repoName) {
    return NextResponse.json(
      { error: 'Project does not have a GitHub repository configured (repoOwner / repoName missing)' },
      { status: 422 },
    );
  }

  // Fetch existing PR numbers for this project so we can deduplicate
  let existingPrNumbers: Set<number>;
  try {
    const existing = await prisma.githubPR.findMany({
      where: { projectId },
      select: { prNumber: true },
    });
    existingPrNumbers = new Set(existing.map((p) => p.prNumber));
  } catch {
    return NextResponse.json({ error: 'Failed to load existing PRs' }, { status: 500 });
  }

  // List open PRs from GitHub
  const token = process.env.GITHUB_TOKEN || undefined;
  const listResult = await listOpenGithubPRs(repoOwner, repoName, token);
  if (!listResult.ok) {
    return NextResponse.json({ error: listResult.message }, { status: listResult.status });
  }

  const { prNumbers } = listResult;
  const newPrNumbers = prNumbers.filter((n) => !existingPrNumbers.has(n));
  const skipped = prNumbers.length - newPrNumbers.length;

  // Import each new PR
  const importedPRs: { id: string; prNumber: number; title: string }[] = [];
  let importErrors = 0;

  for (const prNumber of newPrNumbers) {
    const result = await fetchGithubPR(repoOwner, repoName, prNumber, token);
    if (!result.ok) {
      // Best-effort: skip PRs we can't fetch
      importErrors++;
      continue;
    }

    const d = result.data;
    try {
      const pr = await prisma.githubPR.create({
        data: {
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
        },
        select: { id: true, prNumber: true, title: true },
      });
      importedPRs.push(pr);
    } catch {
      // Could be a race condition duplicate — skip silently
      importErrors++;
    }
  }

  const imported = importedPRs.length;

  // Write audit log
  try {
    await writeAudit({
      event: 'github_prs_discovered',
      details: JSON.stringify({
        projectId,
        imported,
        skipped,
        importErrors,
        repoOwner,
        repoName,
        at: new Date().toISOString(),
      }),
      userId: currentUser?.userId ?? null,
    });
  } catch {
    // Audit log failure should not fail the response
  }

  return NextResponse.json(
    { imported, skipped, prs: importedPRs },
    { status: 200 },
  );
}

