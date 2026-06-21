import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { syncRepositoryPRs } from '@/lib/coder/githubSync';

export const dynamic = 'force-dynamic';

interface RouteContext { params: { id: string } }

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const repo = await prisma.repository.findUnique({ where: { id: params.id } });
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (repo.syncStatus === 'syncing') {
    return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
  }

  const result = await syncRepositoryPRs(params.id, repo.owner, repo.repo);

  return NextResponse.json({
    syncStatus: result.errors.length > 0 ? 'error' : 'synced',
    imported: result.imported,
    updated: result.updated,
    errors: result.errors,
  });
}
