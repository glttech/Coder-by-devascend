export interface ControlRoomParams {
  repoId?: string;
  taskId?: string;
  status?: string;
  orgId: string;
  cursor?: string;
  limit: number;
}

export function parseControlRoomParams(searchParams: URLSearchParams): ControlRoomParams {
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);
  return {
    repoId: searchParams.get('repoId') ?? undefined,
    taskId: searchParams.get('taskId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    orgId: searchParams.get('orgId') ?? 'org_default',
    cursor: searchParams.get('cursor') ?? undefined,
    limit,
  };
}
