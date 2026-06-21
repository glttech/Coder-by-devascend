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
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);
  return {
    orgId: searchParams.get('orgId') ?? 'org_default',
    enabled: enabledRaw === null ? undefined : enabledRaw === 'true',
    cursor: searchParams.get('cursor') ?? undefined,
    limit,
  };
}

export function validateRepositoryBody(body: unknown): RepositoryBody {
  if (!body || typeof body !== 'object') throw new Error('Request body required');
  const b = body as Record<string, unknown>;
  if (!b.owner || typeof b.owner !== 'string' || !b.owner.trim()) throw new Error('owner is required');
  if (!b.repo || typeof b.repo !== 'string' || !b.repo.trim()) throw new Error('repo is required');
  const owner = b.owner.trim();
  const repo = b.repo.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(owner)) throw new Error('owner contains invalid characters');
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) throw new Error('repo contains invalid characters');
  const fullName = `${owner}/${repo}`;
  return {
    name: typeof b.name === 'string' && b.name.trim() ? b.name.trim() : fullName,
    owner,
    repo,
    fullName,
    defaultBranch:
      typeof b.defaultBranch === 'string' && b.defaultBranch.trim()
        ? b.defaultBranch.trim()
        : 'main',
    private: b.private === true,
    description:
      typeof b.description === 'string' && b.description.trim()
        ? b.description.trim()
        : undefined,
    enabled: b.enabled !== false,
  };
}

export function validateRepositoryPatch(body: unknown): RepositoryPatch {
  if (!body || typeof body !== 'object') throw new Error('Request body required');
  const b = body as Record<string, unknown>;
  const patch: RepositoryPatch = {};
  if (b.name !== undefined)
    patch.name = typeof b.name === 'string' ? b.name.trim() || undefined : undefined;
  if (b.defaultBranch !== undefined)
    patch.defaultBranch =
      typeof b.defaultBranch === 'string' ? b.defaultBranch.trim() || undefined : undefined;
  if (b.description !== undefined)
    patch.description =
      typeof b.description === 'string' ? b.description.trim() || undefined : undefined;
  if (b.enabled !== undefined) patch.enabled = Boolean(b.enabled);
  return patch;
}
