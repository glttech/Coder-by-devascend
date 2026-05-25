import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { analyzeRisk, getRiskFlagDetails } from '@/lib/riskAnalyzer';
import { checkMissingEvidence, getMissingEvidenceDetails } from '@/lib/evidenceChecker';
import { computeDecision } from '@/lib/decisionEngine';
import { generateNextPrompt } from '@/lib/nextPromptGenerator';

export const dynamic = 'force-dynamic';

function parseLines(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function enrichSession(session: {
  riskFlags: string[];
  missingEvidence: string[];
  [key: string]: unknown;
}) {
  return {
    ...session,
    riskFlagDetails: getRiskFlagDetails(session.riskFlags),
    missingEvidenceDetails: getMissingEvidenceDetails(session.missingEvidence),
  };
}

// GET /api/operator-sessions?taskId=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }
  try {
    const sessions = await prisma.operatorSession.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ sessions: sessions.map(enrichSession) });
  } catch (err) {
    console.error('[operator-sessions GET]', err);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

// POST /api/operator-sessions
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    taskId,
    agentTool,
    agentResponse,
    operatorInput,
    generatedPrompt,
    validationOutput,
    reviewerNotes,
  } = body as Record<string, string | undefined>;

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 422 });
  }

  const filesMentioned = parseLines(body.filesMentioned);
  const commandsMentioned = parseLines(body.commandsMentioned);

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Run analysis
    const combinedText = [agentResponse, validationOutput, operatorInput]
      .filter(Boolean)
      .join('\n');
    const riskFlags = analyzeRisk(combinedText);
    const missingEvidence = checkMissingEvidence({
      agentResponse: agentResponse ?? null,
      filesMentioned,
      commandsMentioned,
      validationOutput: validationOutput ?? null,
      reviewerNotes: reviewerNotes ?? null,
    });
    const decision = computeDecision({
      riskFlags,
      missingEvidence,
      filesMentioned,
      commandsMentioned,
      environment: task.environment,
    });
    const nextPrompt = generateNextPrompt({
      decision: decision.code,
      riskFlags,
      missingEvidence,
      taskTitle: task.title,
      filesMentioned,
    });

    const session = await prisma.operatorSession.create({
      data: {
        taskId,
        agentTool: agentTool ?? null,
        agentResponse: agentResponse ?? null,
        operatorInput: operatorInput ?? null,
        generatedPrompt: generatedPrompt ?? null,
        validationOutput: validationOutput ?? null,
        reviewerNotes: reviewerNotes ?? null,
        filesMentioned,
        commandsMentioned,
        riskFlags: riskFlags.map((f) => f.key),
        missingEvidence: missingEvidence.map((e) => e.key),
        recommendedAction: decision.code,
        seniorApprovalRequired: decision.seniorApprovalRequired,
        decisionReason: decision.reason,
        nextPrompt,
      },
    });

    await prisma.auditLog.create({
      data: {
        taskId,
        operatorSessionId: session.id,
        event: 'operator_session_created',
        details: JSON.stringify({
          sessionId: session.id,
          recommendedAction: decision.code,
          seniorApprovalRequired: decision.seniorApprovalRequired,
          riskFlagCount: riskFlags.length,
          missingEvidenceCount: missingEvidence.length,
        }),
      },
    });

    return NextResponse.json({ session: enrichSession(session) }, { status: 201 });
  } catch (err) {
    console.error('[operator-sessions POST]', err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
