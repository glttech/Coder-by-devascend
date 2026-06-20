import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { parseCoderTaskParams } from '@/lib/coder/taskParams';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const { limit, cursor, status, projectId } = parseCoderTaskParams(searchParams);

  try {
    // module discriminator filter ('coder') is added once the M-1 schema migration
    // (Task.module field) lands on this branch.
    const tasks = await prisma.task.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(projectId ? { projectId } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        project: { select: { id: true, name: true, repoOwner: true, repoName: true } },
        approval: { select: { id: true, approved: true, approverId: true } },
      },
    });

    const nextCursor =
      tasks.length === limit ? tasks[tasks.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ tasks, nextCursor });
  } catch (err) {
    console.error('[coder/tasks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
