import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  try {
    const session = await prisma.cliSession.findUnique({
      where: { id: params.id },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error('[coder/sessions/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
