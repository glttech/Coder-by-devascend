import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { parseCliSessionParams } from '@/lib/coder/sessionParams';

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
  const { limit, cursor, taskId, status } = parseCliSessionParams(searchParams);

  try {
    const sessions = await prisma.cliSession.findMany({
      where: {
        ...(taskId ? { taskId } : {}),
        ...(status ? { status } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        task: { select: { id: true, title: true, projectId: true } },
      },
    });

    const nextCursor =
      sessions.length === limit ? sessions[sessions.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ sessions, nextCursor });
  } catch (err) {
    console.error('[coder/sessions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
