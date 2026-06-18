import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';

// POST /api/agent-runs/[id]/reject-sandbox
// Auth: admin only
// Rejects a "preview" run, marking it as "failed".
export async function POST(
  request: Request,
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

  let reason: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.reason === 'string') {
      reason = body.reason;
    }
  } catch {
    // reason is optional; ignore parse errors
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
        error: `Agent run cannot be rejected from status '${agentRun.status}'; expected 'preview'`,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.agentRun.update({
    where: { id: params.id },
    data: {
      status: 'failed',
      response: reason ? `Sandbox rejected: ${reason}` : 'Sandbox rejected by reviewer',
      endedAt: new Date(),
    },
  });

  await writeAudit({
    taskId: agentRun.taskId,
    agentRunId: params.id,
    event: 'sandbox_rejected',
    details: JSON.stringify({
      from: 'preview',
      to: 'failed',
      reason: reason ?? null,
      at: new Date().toISOString(),
    }),
    userId: (auth.user as import('@/lib/session').AppSession).userId,
  });

  return NextResponse.json(updated, { status: 200 });
}
