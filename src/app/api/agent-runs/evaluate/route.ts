import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { evaluatePrompt } from '@/lib/promptEval';
import { checkRiskGate } from '@/lib/riskGate';

// POST /api/agent-runs/evaluate
// Body: { taskId: string, prompt: string }
// Auth: admin only
// Evaluates a prompt's quality and checks risk gate conditions for a task.
// Returns promptEval, riskGate, and overallAllowed for pre-dispatch inspection.
export async function POST(request: Request) {
  const sessionUser = await getCurrentUser();
  const auth = requireRole(sessionUser, 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  let body: { taskId?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId, prompt } = body;

  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Load the task with fields needed for evaluation.
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      riskLevel: true,
      environment: true,
      approvalRequired: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Load approval record if one exists.
  const approval = await prisma.approval.findUnique({
    where: { taskId },
    select: { approved: true },
  });

  const hasApproval = approval?.approved === true;

  // Run prompt quality evaluation.
  const promptEval = evaluatePrompt({
    prompt,
    taskTitle: task.title,
    riskLevel: task.riskLevel,
  });

  // Run risk gate check.
  const riskGate = checkRiskGate({
    riskLevel: task.riskLevel,
    environment: task.environment,
    approvalRequired: task.approvalRequired,
    hasApproval,
    promptScore: promptEval.score,
  });

  const overallAllowed = promptEval.passed && riskGate.allowed;

  return NextResponse.json(
    { promptEval, riskGate, overallAllowed },
    { status: 200 },
  );
}
