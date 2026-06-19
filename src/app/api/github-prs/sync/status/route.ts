import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET /api/github-prs/sync/status?projectId=xxx
 * Returns current sync state for a project so the UI can poll for progress.
 * Auth: any authenticated user.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const syncState = await prisma.prSyncState.findUnique({
    where: { projectId },
    select: {
      syncStatus: true,
      totalSynced: true,
      lastSyncedAt: true,
      errorMessage: true,
      updatedAt: true,
    },
  });

  if (!syncState) {
    return NextResponse.json({
      syncStatus: 'idle',
      totalSynced: 0,
      lastSyncedAt: null,
      errorMessage: null,
      updatedAt: null,
    });
  }

  return NextResponse.json({
    syncStatus: syncState.syncStatus,
    totalSynced: syncState.totalSynced,
    lastSyncedAt: syncState.lastSyncedAt?.toISOString() ?? null,
    errorMessage: syncState.errorMessage ?? null,
    updatedAt: syncState.updatedAt.toISOString(),
  });
}
