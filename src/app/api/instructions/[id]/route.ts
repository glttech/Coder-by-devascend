import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Explicit allowed transitions — only forward moves plus → blocked from active states.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:            ['pending_approval'],
  pending_approval: ['approved', 'blocked'],
  approved:         ['executing', 'blocked'],
  executing:        ['completed', 'blocked'],
  completed:        [],
  blocked:          [],
};

// GET /api/instructions/[id] — return instruction details with linked task context.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const instruction = await prisma.instruction.findUnique({
      where: { id: params.id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            riskLevel: true,
            environment: true,
            agentTool: true,
          },
        },
      },
    });

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    return NextResponse.json({ instruction });
  } catch (err) {
    console.error('[instructions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch instruction' }, { status: 500 });
  }
}

// PATCH /api/instructions/[id] — perform a controlled lifecycle status transition.
// Body: { status, approvedBy?, approvalNote?, blockedReason?, completedNotes? }
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

  const { status: nextStatus, approvedBy, approvalNote, blockedReason, completedNotes } =
    body as Record<string, string | undefined>;

  if (!nextStatus || typeof nextStatus !== 'string') {
    return NextResponse.json({ error: 'status is required' }, { status: 422 });
  }

  try {
    const instruction = await prisma.instruction.findUnique({
      where: { id: params.id },
    });

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    const currentStatus = instruction.status;
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? [];

    // Terminal state guard.
    if (allowedNext.length === 0) {
      return NextResponse.json(
        {
          error: `Instruction is in terminal state '${currentStatus}' and cannot be transitioned`,
          currentStatus,
          allowedTransitions: [],
        },
        { status: 422 },
      );
    }

    // Valid transition guard.
    if (!allowedNext.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: '${currentStatus}' → '${nextStatus}'`,
          currentStatus,
          allowedTransitions: allowedNext,
        },
        { status: 422 },
      );
    }

    // Business rule: blocked requires a reason.
    if (nextStatus === 'blocked' && (!blockedReason || blockedReason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'blockedReason is required when transitioning to blocked' },
        { status: 422 },
      );
    }

    const now = new Date();

    // Build update payload — only set timestamp/metadata fields on the relevant transition.
    const updateData: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'approved') {
      updateData.approvedAt = now;
      if (approvedBy) updateData.approvedBy = approvedBy.trim();
      if (approvalNote) updateData.approvalNote = approvalNote.trim();
    }

    if (nextStatus === 'executing') {
      updateData.executingAt = now;
    }

    if (nextStatus === 'completed') {
      updateData.resolvedAt = now;
      if (completedNotes) updateData.completedNotes = completedNotes.trim();
    }

    if (nextStatus === 'blocked') {
      updateData.resolvedAt = now;
      updateData.blockedReason = blockedReason!.trim();
    }

    const updated = await prisma.instruction.update({
      where: { id: params.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        taskId: instruction.taskId,
        instructionId: instruction.id,
        event: 'instruction_status_changed',
        details: JSON.stringify({
          instructionId: instruction.id,
          taskId: instruction.taskId,
          previousStatus: currentStatus,
          nextStatus,
          ...(approvedBy ? { approvedBy } : {}),
          ...(approvalNote ? { approvalNote } : {}),
          ...(blockedReason ? { blockedReason } : {}),
          ...(completedNotes ? { completedNotes } : {}),
          at: now.toISOString(),
        }),
      },
    });

    return NextResponse.json({ instruction: updated });
  } catch (err) {
    console.error('[instructions PATCH]', err);
    return NextResponse.json({ error: 'Failed to update instruction' }, { status: 500 });
  }
}
