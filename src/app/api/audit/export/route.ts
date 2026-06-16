import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { buildCsv } from '@/lib/csv';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'admin');
  if (!check.ok) return NextResponse.json({ error: 'Forbidden' }, { status: check.status });

  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event');
  const taskId = searchParams.get('taskId');

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(event ? { event } : {}),
      ...(taskId ? { taskId } : {}),
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const headers = ['ID', 'Event', 'Actor', 'Task ID', 'Run ID', 'Details', 'Created At'];
  const rows = logs.map(l => [
    l.id,
    l.event,
    l.user ? (l.user.name ?? l.user.email) : 'system',
    l.taskId ?? '',
    l.agentRunId ?? '',
    l.details ? l.details : '',
    l.createdAt,
  ]);

  const csv = buildCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
