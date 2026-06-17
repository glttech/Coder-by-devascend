import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { getFeatureFlags } from '@/lib/featureFlags';
import { resolveDispatch } from '@/lib/dispatchGate';
import { writeAudit } from '@/lib/audit';

// GET /api/agent-runs?taskId=<optional>
// Auth: admin or reviewer
// Returns list of agent runs, optionally filtered by taskId, ordered by startedAt desc, limit 50.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId') ?? undefined;

  const agentRuns = await prisma.agentRun.findMany({
    where: taskId ? { taskId } : undefined,
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      taskId: true,
      status: true,
      selectedTool: true,
      startedAt: true,
      endedAt: true,
      task: { select: { title: true } },
    },
  });

  return NextResponse.json({ agentRuns });
}

// POST /api/agent-runs
// Body: { taskId: string }
// Auth: admin only
// Dispatches a new agent run for the given task, applying the approval gate.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { taskId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId } = body;
  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  // Load the task, including the fields needed by the dispatch gate.
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, approvalRequired: true, riskLevel: true },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const flags = getFeatureFlags();

  const decision = resolveDispatch({
    approvalRequired: task.approvalRequired,
    riskLevel: task.riskLevel,
    orchestrationEnabled: flags.orchestrationEnabled,
  });

  if (decision.action === 'reject') {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const status = decision.action === 'await_approval' ? 'awaiting_approval' : 'queued';

  const agentRun = await prisma.agentRun.create({
    data: {
      taskId,
      generatedPrompt: '',
      selectedTool: '',
      status,
    },
  });

  await writeAudit({
    taskId,
    agentRunId: agentRun.id,
    event: 'agent_run_dispatched',
    details: JSON.stringify({
      status,
      decision: decision.action,
      ...(decision.action === 'await_approval' ? { reason: decision.reason } : {}),
      at: new Date().toISOString(),
    }),
    userId: user.userId,
  });

  const httpStatus = status === 'awaiting_approval' ? 202 : 201;
  const message =
    status === 'awaiting_approval'
      ? 'Agent run is awaiting approval'
      : 'Agent run has been queued';

  return NextResponse.json({ agentRunId: agentRun.id, status, message }, { status: httpStatus });
}
