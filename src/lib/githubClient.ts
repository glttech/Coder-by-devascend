/**
 * Server-side GitHub API client for fetching PR metadata.
 *
 * SECURITY: token is optional and server-side only. Never pass to browser.
 * Without a token, the public GitHub API allows 60 req/hour per IP.
 * With a token, the limit is 5000 req/hour.
 */

export interface GithubPRData {
  prNumber: number;
  title: string;
  body: string | null;
  author: string | null;
  sourceBranch: string | null;
  baseBranch: string | null;
  state: string;
  merged: boolean;
  mergeSha: string | null;
  labels: string[];
  filesChangedCount: number | null;
  filesChanged: string[];
  ciStatus: string | null;
  prUrl: string;
  githubCreatedAt: string | null;
  githubUpdatedAt: string | null;
  githubMergedAt: string | null;
}

export interface GithubClientError {
  code: 'NOT_FOUND' | 'RATE_LIMITED' | 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'PARSE_ERROR';
  message: string;
  status?: number;
}

export type GithubPRResult =
  | { ok: true; data: GithubPRData }
  | { ok: false; error: GithubClientError };

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Resolve owner/repo/prNumber for a stored GithubPR record.
 * Prefers project.repoOwner + project.repoName; falls back to parsing prUrl.
 * Returns null if neither source is usable.
 */
export function resolveGithubCoords(
  repoOwner: string | null | undefined,
  repoName: string | null | undefined,
  prUrl: string | null | undefined,
  prNumber: number,
): { owner: string; repo: string; prNumber: number } | null {
  if (repoOwner && repoName) {
    return { owner: repoOwner, repo: repoName, prNumber };
  }
  if (prUrl) {
    const parsed = parsePRUrl(prUrl);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Map a GithubClientError code to a user-safe message.
 * Token value is never included.
 */
export function userSafeErrorMessage(code: GithubClientError['code']): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'GitHub API rate limit reached. Try again in an hour, or ask the server admin to configure a server-side GitHub access token to increase limits.';
    case 'NOT_FOUND':
      return 'PR not found on GitHub. It may have been deleted or the repository made private.';
    case 'AUTH_REQUIRED':
      return 'GitHub access is not configured on the server. Ask the server admin to configure GitHub read access.';
    case 'NETWORK_ERROR':
      return 'Could not reach GitHub API. Check your network connection and try again.';
    case 'PARSE_ERROR':
      return 'GitHub returned an unexpected response. Try again later.';
  }
}

/**
 * Parse a GitHub PR URL into owner/repo/prNumber.
 * Accepts: https://github.com/owner/repo/pull/123
 * or plain "owner/repo#123" shorthand.
 */
export function parsePRUrl(input: string): { owner: string; repo: string; prNumber: number } | null {
  const trimmed = input.trim();

  // Full URL: https://github.com/owner/repo/pull/123
  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], prNumber: parseInt(urlMatch[3], 10) };
  }

  // Shorthand: owner/repo#123
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#(\d+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2], prNumber: parseInt(shortMatch[3], 10) };
  }

  return null;
}

/**
 * Build auth headers. Token is optional and server-side only.
 * Never expose token value in logs or responses.
 */
function buildHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Map GitHub check run conclusions to a simple status string.
 */
function summariseCIStatus(checkRuns: { conclusion: string | null }[]): string {
  if (checkRuns.length === 0) return 'neutral';
  const conclusions = checkRuns.map((r) => r.conclusion ?? 'pending');
  if (conclusions.some((c) => c === 'failure' || c === 'timed_out' || c === 'cancelled')) return 'failure';
  if (conclusions.every((c) => c === 'success' || c === 'skipped' || c === 'neutral')) return 'success';
  return 'pending';
}

/**
 * Fetch PR metadata from GitHub API.
 * @param owner  GitHub org or username
 * @param repo   Repository name
 * @param prNumber  Pull request number
 * @param token  Optional server-side GitHub token (never expose to client)
 */
