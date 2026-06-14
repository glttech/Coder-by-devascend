import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const milestones = await prisma.milestone.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: { id: true, status: true },
        },
      },
    });

    return NextResponse.json(milestones);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}

export async function POST(
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

  const { title, description, targetDate } = body;

  const errors: string[] = [];
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required');
  } else if ((title as string).length > 200) {
    errors.push('title must be 200 characters or fewer');
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

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const milestone = await prisma.milestone.create({
      data: {
        projectId: params.id,
        title: (title as string).trim(),
        description: description ? (description as string).trim() : null,
        targetDate: targetDate ? new Date(targetDate as string) : null,
      },
    });

    await writeAudit({
      event: 'milestone_created',
      details: JSON.stringify({ milestoneId: milestone.id, projectId: params.id, title: milestone.title, at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}
