import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { writeAudit } from '@/lib/audit';
import { getOrgId } from '@/lib/orgScope';

const VALID_STATUSES = ['new', 'triaging', 'escalated', 'closed'] as const;
const VALID_TRIAGE_RECOMMENDATIONS = ['acknowledge', 'escalate', 'close'] as const;

// GET /api/soc/alerts/[id] — fetch a single security alert.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const orgId = await getOrgId(user?.userId);

  try {
    const alert = await prisma.securityAlert.findUnique({
      where: { id: params.id },
    });
    // Return 404 for archived alerts or cross-org access (avoids info leak)
    if (!alert || alert.archivedAt !== null || alert.orgId !== orgId) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }
    return NextResponse.json({ alert });
  } catch (err) {
    console.error('[soc/alerts/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to fetch alert' }, { status: 500 });
  }
}

// PATCH /api/soc/alerts/[id] — update status, triage fields, or linked incident. Requires admin role.
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status, triageRecommendation, incidentId } = body;

  const errors: string[] = [];

  if (status !== undefined && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (
    triageRecommendation !== undefined &&
    !VALID_TRIAGE_RECOMMENDATIONS.includes(
      triageRecommendation as typeof VALID_TRIAGE_RECOMMENDATIONS[number],
    )
  ) {
    errors.push(`triageRecommendation must be one of: ${VALID_TRIAGE_RECOMMENDATIONS.join(', ')}`);
  }

  if (incidentId !== undefined && incidentId !== null && typeof incidentId !== 'string') {
    errors.push('incidentId must be a string or null');
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  const orgId = await getOrgId(user?.userId);

  try {
    const existing = await prisma.securityAlert.findUnique({ where: { id: params.id } });
    // Return 404 for archived alerts or cross-org access (avoids info leak)
    if (!existing || existing.archivedAt !== null || existing.orgId !== orgId) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (triageRecommendation !== undefined) updateData.triageRecommendation = triageRecommendation;
    if (incidentId !== undefined) updateData.incidentId = incidentId === null ? null : incidentId;

    // Record who triaged it and when status moves away from 'new'
    if (status !== undefined && status !== 'new' && existing.status === 'new') {
      updateData.triageBy = user?.userId ?? null;
      updateData.triagedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ alert: existing });
    }

    const alert = await prisma.securityAlert.update({
      where: { id: params.id },
      data: updateData,
    });

    await writeAudit({
      event: 'soc_alert_triaged',
      userId: user?.userId ?? null,
      details: JSON.stringify({
        alertId: alert.id,
        fields: Object.keys(updateData),
        newStatus: alert.status,
        at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ alert });
  } catch (err) {
    console.error('[soc/alerts/[id] PATCH]', err);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

// DELETE /api/soc/alerts/[id] — soft-delete (archive). Sets archivedAt; excluded from all queries. Requires admin role.
export async function DELETE(
  _request: Request,
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

  const orgId = await getOrgId(user?.userId);

  try {
    const existing = await prisma.securityAlert.findUnique({ where: { id: params.id } });
    if (!existing || existing.archivedAt !== null || existing.orgId !== orgId) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const alert = await prisma.securityAlert.update({
      where: { id: params.id },
      data: { archivedAt: new Date() },
    });

    await writeAudit({
      event: 'soc_alert_archived',
      userId: user?.userId ?? null,
      details: JSON.stringify({ alertId: alert.id, at: new Date().toISOString() }),
    });

    return NextResponse.json({ alert });
  } catch (err) {
    console.error('[soc/alerts/[id] DELETE]', err);
    return NextResponse.json({ error: 'Failed to archive alert' }, { status: 500 });
  }
}
