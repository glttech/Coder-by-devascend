import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

const VALID_TRIGGERS = ['ci_failure', 'reviewer_block', 'policy_block', 'run_failure', 'manual_rollback'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

// GET /api/incidents — list all incidents ordered by createdAt desc
export async function GET() {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: roleCheck.status });
  }

  try {
    const incidents = await prisma.incident.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        task: { select: { id: true, title: true } },
        agentRun: { select: { id: true, status: true } },
      },
    });
    return NextResponse.json(incidents);
  } catch (err) {
    console.error('[incidents GET]', err);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

// POST /api/incidents — create an incident manually (admin only)
export async function POST(request: Request) {
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

  const { title, description, trigger, severity, taskId, agentRunId, failedCommand, failedTest, riskCategory, reviewerDecision } = body;

  const errors: string[] = [];
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required');
  }
  if (!trigger || !VALID_TRIGGERS.includes(trigger as string)) {
    errors.push(`trigger must be one of: ${VALID_TRIGGERS.join(', ')}`);
  }
  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as string)) {
    errors.push(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 });
  }

  try {
    const incident = await prisma.incident.create({
      data: {
        title: (title as string).trim(),
        description: description as string | undefined,
        trigger: trigger as string,
        severity: (severity as string | undefined) ?? 'medium',
        taskId: taskId as string | undefined,
        agentRunId: agentRunId as string | undefined,
        failedCommand: failedCommand as string | undefined,
        failedTest: failedTest as string | undefined,
        riskCategory: riskCategory as string | undefined,
        reviewerDecision: reviewerDecision as string | undefined,
        timeline: JSON.stringify([{
          timestamp: new Date().toISOString(),
          event: `Incident created: ${trigger}`,
          actor: currentUser?.userId ?? 'system',
        }]),
      },
    });

    await writeAudit({
      taskId: taskId as string | undefined,
      agentRunId: agentRunId as string | undefined,
      event: 'incident_created',
      details: JSON.stringify({ incidentId: incident.id, trigger: incident.trigger, severity: incident.severity }),
      userId: currentUser?.userId ?? null,
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (err) {
    console.error('[incidents POST]', err);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}
