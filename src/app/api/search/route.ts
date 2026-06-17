import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type SearchResult = {
  id: string;
  type: 'task' | 'project' | 'instruction';
  title: string;
  subtitle?: string;
  url: string;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  if (q.length < 2) return NextResponse.json({ results: [] });

  const [tasks, projects, instructions] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { instruction: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, status: true, riskLevel: true },
      take: limit,
    }),
    prisma.project.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, name: true, description: true },
      take: limit,
    }),
    prisma.instruction.findMany({
      where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, status: true, taskId: true },
      take: limit,
    }),
  ]);

  const results: SearchResult[] = [
    ...tasks.map(t => ({ id: t.id, type: 'task' as const, title: t.title, subtitle: `${t.status} · ${t.riskLevel} risk`, url: `/tasks/${t.id}` })),
    ...projects.map(p => ({ id: p.id, type: 'project' as const, title: p.name, subtitle: p.description ?? undefined, url: `/projects/${p.id}` })),
    ...instructions.map(i => ({ id: i.id, type: 'instruction' as const, title: i.title, subtitle: i.status, url: `/tasks/${i.taskId}` })),
  ];

  return NextResponse.json({ results: results.slice(0, limit) });
}
