import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.commentId },
      select: { id: true, taskId: true, authorId: true },
    });
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only the comment author or an admin may delete
    const isOwner = comment.authorId === (user?.userId ?? null);
    const isAdmin = user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: params.commentId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[comments DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
