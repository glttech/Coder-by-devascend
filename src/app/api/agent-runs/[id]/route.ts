import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

// GET /api/agent-runs/[id]
// Auth: admin or reviewer
// Returns the agent run with its steps, evaluations, and parent task title.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const sessionUser = await getCurrentUser();
  const auth = requireRole(sessionUser, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { id } = params;

  const agentRun = await prisma.agentRun.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
      evaluations: {
        orderBy: { createdAt: 'asc' },
      },
      task: {
        select: { title: true },
      },
    },
  });

  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  return NextResponse.json({ agentRun }, { status: 200 });
}
