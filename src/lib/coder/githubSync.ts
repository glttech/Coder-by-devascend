interface GitHubPRItem {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
  head: { ref: string };
  base: { ref: string };
  state: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  labels: { name: string }[];
  html_url: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
}

interface GitHubCheckRun {
  conclusion: string | null;
}

interface GitHubCheckRunsResponse {
  check_runs: GitHubCheckRun[];
}

export interface SyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? null;
}

function githubHeaders(): HeadersInit {
  const token = getGithubToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchPRPage(owner: string, repo: string, page: number): Promise<GitHubPRItem[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100&page=${page}&sort=updated&direction=desc`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) throw new Error(`Repository ${owner}/${repo} not found on GitHub`);
  if (res.status === 403 || res.status === 429) throw new Error('GitHub API rate limit exceeded');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<GitHubPRItem[]>;
}

// exported for potential future direct use
export async function getCiStatus(owner: string, repo: string, sha: string): Promise<string | null> {
  if (!sha) return null;
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubCheckRunsResponse;
    const runs = data.check_runs ?? [];
    if (runs.length === 0) return 'neutral';
    if (runs.some((r) => r.conclusion === 'failure')) return 'failure';
    if (runs.every((r) => r.conclusion === 'success')) return 'success';
    return 'pending';
  } catch {
    return null;
  }
}

import prisma from '@/lib/prisma';

export async function syncRepositoryPRs(
  repoId: string,
  owner: string,
  repo: string,
  maxPages = 5,
): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, updated: 0, errors: [] };

  await prisma.repository.update({
    where: { id: repoId },
    data: { syncStatus: 'syncing', lastSyncError: null },
  });

  try {
    for (let page = 1; page <= maxPages; page++) {
      let items: GitHubPRItem[];
      try {
        items = await fetchPRPage(owner, repo, page);
      } catch (err) {
        result.errors.push(String(err));
        break;
      }

      if (items.length === 0) break;

      for (const pr of items) {
        try {
          const state = pr.merged_at ? 'closed' : pr.state;
          const existing = await prisma.repositoryPR.findUnique({
            where: { repoId_prNumber: { repoId, prNumber: pr.number } },
          });

          const data = {
            title: pr.title,
            body: pr.body ?? null,
            author: pr.user?.login ?? null,
            sourceBranch: pr.head.ref,
            baseBranch: pr.base.ref,
            state,
            merged: !!pr.merged_at,
            mergeSha: pr.merge_commit_sha ?? null,
            labels: pr.labels.map((l) => l.name),
            prUrl: pr.html_url,
            githubCreatedAt: new Date(pr.created_at),
            githubUpdatedAt: new Date(pr.updated_at),
            githubMergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            syncedAt: new Date(),
          };

          if (existing) {
            await prisma.repositoryPR.update({ where: { id: existing.id }, data });
            result.updated++;
          } else {
            await prisma.repositoryPR.create({
              data: { repoId, prNumber: pr.number, ...data },
            });
            result.imported++;
          }
        } catch (err) {
          result.errors.push(`PR #${pr.number}: ${String(err)}`);
        }
      }

      if (items.length < 100) break;
    }

    await prisma.repository.update({
      where: { id: repoId },
      data: {
        syncStatus: result.errors.length > 0 ? 'error' : 'synced',
        syncedAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.slice(0, 3).join('; ') : null,
      },
    });
  } catch (err) {
    await prisma.repository.update({
      where: { id: repoId },
      data: { syncStatus: 'error', lastSyncError: String(err) },
    });
    result.errors.push(String(err));
  }

  return result;
}
