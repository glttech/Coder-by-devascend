/**
 * GET /api/traces/export — CSV export of execution traces.
 *
 * Query params:
 *   ?taskId=  — optional, filter by task ID
 *
 * Auth: any authenticated user.
 * Columns: ID, Task ID, Role, Model, Decision Code, Risk Score, Approval State, Created At
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { buildCsv } from '@/lib/csv';

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

  const headers = ['ID', 'Task ID', 'Role', 'Model', 'Decision Code', 'Risk Score', 'Approval State', 'Created At'];

  const rows = traces.map((t) => [
    t.id,
    t.taskId ?? '',
    t.roleKey ?? '',
    t.modelUsed ?? '',
    t.decisionCode ?? '',
    t.riskScore != null ? String(t.riskScore) : '',
    t.approvalState ?? '',
    t.createdAt.toISOString(),
  ]);

  const csv = buildCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="execution-traces.csv"',
    },
  });
}
