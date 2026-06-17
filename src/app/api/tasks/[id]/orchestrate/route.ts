/**
 * POST /api/tasks/[id]/orchestrate — run an agent role on a task.
 *
 * Body: { roleKey: string, agentResponse?: string }
 *
 * Auth: any authenticated user.
 * The orchestrator runs the named role through the governance pipeline and
 * records an AgentRun. It NEVER sets Approval.approved — that requires
 * a human action via /api/approvals.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { runOrchestrator } from '@/lib/agents/orchestrator';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  // Auth
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { roleKey, agentResponse } = body;
  if (!roleKey || typeof roleKey !== 'string') {
    return NextResponse.json({ error: 'roleKey is required' }, { status: 400 });
  }

  // Fetch the task
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Run the orchestrator
  let result;
  try {
    result = await runOrchestrator({
      taskId: task.id,
      taskTitle: task.title,
      taskInstruction: task.instruction,
      riskLevel: task.riskLevel,
      environment: task.environment,
      roleKey,
      agentResponse: typeof agentResponse === 'string' ? agentResponse : undefined,
      userId: user?.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Orchestration failed';
    // Role not found or role cannot act on this risk level
    if (
      message.startsWith('Unknown agent role') ||
      message.includes('not authorized to act on')
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[orchestrate POST]', err);
    return NextResponse.json({ error: 'Internal orchestration error' }, { status: 500 });
  }

  // Persist an AgentRun record with role metadata
  const agentRun = await prisma.agentRun.create({
    data: {
      taskId: task.id,
      generatedPrompt: task.instruction,
      selectedTool: 'agent-role',
      response: typeof agentResponse === 'string' ? agentResponse : null,
      status: 'succeeded',
      roleKey: result.roleKey,
      modelUsed: result.structuredOutput.findings[0]
        ? 'stub'
        : null,
      structuredOutput: JSON.stringify(result.structuredOutput),
      riskScore: result.riskScore,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
    },
  });

  return NextResponse.json({ agentRunId: agentRun.id, result });
}
