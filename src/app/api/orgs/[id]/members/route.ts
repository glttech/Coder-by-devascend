import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

// GET /api/orgs/[id]/members
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  // Verify caller is a member of this org
  const callerMembership = await prisma.membership.findUnique({
    where: { orgId_userId: { orgId: params.id, userId: check.user.userId } },
  });
  if (!callerMembership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const members = await prisma.membership.findMany({
    where: { orgId: params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ members });
}
