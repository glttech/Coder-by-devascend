import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';

// POST /api/agent-runs/[id]/approve-sandbox
// Auth: admin only
// Moves a "preview" run to "queued" status (ready for real execution).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const auth = requireRole(currentUser, 'admin');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  const agentRun = await prisma.agentRun.findUnique({
    where: { id: params.id },
    select: { id: true, taskId: true, status: true },
  });

  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  if (agentRun.status !== 'preview') {
    return NextResponse.json(
      {
        error: `Agent run cannot be approved from status '${agentRun.status}'; expected 'preview'`,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.agentRun.update({
    where: { id: params.id },
    data: { status: 'queued' },
  });

  await writeAudit({
    taskId: agentRun.taskId,
    agentRunId: params.id,
    event: 'sandbox_approved',
    details: JSON.stringify({
      from: 'preview',
      to: 'queued',
      at: new Date().toISOString(),
    }),
    userId: (auth.user as import('@/lib/session').AppSession).userId,
  });

  return NextResponse.json(updated, { status: 200 });
}
