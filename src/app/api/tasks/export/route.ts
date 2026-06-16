import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { buildCsv } from '@/lib/csv';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const check = requireRole(user, 'any');
  if (!check.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: check.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const environment = searchParams.get('environment');

  const tasks = await prisma.task.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(environment ? { environment } : {}),
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const headers = ['ID', 'Title', 'Status', 'Priority', 'Risk Level', 'Environment', 'Project', 'Assignee', 'Approval Required', 'Due Date', 'Created At'];
  const rows = tasks.map(t => [
    t.id,
    t.title,
    t.status,
    t.priority,
    t.riskLevel,
    t.environment,
    t.project?.name ?? '',
    t.assignee ? (t.assignee.name ?? t.assignee.email) : '',
    t.approvalRequired ? 'Yes' : 'No',
    t.dueDate ?? '',
    t.createdAt,
  ]);

  const csv = buildCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tasks-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
