// Approval state guard.
//
// The /api/approvals route upserts an Approval record for a task. Without a
// state guard, any client can approve (or re-approve) any task regardless of
// whether that task is actually awaiting an approval decision. This module
// centralises the rules that decide whether an approval action is permitted,
// as a pure function so it can be unit-tested without a database.

export interface ApprovalGuardInput {
  /** Whether the target task exists. */
  taskExists: boolean;
  /** Task.approvalRequired — whether this task is part of an approval workflow at all. */
  approvalRequired: boolean;
  /** Task.status — "pending" | "running" | "completed" | "failed". */
  taskStatus: string;
  /** Existing Approval.approved value: null/undefined = not yet decided. */
  existingApproved: boolean | null | undefined;
}

export type ApprovalGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

// Task statuses from which an approval decision can no longer be made.
const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed']);

/**
 * Determine whether an approval/rejection action is allowed for a task.
 *
 * An approval is only allowed when the task:
 *  1. exists,
 *  2. actually requires approval,
 *  3. is not in a terminal state (completed/failed), and
 *  4. has not already had an approval decision recorded.
 *
 * Any other case is an invalid transition and is rejected.
 */
export function checkApprovalAllowed(input: ApprovalGuardInput): ApprovalGuardResult {
  if (!input.taskExists) {
    return { ok: false, status: 404, error: 'Task not found' };
  }

  if (!input.approvalRequired) {
    return {
      ok: false,
      status: 422,
      error: 'This task does not require approval and cannot be approved',
    };
  }

  if (TERMINAL_TASK_STATUSES.has(input.taskStatus)) {
    return {
      ok: false,
      status: 409,
      error: `Task is in terminal state '${input.taskStatus}' and can no longer be approved`,
    };
  }

  if (input.existingApproved === true || input.existingApproved === false) {
    return {
      ok: false,
      status: 409,
      error: 'An approval decision has already been recorded for this task and cannot be changed',
    };
  }

  return { ok: true };
}
