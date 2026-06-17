/**
 * GET /api/traces/[id] — single execution trace detail.
 *
 * Auth: any authenticated user.
 * Read-only — no write, update, or delete operations exist.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const trace = await prisma.executionTrace.findFirst({
    where: {
      id: params.id,
      orgId: 'org_default',
    },
  });

  if (!trace) {
    return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
  }

  return NextResponse.json({ trace });
}
