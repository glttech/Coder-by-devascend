import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const COMMENT_MAX_LENGTH = 10_000;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  try {
    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ comments });
  } catch (err) {
    console.error('[comments GET]', err);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  let body: string | undefined;
  try {
    const data = await req.json();
    body = data.body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });
  if (body.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Comment body exceeds ${COMMENT_MAX_LENGTH.toLocaleString()} character limit` },
      { status: 422 },
    );
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const comment = await prisma.comment.create({
      data: {
        taskId: params.id,
        authorId: user?.userId ?? 'anonymous',
        body: body.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        taskId: params.id,
        event: 'comment.added',
        details: `Comment added: ${comment.id}`,
        userId: user?.userId ?? null,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error('[comments POST]', err);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
