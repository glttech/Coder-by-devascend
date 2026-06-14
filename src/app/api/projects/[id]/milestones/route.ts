import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// GET /api/projects/[id]/milestones — return milestones for a project.
// Only authenticated users may list milestones.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const milestones = await prisma.milestone.findMany({
      where: { projectId: params.id },
      select: { id: true, title: true, status: true, targetDate: true },
      orderBy: { targetDate: 'asc' },
    });
    return NextResponse.json(milestones);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}
