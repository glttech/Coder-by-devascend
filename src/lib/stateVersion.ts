import { createHash } from 'crypto';

/**
 * Stable fields included in the stateVersion hash.
 * Excludes volatile timestamps (createdAt, updatedAt, approvedAt, executingAt,
 * resolvedAt) so that clock drift or re-reads don't produce a new version.
 * updatedAt is intentionally excluded — the hash reflects *what* changed,
 * not *when* the row was touched.
 */
export interface StateVersionInput {
  id: string;
  taskId: string;
  title: string;
  body: string;
  status: string;
  approvedBy?: string | null;
  approvalNote?: string | null;
  blockedReason?: string | null;
  completedNotes?: string | null;
}

export function computeStateVersion(input: StateVersionInput): string {
  const canonical = JSON.stringify({
    id: input.id,
    taskId: input.taskId,
    title: input.title,
    body: input.body,
    status: input.status,
    approvedBy: input.approvedBy ?? null,
    approvalNote: input.approvalNote ?? null,
    blockedReason: input.blockedReason ?? null,
    completedNotes: input.completedNotes ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
