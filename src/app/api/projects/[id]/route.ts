import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        tasks: { orderBy: { createdAt: 'desc' }, take: 10 },
        githubPRs: { orderBy: { importedAt: 'desc' }, take: 10 },
        _count: { select: { tasks: true, githubPRs: true } },
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  const data = await request.json().catch(() => null);
  if (!data) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { name, description, repoOwner, repoName, defaultBranch } = data;
  const errors: string[] = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) errors.push('name must be a non-empty string');
    else if (name.length > 200) errors.push('name must be 200 characters or fewer');
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    errors.push('description must be a string');
  }
  if (repoOwner !== undefined && repoOwner !== null) {
    if (typeof repoOwner !== 'string' || repoOwner.trim().length === 0) errors.push('repoOwner must be a non-empty string');
    else if (!/^[a-zA-Z0-9_.-]+$/.test(repoOwner.trim())) errors.push('repoOwner contains invalid characters');
  }
  if (repoName !== undefined && repoName !== null) {
    if (typeof repoName !== 'string' || repoName.trim().length === 0) errors.push('repoName must be a non-empty string');
    else if (!/^[a-zA-Z0-9_.-]+$/.test(repoName.trim())) errors.push('repoName contains invalid characters');
  }
  if (defaultBranch !== undefined && defaultBranch !== null) {
    if (typeof defaultBranch !== 'string' || defaultBranch.trim().length === 0) errors.push('defaultBranch must be a non-empty string');
  }

  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 422 });

  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (repoOwner !== undefined) updateData.repoOwner = repoOwner?.trim() || null;
    if (repoName !== undefined) updateData.repoName = repoName?.trim() || null;
    if (defaultBranch !== undefined) updateData.defaultBranch = defaultBranch?.trim() || 'main';

    const project = await prisma.project.update({ where: { id: params.id }, data: updateData });
    await writeAudit({
      event: 'project_updated',
      details: JSON.stringify({ projectId: params.id, fields: Object.keys(updateData), at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
