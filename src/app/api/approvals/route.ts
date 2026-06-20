import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { checkApprovalAllowed } from '@/lib/approvalGuard';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { triggerWebhooks } from '@/lib/webhookDelivery';

// POST /api/approvals – record an approval decision for a task.
// Body: { taskId: string, approved: boolean }
//
// An approval is only accepted when the task exists, actually requires
// approval, is not in a terminal state, and has not already been decided.
// Invalid transitions are rejected (404 / 422 / 409) so the approval gate
// cannot be bypassed by direct API calls.
//
// Concurrency: the decision write is atomic. Two simultaneous requests cannot
// both succeed — the unique constraint on Approval.taskId admits only one
// create, and the conditional updateMany (where approved is still null) admits
// only one decision on an undecided row. The loser receives a 409.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  const data = await request.json();
  const { taskId, approved } = data;
  if (!taskId || typeof approved !== 'boolean') {
    return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  try {
    // Load the target task and any existing approval decision.
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { approval: true },
    });

    // State guard — produces friendly status codes for the non-concurrent cases
    // (missing task, approval not required, terminal task, already decided).
    const guard = checkApprovalAllowed({
      taskExists: task !== null,
      approvalRequired: task?.approvalRequired ?? false,
      taskStatus: task?.status ?? '',
      existingApproved: task?.approval?.approved,
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    // Atomic decision write. The guard above can race with a concurrent request
    // (both read approved=null then both try to write), so the write itself must
    // be the source of truth for "exactly one decision".
    const ALREADY_DECIDED = {
      error: 'An approval decision has already been recorded for this task and cannot be changed',
    };

    const approverId = currentUser?.userId ?? null;

    let approval;
    try {
      // First decision: create relies on the unique constraint on taskId.
      approval = await prisma.approval.create({ data: { taskId, approved, approverId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // A row already exists. Flip it only if it is still undecided; the
        // `approved: null` predicate is re-evaluated under a row lock, so at
        // most one concurrent request matches.
        const updated = await prisma.approval.updateMany({
          where: { taskId, approved: null },
          data: { approved, approverId },
        });
        if (updated.count === 0) {
          return NextResponse.json(ALREADY_DECIDED, { status: 409 });
        }
        approval = await prisma.approval.findUnique({ where: { taskId } });
      } else {
        throw err;
      }
    }

    // Record the decision in the audit trail — only after a decision was written.
    await writeAudit({
      taskId,
      event: 'task_approval_decided',
      details: JSON.stringify({
        taskId,
        approved,
        at: new Date().toISOString(),
      }),
      userId: currentUser?.userId ?? null,
    });

    // Advance task status: an accepted approval means work can begin.
    // Only move forward from 'pending' — do not overwrite 'running'/'completed'/'failed'.
    if (approved === true && task?.status === 'pending') {
      await prisma.task.update({ where: { id: taskId }, data: { status: 'running' } });
      await writeAudit({
        taskId,
        event: 'task_status_changed',
        details: JSON.stringify({ from: 'pending', to: 'running', reason: 'approval_accepted', at: new Date().toISOString() }),
        userId: currentUser?.userId ?? null,
      });
    }

    // Fire-and-forget webhook delivery
    triggerWebhooks(approved ? 'approval.granted' : 'approval.rejected', {
      taskId,
      approved,
      approverId: currentUser?.userId ?? null,
    }).catch(() => {});

    return NextResponse.json(approval, { status: 200 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to update approval' }), { status: 500 });
  }
}
