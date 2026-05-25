import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'blocked',
] as const;

type InstructionStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(value: string): value is InstructionStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}

// POST /api/instructions — create a new instruction linked to a task.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId, title, body: instructionBody, status } = body as Record<string, string | undefined>;

  const errors: string[] = [];
  if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
    errors.push('taskId is required');
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required');
  }
  if (!instructionBody || typeof instructionBody !== 'string' || instructionBody.trim().length === 0) {
    errors.push('body is required');
  }
  if (status !== undefined && !isValidStatus(status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId!.trim() } });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const resolvedStatus: InstructionStatus = status && isValidStatus(status) ? status : 'draft';

    const instruction = await prisma.instruction.create({
      data: {
        taskId: taskId!.trim(),
        title: title!.trim(),
        body: instructionBody!.trim(),
        status: resolvedStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        taskId: task.id,
        instructionId: instruction.id,
        event: 'instruction_created',
        details: JSON.stringify({
          instructionId: instruction.id,
          title: instruction.title,
          status: instruction.status,
        }),
      },
    });

    return NextResponse.json({ instruction }, { status: 201 });
  } catch (err) {
    console.error('[instructions POST]', err);
    return NextResponse.json({ error: 'Failed to create instruction' }, { status: 500 });
  }
}
