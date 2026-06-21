import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { parseControlRoomParams } from '@/lib/coder/controlRoomParams';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const params = parseControlRoomParams(req.nextUrl.searchParams);
  const cursorDate = params.cursor ? new Date(params.cursor) : undefined;

  const [tasks, sessions, prs] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...(params.taskId ? { id: params.taskId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(cursorDate ? { updatedAt: { lt: cursorDate } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: params.limit,
      select: {
        id: true,
        title: true,
        status: true,
        riskLevel: true,
        updatedAt: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        approval: { select: { approved: true } },
      },
    }),
    prisma.cliSession.findMany({
      where: {
        ...(params.taskId ? { taskId: params.taskId } : {}),
        ...(params.repoId ? { repoId: params.repoId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      select: {
        id: true,
        command: true,
        workingDir: true,
        status: true,
        exitCode: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        task: { select: { id: true, title: true } },
        repository: { select: { id: true, fullName: true } },
      },
    }),
    prisma.repositoryPR.findMany({
      where: {
        ...(params.repoId ? { repoId: params.repoId } : {}),
        ...(params.taskId ? { taskId: params.taskId } : {}),
        ...(cursorDate ? { githubUpdatedAt: { lt: cursorDate } } : {}),
      },
      orderBy: { githubUpdatedAt: 'desc' },
      take: params.limit,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        author: true,
        ciStatus: true,
        prUrl: true,
        sourceBranch: true,
        githubUpdatedAt: true,
        syncedAt: true,
        repository: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true } },
      },
    }),
  ]);

  type TaskEntry = {
    kind: 'task';
    ts: string;
    task: typeof tasks[number];
  };
  type SessionEntry = {
    kind: 'session';
    ts: string;
    session: typeof sessions[number];
  };
  type PrEntry = {
    kind: 'pr';
    ts: string;
    pr: typeof prs[number];
  };
  type Entry = TaskEntry | SessionEntry | PrEntry;

  const entries: Entry[] = [
    ...tasks.map((t) => ({ kind: 'task' as const, ts: t.updatedAt.toISOString(), task: t })),
    ...sessions.map((s) => ({ kind: 'session' as const, ts: s.createdAt.toISOString(), session: s })),
    ...prs.map((p) => ({
      kind: 'pr' as const,
      ts: (p.githubUpdatedAt ?? p.syncedAt).toISOString(),
      pr: p,
    })),
  ];

  entries.sort((a, b) => b.ts.localeCompare(a.ts));
  const page = entries.slice(0, params.limit);
  const nextCursor = page.length === params.limit ? page[page.length - 1].ts : null;

  return NextResponse.json({ entries: page, nextCursor });
}
