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
  const taskId = searchParams.get('taskId');
  const status = searchParams.get('status');

  const runs = await prisma.agentRun.findMany({
    where: {
      ...(taskId ? { taskId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      task: { select: { title: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 5000,
  });

  const headers = ['Run ID', 'Task', 'Tool', 'Status', 'Files Changed', 'Test Result', 'Commit Hash', 'Started At', 'Ended At'];
  const rows = runs.map(r => [
    r.id,
    r.task?.title ?? '',
    r.selectedTool,
    r.status,
    r.filesChanged ?? '',
    r.testResult ?? '',
    r.commitHash ?? '',
    r.startedAt ?? '',
    r.endedAt ?? '',
  ]);

  const csv = buildCsv(headers, rows);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="agent-runs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
