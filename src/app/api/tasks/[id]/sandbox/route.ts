import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { getFeatureFlags } from '@/lib/featureFlags';
import { generateSandboxPlan } from '@/lib/sandboxPlanner';

// POST /api/tasks/[id]/sandbox
// Auth: admin only
// Creates a "preview" AgentRun without real execution.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const flags = getFeatureFlags();
  if (!flags.sandboxMode) {
    return NextResponse.json({ error: 'Sandbox mode is not enabled' }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  const auth = requireRole(currentUser, 'admin');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      instruction: true,
      riskLevel: true,
      environment: true,
      agentTool: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const plan = generateSandboxPlan({
    instruction: task.instruction,
    riskLevel: task.riskLevel,
    environment: task.environment,
    agentTool: task.agentTool,
  });

  // sandboxPlan is a new column not yet reflected in generated Prisma types;
  // cast data through unknown to include it without type errors.
  const agentRun = await prisma.agentRun.create({
    data: {
      taskId: params.id,
      generatedPrompt: '[SANDBOX] ' + task.instruction.slice(0, 500),
      selectedTool: task.agentTool,
      status: 'preview',
      response: null,
    } as unknown as Parameters<typeof prisma.agentRun.create>[0]['data'],
  });

  // Update sandboxPlan using raw SQL since the Prisma client type does not yet include it.
  await prisma.$executeRaw`UPDATE "AgentRun" SET "sandboxPlan" = ${JSON.stringify(plan)} WHERE "id" = ${agentRun.id}`;

  await writeAudit({
    taskId: params.id,
    agentRunId: agentRun.id,
    event: 'sandbox_preview_created',
    details: JSON.stringify({
      agentTool: task.agentTool,
      estimatedRisk: plan.estimatedRisk,
      requiresApproval: plan.requiresApproval,
      at: new Date().toISOString(),
    }),
    userId: (auth.user as import('@/lib/session').AppSession).userId,
  });

  return NextResponse.json({ agentRun, plan }, { status: 201 });
}