export async function fetchGithubPR(
  owner: string,
  repo: string,
  prNumber: number,
  token?: string,
): Promise<GithubPRResult> {
  const headers = buildHeaders(token);

  // Fetch PR metadata
  let prJson: Record<string, unknown>;
  try {
    const prRes = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`,
      { headers },
    );

    if (prRes.status === 401 || prRes.status === 403) {
      return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'GitHub API authentication required or token lacks permissions', status: prRes.status } };
    }
    if (prRes.status === 404) {
      return { ok: false, error: { code: 'NOT_FOUND', message: `PR #${prNumber} not found in ${owner}/${repo}`, status: 404 } };
    }
    if (prRes.status === 429) {
      return { ok: false, error: { code: 'RATE_LIMITED', message: 'GitHub API rate limit exceeded. Add a GITHUB_TOKEN to increase limits.', status: 429 } };
    }
    if (!prRes.ok) {
      return { ok: false, error: { code: 'NETWORK_ERROR', message: `GitHub API returned ${prRes.status}`, status: prRes.status } };
    }

    prJson = await prRes.json();
  } catch {
    return { ok: false, error: { code: 'NETWORK_ERROR', message: 'Failed to reach GitHub API' } };
  }

  // Fetch changed files (first page, max 100)
  let filesChanged: string[] = [];
  let filesChangedCount: number | null = null;
  try {
    const filesRes = await fetch(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files?per_page=100`,
      { headers },
    );
    if (filesRes.ok) {
      const filesJson = (await filesRes.json()) as { filename: string }[];
      filesChanged = filesJson.map((f) => f.filename);
      filesChangedCount = filesChanged.length;
      // If changed field shows more files than we got, use the count from PR metadata
      const changedFromPR = (prJson.changed_files as number | undefined) ?? null;
      if (changedFromPR !== null && changedFromPR > filesChangedCount) {
        filesChangedCount = changedFromPR;
      }
    }
  } catch {
    // Files fetch is best-effort; don't fail the whole import
  }

  // Fetch CI check runs on the head SHA
  let ciStatus: string | null = null;
  const headSha = (prJson.head as Record<string, unknown> | undefined)?.sha as string | undefined;
  if (headSha) {
    try {
      const checksRes = await fetch(
        `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${headSha}/check-runs?per_page=100`,
        { headers },
      );
      if (checksRes.ok) {
        const checksJson = (await checksRes.json()) as { check_runs: { conclusion: string | null }[] };
        ciStatus = summariseCIStatus(checksJson.check_runs ?? []);
      }
    } catch {
      // CI check fetch is best-effort
    }
  }

  try {
    const head = prJson.head as Record<string, unknown> | undefined;
    const base = prJson.base as Record<string, unknown> | undefined;
    const user = prJson.user as Record<string, unknown> | undefined;
    const mergeCommit = prJson.merge_commit_sha as string | null | undefined;

    const labels = ((prJson.labels as { name: string }[] | undefined) ?? []).map((l) => l.name);

    const data: GithubPRData = {
      prNumber,
      title: (prJson.title as string) ?? '',
      body: (prJson.body as string | null) ?? null,
      author: (user?.login as string | undefined) ?? null,
      sourceBranch: (head?.ref as string | undefined) ?? null,
      baseBranch: (base?.ref as string | undefined) ?? null,
      state: (prJson.state as string) === 'closed' && prJson.merged ? 'merged' : (prJson.state as string) ?? 'open',
      merged: Boolean(prJson.merged),
      mergeSha: mergeCommit ?? null,
      labels,
      filesChangedCount,
      filesChanged,
      ciStatus,
      prUrl: (prJson.html_url as string) ?? `https://github.com/${owner}/${repo}/pull/${prNumber}`,
      githubCreatedAt: (prJson.created_at as string | undefined) ?? null,
      githubUpdatedAt: (prJson.updated_at as string | undefined) ?? null,
      githubMergedAt: (prJson.merged_at as string | null | undefined) ?? null,
    };

    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse GitHub API response' } };
  }
}
