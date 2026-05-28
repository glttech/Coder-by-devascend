import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { analyzeRisk } from '@/lib/riskAnalyzer';
import { checkMissingEvidence } from '@/lib/evidenceChecker';
import { computeDecision } from '@/lib/decisionEngine';
import { generateNextPrompt } from '@/lib/nextPromptGenerator';
import { parseLines, enrichSession } from '@/lib/sessionHelpers';

export const dynamic = 'force-dynamic';

// PATCH /api/operator-sessions/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await prisma.operatorSession.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const {
    agentTool,
    agentResponse,
    operatorInput,
    generatedPrompt,
    validationOutput,
    reviewerNotes,
  } = body as Record<string, string | undefined>;

  const filesMentioned = body.filesMentioned !== undefined
    ? parseLines(body.filesMentioned)
    : existing.filesMentioned;
  const commandsMentioned = body.commandsMentioned !== undefined
    ? parseLines(body.commandsMentioned)
    : existing.commandsMentioned;

  try {
    const task = await prisma.task.findUnique({ where: { id: existing.taskId } });
    if (!task) {
      return NextResponse.json({ error: 'Associated task not found' }, { status: 404 });
    }

    const resolvedResponse = agentResponse ?? existing.agentResponse ?? undefined;
    const resolvedValidation = validationOutput ?? existing.validationOutput ?? undefined;
    const resolvedInput = operatorInput ?? existing.operatorInput ?? undefined;
    const resolvedReviewer = reviewerNotes ?? existing.reviewerNotes ?? undefined;

    const combinedText = [resolvedResponse, resolvedValidation, resolvedInput]
      .filter(Boolean)
      .join('\n');
    const riskFlags = analyzeRisk(combinedText);
    const missingEvidence = checkMissingEvidence({
      agentResponse: resolvedResponse ?? null,
      filesMentioned,
      commandsMentioned,
      validationOutput: resolvedValidation ?? null,
      reviewerNotes: resolvedReviewer ?? null,
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

    const updated = await prisma.operatorSession.update({
      where: { id: params.id },
      data: {
        agentTool: agentTool !== undefined ? agentTool : existing.agentTool,
        agentResponse: agentResponse !== undefined ? agentResponse : existing.agentResponse,
        operatorInput: operatorInput !== undefined ? operatorInput : existing.operatorInput,
        generatedPrompt: generatedPrompt !== undefined ? generatedPrompt : existing.generatedPrompt,
        validationOutput: validationOutput !== undefined ? validationOutput : existing.validationOutput,
        reviewerNotes: reviewerNotes !== undefined ? reviewerNotes : existing.reviewerNotes,
        filesMentioned,
        commandsMentioned,
        riskFlags: riskFlags.map((f) => f.key),
        missingEvidence: missingEvidence.map((e) => e.key),
        recommendedAction: decision.code,
        seniorApprovalRequired: decision.seniorApprovalRequired,
        decisionReason: decision.reason,
        nextPrompt,
        currentStep: existing.currentStep + 1,
      },
    });

    await prisma.auditLog.create({
      data: {
        taskId: existing.taskId,
        operatorSessionId: updated.id,
        event: 'operator_session_updated',
        details: JSON.stringify({
          sessionId: updated.id,
          step: updated.currentStep,
          recommendedAction: decision.code,
          seniorApprovalRequired: decision.seniorApprovalRequired,
          riskFlagCount: riskFlags.length,
        }),
      },
    });

    return NextResponse.json({ session: enrichSession(updated) });
  } catch (err) {
    console.error('[operator-sessions PATCH]', err);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
