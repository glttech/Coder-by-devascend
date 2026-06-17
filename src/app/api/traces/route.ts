/**
 * GET /api/traces — list execution traces.
 *
 * Query params:
 *   ?taskId=  — optional, filter by task ID
 *
 * Returns the 50 most recent traces ordered by createdAt desc.
 * Auth: any authenticated user.
 * Read-only — no write, update, or delete endpoints exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId') ?? undefined;

  const traces = await prisma.executionTrace.findMany({
    where: {
      orgId: 'org_default',
      ...(taskId ? { taskId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ traces });
}
