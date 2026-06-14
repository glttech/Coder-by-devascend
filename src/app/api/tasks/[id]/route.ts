import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_ENVIRONMENTS = ['local', 'dev', 'staging', 'production'];
const VALID_STATUSES = ['pending', 'running', 'completed', 'failed'];
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

// GET /api/tasks/[id] — return a single task with relations.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: { project: true, approval: true },
    });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
  } catch (err) {
    console.error('[tasks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] — update editable task fields.
// Accepts any subset of: title, instruction, riskLevel, environment, approvalRequired, status.
// Blocked when the task is in a terminal status (completed / failed) — unless the field being
// changed is `status` itself (which allows moving a task out of terminal via the Kanban board).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, instruction, riskLevel, environment, approvalRequired, status } = body;

  const errors: string[] = [];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      errors.push('title must be a non-empty string');
    } else if (title.length > 500) {
      errors.push('title must be 500 characters or fewer');
    }
  }

  if (instruction !== undefined) {
    if (typeof instruction !== 'string' || instruction.trim().length === 0) {
      errors.push('instruction must be a non-empty string');
    } else if (instruction.length > 50_000) {
      errors.push('instruction must be 50,000 characters or fewer');
    }
  }

  if (riskLevel !== undefined && !VALID_RISK_LEVELS.includes(riskLevel as string)) {
    errors.push(`riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`);
  }

  if (environment !== undefined && !VALID_ENVIRONMENTS.includes(environment as string)) {
    errors.push(`environment must be one of: ${VALID_ENVIRONMENTS.join(', ')}`);
  }

  if (approvalRequired !== undefined && typeof approvalRequired !== 'boolean') {
    errors.push('approvalRequired must be a boolean');
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // When only changing status, allow moves out of terminal states (Kanban board use case).
    // For all other field edits, block if in terminal status.
    const onlyStatusChange = status !== undefined && Object.keys(body).length === 1;
    if (TERMINAL_STATUSES.has(existing.status) && !onlyStatusChange) {
      return NextResponse.json(
        { error: `Task is in terminal status '${existing.status}' and cannot be edited` },
        { status: 409 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = (title as string).trim();
    if (instruction !== undefined) updateData.instruction = (instruction as string).trim();
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (environment !== undefined) updateData.environment = environment;
    if (approvalRequired !== undefined) updateData.approvalRequired = approvalRequired;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: updateData,
    });

    await writeAudit({
      taskId: params.id,
      event: 'task_edited',
      details: JSON.stringify({ fields: Object.keys(updateData), at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[tasks PATCH]', err);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
