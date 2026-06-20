import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const VALID_REPO_URL_RE = /^https?:\/\//;

export async function GET() {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { _count: { select: { tasks: true, githubPRs: true } } },
    });
    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  const data = await request.json().catch(() => null);
  if (!data) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { name, description, repoOwner, repoName, defaultBranch } = data;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('name is required');
  } else if (name.length > 200) {
    errors.push('name must be 200 characters or fewer');
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') errors.push('description must be a string');
    else if (description.length > 2000) errors.push('description must be 2000 characters or fewer');
  }

  if (repoOwner !== undefined && repoOwner !== null) {
    if (typeof repoOwner !== 'string' || repoOwner.trim().length === 0) {
      errors.push('repoOwner must be a non-empty string');
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(repoOwner.trim())) {
      errors.push('repoOwner contains invalid characters');
    }
  }

  if (repoName !== undefined && repoName !== null) {
    if (typeof repoName !== 'string' || repoName.trim().length === 0) {
      errors.push('repoName must be a non-empty string');
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(repoName.trim())) {
      errors.push('repoName contains invalid characters');
    }
  }

  if (defaultBranch !== undefined && defaultBranch !== null) {
    if (typeof defaultBranch !== 'string' || defaultBranch.trim().length === 0) {
      errors.push('defaultBranch must be a non-empty string');
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        repoOwner: repoOwner?.trim() || null,
        repoName: repoName?.trim() || null,
        defaultBranch: defaultBranch?.trim() || 'main',
      },
    });
    await writeAudit({
      event: 'project_created',
      details: JSON.stringify({ projectId: project.id, name: project.name, repoOwner: project.repoOwner, repoName: project.repoName, at: new Date().toISOString() }),
      userId: currentUser?.userId ?? null,
    });
    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
