/**
 * Pure helpers for parsing query parameters on GET /api/coder/tasks.
 * Kept in src/lib so they can be unit-tested without importing Next.js.
 */

export interface CoderTaskParams {
  limit: number;
  cursor: string | undefined;
  status: string | undefined;
  projectId: string | undefined;
}

export function parseCoderTaskParams(searchParams: URLSearchParams): CoderTaskParams {
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);
  const cursor = searchParams.get('cursor') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const projectId = searchParams.get('projectId') ?? undefined;
  return { limit, cursor, status, projectId };
}
