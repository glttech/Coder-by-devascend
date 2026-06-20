/**
 * Pure helpers for parsing query parameters on GET /api/coder/sessions.
 * No Next.js imports — kept here so tests can import without a framework.
 */

export interface CliSessionParams {
  limit: number;
  cursor: string | undefined;
  taskId: string | undefined;
  status: string | undefined;
}

export function parseCliSessionParams(searchParams: URLSearchParams): CliSessionParams {
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);
  const cursor = searchParams.get('cursor') ?? undefined;
  const taskId = searchParams.get('taskId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  return { limit, cursor, taskId, status };
}
