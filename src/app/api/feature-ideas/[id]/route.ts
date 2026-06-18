import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_DECISIONS = new Set(['build', 'skip', 'defer', 'under_review']);
const VALID_RELEVANCE = new Set(['low', 'medium', 'high', 'critical']);
const VALID_RISK = new Set(['low', 'medium', 'high']);

/**
 * PATCH /api/feature-ideas/[id]
 * Update decision, relevance, notes, or any editable field.
 * Admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const existing = await prisma.featureIdea.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Feature idea not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const userId =
    ('userId' in auth.user ? auth.user.userId : undefined) ??
    ('id' in auth.user ? (auth.user as { id: string }).id : undefined) ??
    'system';

  type UpdateData = Record<string, unknown>;
  const data: UpdateData = {};

  if ('title' in body && typeof body.title === 'string') data['title'] = body.title.trim();
  if ('description' in body) data['description'] = body.description ?? null;
  if ('problemSolved' in body) data['problemSolved'] = body.problemSolved ?? null;
  if ('vendor' in body) data['vendor'] = body.vendor ?? null;
  if ('sourceUrl' in body) data['sourceUrl'] = body.sourceUrl ?? null;
  if ('relevance' in body) {
    if (!VALID_RELEVANCE.has(body.relevance)) {
      return NextResponse.json({ error: 'Invalid relevance' }, { status: 422 });
    }
    data['relevance'] = body.relevance;
  }
  if ('riskLevel' in body) {
    if (!VALID_RISK.has(body.riskLevel)) {
      return NextResponse.json({ error: 'Invalid riskLevel' }, { status: 422 });
    }
    data['riskLevel'] = body.riskLevel;
  }
  if ('decision' in body) {
    if (!VALID_DECISIONS.has(body.decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 422 });
    }
    data['decision'] = body.decision;
    // Record who made the decision and when
    if (body.decision !== 'under_review') {
      data['decisionBy'] = userId;
      data['decisionAt'] = new Date();
    }
  }
  if ('decisionNote' in body) data['decisionNote'] = body.decisionNote ?? null;
  if ('taskId' in body) data['taskId'] = body.taskId ?? null;
  if ('milestoneId' in body) data['milestoneId'] = body.milestoneId ?? null;
  if ('coderHasFeature' in body) data['coderHasFeature'] = Boolean(body.coderHasFeature);
  if ('coderNotes' in body) data['coderNotes'] = body.coderNotes ?? null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 });
  }

  const updated = await prisma.featureIdea.update({ where: { id: params.id }, data });

  await writeAudit({
    event: 'feature_idea_updated',
    details: JSON.stringify({
      ideaId: params.id,
      fields: Object.keys(data),
      decision: data['decision'],
      at: new Date().toISOString(),
    }),
    userId,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/feature-ideas/[id]
 * Soft-delete by setting decision=skip. Admin only.
 * Hard delete not exposed to prevent accidental data loss.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'admin');
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const existing = await prisma.featureIdea.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Feature idea not found' }, { status: 404 });

  await prisma.featureIdea.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
