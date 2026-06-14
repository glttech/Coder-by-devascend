import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; milestoneId: string } },
) {
  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: params.milestoneId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (milestone.projectId !== params.id) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    return NextResponse.json(milestone);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch milestone' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; milestoneId: string } },
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

  const { title, description, targetDate, status } = body;

  const errors: string[] = [];
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      errors.push('title must be a non-empty string');
    } else if ((title as string).length > 200) {
      errors.push('title must be 200 characters or fewer');
    }
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }
  if (targetDate !== undefined && targetDate !== null) {
    const d = new Date(targetDate as string);
    if (isNaN(d.getTime())) {
      errors.push('targetDate must be a valid date');
    }
  }
  if (status !== undefined && !['open', 'completed'].includes(status as string)) {
    errors.push('status must be "open" or "completed"');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const existing = await prisma.milestone.findUnique({ where: { id: params.milestoneId } });
    if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (existing.projectId !== params.id) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = (title as string).trim();
    if (description !== undefined) updateData.description = description ? (description as string).trim() : null;
    if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate as string) : null;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.milestone.update({
      where: { id: params.milestoneId },
      data: updateData,
    });

    if (status !== undefined && status !== existing.status) {
      await writeAudit({
        event: 'milestone_status_changed',
        details: JSON.stringify({ milestoneId: params.milestoneId, projectId: params.id, from: existing.status, to: status, at: new Date().toISOString() }),
        userId: currentUser?.userId ?? null,
      });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; milestoneId: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  try {
    const existing = await prisma.milestone.findUnique({ where: { id: params.milestoneId } });
    if (!existing) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    if (existing.projectId !== params.id) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    // Unlink tasks first
    await prisma.task.updateMany({
      where: { milestoneId: params.milestoneId },
      data: { milestoneId: null },
    });

    await prisma.milestone.delete({ where: { id: params.milestoneId } });

    await writeAudit({
      event: 'milestone_deleted',
      details: JSON.stringify({ milestoneId: params.milestoneId, projectId: params.id, title: existing.title, at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}
