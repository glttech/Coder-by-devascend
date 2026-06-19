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
    const comment = await prisma.comment.findUnique({ where: { id: params.commentId } });
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.comment.delete({ where: { id: params.commentId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[comments DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
