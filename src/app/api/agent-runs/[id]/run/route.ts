import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { canTransitionTo } from '@/lib/orchestration';
import { getProvider, MockAgentProvider } from '@/lib/providers';
import { writeAudit } from '@/lib/audit';
import { ingestRunResult } from '@/lib/runIngestion';
import type { AgentRunInput, AgentStepEvent } from '@/lib/providers';

// POST /api/agent-runs/[id]/run
// Auth: admin only
// Executes a queued agent run synchronously using the configured provider (falls back to mock).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const sessionUser = await getCurrentUser();
  const auth = requireRole(sessionUser, 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }
  const user = auth.user;

  const { id } = params;

  const agentRun = await prisma.agentRun.findUnique({
    where: { id },
    select: {
      id: true,
      taskId: true,
      status: true,
      generatedPrompt: true,
    },
  });

  if (!agentRun) {
    return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
  }

  const currentStatus = agentRun.status as Parameters<typeof canTransitionTo>[0];

  if (currentStatus !== 'queued') {
    return NextResponse.json(
      {
        error: `Agent run cannot be started from status '${currentStatus}'; expected 'queued'`,
      },
      { status: 422 },
    );
  }

  if (!canTransitionTo(currentStatus, 'running')) {
    return NextResponse.json(
      { error: `Transition from '${currentStatus}' to 'running' is not allowed` },
      { status: 422 },
    );
  }

  // Transition to running
  await prisma.agentRun.update({
    where: { id },
    data: { status: 'running' },
  });

  // Resolve provider: look up 'mock' in registry, or create a default instance
  const provider = getProvider('mock') ?? new MockAgentProvider({ delayMs: 100 });

  const input: AgentRunInput = {
    agentRunId: agentRun.id,
    taskId: agentRun.taskId,
    prompt: agentRun.generatedPrompt,
  };

  const capturedSteps: AgentStepEvent[] = [];
  let output: Awaited<ReturnType<typeof provider.run>>;
  try {
    // Use streaming if available so we can capture steps; fall back to run()
    if (provider.stream) {
      output = await provider.stream(input, (step) => capturedSteps.push(step));
    } else {
      output = await provider.run(input);
    }
  } catch (err) {
    // If the provider throws, mark as failed
    await prisma.agentRun.update({
      where: { id },
      data: { status: 'failed', endedAt: new Date() },
    });

    await writeAudit({
      taskId: agentRun.taskId,
      agentRunId: id,
      event: 'agent_run_failed',
      details: JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      }),
      userId: user.userId,
    });

    return NextResponse.json({ error: 'Provider threw an error' }, { status: 500 });
  }

  const finalStatus = output.status; // 'succeeded' | 'failed'

  // Transition to final status
  await prisma.agentRun.update({
    where: { id },
    data: {
      status: finalStatus,
      response: output.response,
      filesChanged: output.filesChanged,
      commandsRun: output.commandsRun,
      testResult: output.testResult,
      commitHash: output.commitHash,
      endedAt: new Date(),
    },
  });

  // Persist steps and evaluations for the completed run
  await ingestRunResult({ agentRunId: id, output, steps: capturedSteps });

  await writeAudit({
    taskId: agentRun.taskId,
    agentRunId: id,
    event: finalStatus === 'succeeded' ? 'agent_run_succeeded' : 'agent_run_failed',
    details: JSON.stringify({
      status: finalStatus,
      at: new Date().toISOString(),
    }),
    userId: user.userId,
  });

  return NextResponse.json(
    { agentRunId: id, status: finalStatus, response: output.response },
    { status: 200 },
  );
}
