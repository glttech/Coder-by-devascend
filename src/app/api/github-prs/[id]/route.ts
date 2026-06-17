import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_CLASSIFICATIONS = new Set([
  'feature', 'bug_fix', 'security', 'migration', 'deployment',
  'rollback', 'incident', 'chore', 'test', 'docs',
]);

const VALID_BUG_STATES = new Set([
  'known_issue', 'fixed', 'regression_risk', 'needs_retest',
]);

/**
 * PATCH /api/github-prs/[id]
 * Manual override for classification and/or bugState.
 * Sets classificationSource to "manual" so auto-sync won't overwrite it.
 *
 * Body: {
 *   classification?: PrClassificationType,
 *   bugState?: BugState | null,
 *   milestoneId?: string | null,
 *   agentRunId?: string | null,
 *   taskId?: string | null,
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { id } = params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Load existing PR
  const existing = await prisma.githubPR.findUnique({
    where: { id },
    select: { id: true, projectId: true, prNumber: true, classification: true, bugState: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'PR not found' }, { status: 404 });
  }

  // Validate and collect update fields
  type UpdateData = {
    classification?: string;
    classificationSource?: string;
    bugState?: string | null;
    milestoneId?: string | null;
    agentRunId?: string | null;
    taskId?: string | null;
  };
  const data: UpdateData = {};
  const updates: string[] = [];

  if ('classification' in body) {
    if (typeof body.classification !== 'string' || !VALID_CLASSIFICATIONS.has(body.classification)) {
      return NextResponse.json(
        { error: `classification must be one of: ${[...VALID_CLASSIFICATIONS].join(', ')}` },
        { status: 422 },
      );
    }
    data.classification = body.classification;
    data.classificationSource = 'manual';
    updates.push('classification');
  }

  if ('bugState' in body) {
    if (body.bugState !== null && (typeof body.bugState !== 'string' || !VALID_BUG_STATES.has(body.bugState))) {
      return NextResponse.json(
        { error: `bugState must be null or one of: ${[...VALID_BUG_STATES].join(', ')}` },
        { status: 422 },
      );
    }
    data.bugState = body.bugState;
    updates.push('bugState');
  }

  if ('milestoneId' in body) {
    data.milestoneId = typeof body.milestoneId === 'string' ? body.milestoneId : null;
    updates.push('milestoneId');
  }

  if ('agentRunId' in body) {
    data.agentRunId = typeof body.agentRunId === 'string' ? body.agentRunId : null;
    updates.push('agentRunId');
  }

  if ('taskId' in body) {
    data.taskId = typeof body.taskId === 'string' ? body.taskId : null;
    updates.push('taskId');
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
  }

  const updated = await prisma.githubPR.update({ where: { id }, data });

  await writeAudit({
    event: 'github_pr_classification_updated',
    details: JSON.stringify({
      prId: id,
      projectId: existing.projectId,
      prNumber: existing.prNumber,
      fields: updates,
      newClassification: data.classification,
      newBugState: data.bugState,
      at: new Date().toISOString(),
    }),
    userId:
      ('userId' in auth.user ? auth.user.userId : undefined) ??
      ('id' in auth.user ? (auth.user as { id: string }).id : undefined) ??
      null,
  });

  return NextResponse.json(updated);
}
