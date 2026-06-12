import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { computeStateVersion } from '@/lib/stateVersion';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';

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
  const currentUser = await getCurrentUser();
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
  } else if (title.length > 500) {
    errors.push('title must be 500 characters or fewer');
  }
  if (!instructionBody || typeof instructionBody !== 'string' || instructionBody.trim().length === 0) {
    errors.push('body is required');
  } else if (instructionBody.length > 50_000) {
    errors.push('body must be 50,000 characters or fewer');
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

    // Pre-generate the ID so stateVersion can be computed before the write,
    // allowing a single atomic create rather than a create+update two-phase write.
    const id = randomUUID();
    const resolvedTitle = title!.trim();
    const resolvedBody = instructionBody!.trim();
    const resolvedTaskId = taskId!.trim();

    const stateVersion = computeStateVersion({
      id,
      taskId: resolvedTaskId,
      title: resolvedTitle,
      body: resolvedBody,
      status: resolvedStatus,
    });

    const withVersion = await prisma.instruction.create({
      data: {
        id,
        taskId: resolvedTaskId,
        title: resolvedTitle,
        body: resolvedBody,
        status: resolvedStatus,
        stateVersion,
      },
    });

    await writeAudit({
      taskId: task.id,
      instructionId: withVersion.id,
      event: 'instruction_created',
      details: JSON.stringify({
        instructionId: withVersion.id,
        title: withVersion.title,
        status: withVersion.status,
        stateVersion,
      }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json({ instruction: withVersion }, { status: 201 });
  } catch (err) {
    console.error('[instructions POST]', err);
    return NextResponse.json({ error: 'Failed to create instruction' }, { status: 500 });
  }
}
