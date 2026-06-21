import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { validateRepositoryPatch } from '@/lib/coder/repositoryParams';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const repo = await prisma.repository.findUnique({
    where: { id: params.id },
    include: {
      repositoryPRs: {
        orderBy: { githubUpdatedAt: 'desc' },
        take: 100,
      },
      _count: { select: { cliSessions: true } },
    },
  });

  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(repo);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const repo = await prisma.repository.findUnique({ where: { id: params.id } });
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let patch: ReturnType<typeof validateRepositoryPatch>;
  try {
    patch = validateRepositoryPatch(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const updated = await prisma.repository.update({ where: { id: params.id }, data: patch });
  return NextResponse.json(updated);
}
