import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { canTransitionTo } from '@/lib/orchestration';
import { writeAudit } from '@/lib/audit';

// POST /api/agent-runs/[id]/approve
// Auth: admin only
// Approves an agent run that is currently awaiting approval, transitioning it to 'queued'.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const agentRun = await prisma.agentRun.findUnique({
    where: { id },
    select: { id: true, taskId: true, status: true },
  });

  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  const currentStatus = agentRun.status as Parameters<typeof canTransitionTo>[0];

  if (currentStatus !== 'awaiting_approval') {
    return NextResponse.json(
      {
        error: `Agent run cannot be approved from status '${currentStatus}'; expected 'awaiting_approval'`,
      },
      { status: 422 },
    );
  }

  if (!canTransitionTo(currentStatus, 'queued')) {
    // Should not happen given the status check above, but guard defensively.
    return NextResponse.json(
      { error: `Transition from '${currentStatus}' to 'queued' is not allowed` },
      { status: 422 },
    );
  }

  const updated = await prisma.agentRun.update({
    where: { id },
    data: { status: 'queued' },
    select: { id: true, status: true },
  });

  await writeAudit({
    taskId: agentRun.taskId,
    agentRunId: id,
    event: 'agent_run_approved',
    details: JSON.stringify({
      from: currentStatus,
      to: 'queued',
      at: new Date().toISOString(),
    }),
    userId: user.userId,
  });

  return NextResponse.json({ agentRunId: updated.id, status: updated.status }, { status: 200 });
}
