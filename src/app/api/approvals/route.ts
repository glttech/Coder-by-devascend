import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkApprovalAllowed } from '@/lib/approvalGuard';

// POST /api/approvals – record an approval decision for a task.
// Body: { taskId: string, approved: boolean }
//
// An approval is only accepted when the task exists, actually requires
// approval, is not in a terminal state, and has not already been decided.
// Invalid transitions are rejected (404 / 422 / 409) so the approval gate
// cannot be bypassed by direct API calls.
export async function POST(request: Request) {
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

    // State guard — only allow decisions on tasks actually awaiting approval.
    const guard = checkApprovalAllowed({
      taskExists: task !== null,
      approvalRequired: task?.approvalRequired ?? false,
      taskStatus: task?.status ?? '',
      existingApproved: task?.approval?.approved,
    });
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    // Upsert approval record. The guard above guarantees no prior decision
    // exists, so this records the first (and only) decision for the task.
    const approval = await prisma.approval.upsert({
      where: { taskId },
      update: { approved },
      create: { taskId, approved },
    });

    // Record the decision in the audit trail.
    await prisma.auditLog.create({
      data: {
        taskId,
        event: 'task_approval_decided',
        details: JSON.stringify({
          taskId,
          approved,
          at: new Date().toISOString(),
        }),
      },
    });

    // Task status is not changed by approval — approval state is tracked via the Approval model.
    return NextResponse.json(approval, { status: 200 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to update approval' }), { status: 500 });
  }
}
