import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const VALID_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

// GET /api/incidents/[id] — full incident detail
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: params.id },
      include: {
        task: { include: { project: true } },
        agentRun: { select: { id: true, status: true, selectedTool: true } },
      },
    });
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    return NextResponse.json(incident);
  } catch (err) {
    console.error('[incidents GET]', err);
    return NextResponse.json({ error: 'Failed to fetch incident' }, { status: 500 });
  }
}

// PATCH /api/incidents/[id] — update status, followUpAction, resolvedBy
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'admin');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status, followUpAction, resolvedBy } = body;

  const errors: string[] = [];
  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const existing = await prisma.incident.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (followUpAction !== undefined) updateData.followUpAction = followUpAction;
    if (resolvedBy !== undefined) updateData.resolvedBy = resolvedBy;

    // Set resolvedAt when transitioning to resolved or closed
    if (status === 'resolved' || status === 'closed') {
      if (!existing.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const updated = await prisma.incident.update({
      where: { id: params.id },
      data: updateData,
    });

    // Write audit on status change
    if (status !== undefined && status !== existing.status) {
      // Append to timeline
      let timeline: Array<{ timestamp: string; event: string; actor?: string }> = [];
      try {
        timeline = JSON.parse(existing.timeline ?? '[]');
      } catch {
        timeline = [];
      }
      timeline.push({
        timestamp: new Date().toISOString(),
        event: `Status changed from ${existing.status} to ${status}`,
        actor: currentUser?.userId ?? 'system',
      });
      await prisma.incident.update({
        where: { id: params.id },
        data: { timeline: JSON.stringify(timeline) },
      });

      await writeAudit({
        taskId: existing.taskId ?? undefined,
        agentRunId: existing.agentRunId ?? undefined,
        event: 'incident_status_changed',
        details: JSON.stringify({ incidentId: params.id, from: existing.status, to: status }),
        userId: currentUser?.userId ?? null,
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[incidents PATCH]', err);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}
