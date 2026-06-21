import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { validateSessionIntelligencePatch } from '@/lib/coder/sessionIntelligenceParams';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  try {
    const session = await prisma.cliSession.findUnique({
      where: { id: params.id },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        repository: { select: { id: true, fullName: true } },
        repositoryPRs: {
          select: {
            id: true,
            prNumber: true,
            title: true,
            state: true,
            merged: true,
            ciStatus: true,
            prUrl: true,
            sourceBranch: true,
          },
          orderBy: { prNumber: 'desc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error('[coder/sessions/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let patch;
  try {
    patch = validateSessionIntelligencePatch(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  try {
    const existing = await prisma.cliSession.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const updated = await prisma.cliSession.update({
      where: { id: params.id },
      data: patch,
      select: {
        id: true,
        summary: true,
        failureReason: true,
        filesChanged: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[coder/sessions/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
