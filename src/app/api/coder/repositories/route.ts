import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { parseRepositoryListParams, validateRepositoryBody } from '@/lib/coder/repositoryParams';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const params = parseRepositoryListParams(req.nextUrl.searchParams);

  const repos = await prisma.repository.findMany({
    where: {
      orgId: params.orgId,
      ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
      ...(params.cursor ? { createdAt: { lt: new Date(params.cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    include: {
      _count: { select: { repositoryPRs: true, cliSessions: true } },
    },
  });

  const nextCursor = repos.length === PAGE_SIZE ? repos[repos.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({ repositories: repos, nextCursor });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let validated;
  try {
    validated = validateRepositoryBody(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const orgId = (body as Record<string, unknown>).orgId as string ?? 'org_default';

  const existing = await prisma.repository.findUnique({
    where: { orgId_owner_repo: { orgId, owner: validated.owner, repo: validated.repo } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Repository already registered' }, { status: 409 });
  }

  const repository = await prisma.repository.create({
    data: {
      orgId,
      name: validated.name,
      owner: validated.owner,
      repo: validated.repo,
      fullName: validated.fullName,
      defaultBranch: validated.defaultBranch,
      private: validated.private,
      description: validated.description,
      enabled: validated.enabled,
    },
  });

  return NextResponse.json(repository, { status: 201 });
}
