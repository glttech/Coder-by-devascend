export interface RepositoryListParams {
  orgId: string;
  enabled?: boolean;
  cursor?: string;
  limit: number;
}

export interface RepositoryBody {
  name: string;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description?: string;
  enabled: boolean;
}

export interface RepositoryPatch {
  name?: string;
  defaultBranch?: string;
  description?: string;
  enabled?: boolean;
}

export function parseRepositoryListParams(searchParams: URLSearchParams): RepositoryListParams {
  const enabledRaw = searchParams.get('enabled');
  return {
    orgId: searchParams.get('orgId') ?? 'org_default',
    enabled: enabledRaw === null ? undefined : enabledRaw === 'true',
    cursor: searchParams.get('cursor') ?? undefined,
    limit: Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10), 1), 100),
  };
}

export function validateRepositoryBody(body: unknown): RepositoryBody {
  if (!body || typeof body !== 'object') throw new Error('Request body required');
  const b = body as Record<string, unknown>;
  if (!b.owner || typeof b.owner !== 'string') throw new Error('owner is required');
  if (!b.repo || typeof b.repo !== 'string') throw new Error('repo is required');
  const owner = b.owner.trim().toLowerCase();
  const repo = b.repo.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/i.test(owner)) throw new Error('owner contains invalid characters');
  if (!/^[a-z0-9._-]+$/i.test(repo)) throw new Error('repo contains invalid characters');
  return {
    name: typeof b.name === 'string' && b.name.trim() ? b.name.trim() : `${owner}/${repo}`,
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    defaultBranch: typeof b.defaultBranch === 'string' ? b.defaultBranch.trim() || 'main' : 'main',
    private: b.private === true,
    description: typeof b.description === 'string' ? b.description.trim() || undefined : undefined,
    enabled: b.enabled !== false,
  };
}

export function validateRepositoryPatch(body: unknown): RepositoryPatch {
  if (!body || typeof body !== 'object') throw new Error('Request body required');
  const b = body as Record<string, unknown>;
  const patch: RepositoryPatch = {};
  if (typeof b.name === 'string') patch.name = b.name.trim() || undefined;
  if (typeof b.defaultBranch === 'string') patch.defaultBranch = b.defaultBranch.trim() || undefined;
  if (typeof b.description === 'string') patch.description = b.description.trim() || undefined;
  if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
  return patch;
}
