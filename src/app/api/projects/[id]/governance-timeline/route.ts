import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export type GovernanceEventType =
  | 'pr_merged'
  | 'pr_opened'
  | 'agent_run'
  | 'incident'
  | 'policy_gate'
  | 'change_control';

export interface GovernanceEvent {
  id: string;
  type: GovernanceEventType;
  title: string;
  date: string;
  status: string | null;
  severity: string | null;
  classification: string | null;
  link: string | null;
  meta: Record<string, string | number | boolean | null>;
}

/**
 * GET /api/projects/:id/governance-timeline
 * Unified governance timeline: merged PRs + agent runs + incidents + key audit events.
 * Returns newest-first, capped at 100 items total.
 * Auth: any authenticated user.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 200);

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Collect all task IDs for the project (needed to join AgentRuns and Incidents)
  const taskIds = await prisma.task
    .findMany({
      where: { projectId: params.id },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const [prs, agentRuns, incidents, auditEvents] = await Promise.all([
    // GitHub PRs (merged + opened recently)
    prisma.githubPR.findMany({
      where: { projectId: params.id },
      orderBy: [{ githubMergedAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        classification: true,
        bugState: true,
        prUrl: true,
        githubMergedAt: true,
        githubCreatedAt: true,
      },
    }),
    // Agent runs for the project's tasks
    taskIds.length > 0
      ? prisma.agentRun.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { startedAt: 'desc' },
          take: 40,
          select: {
            id: true,
            taskId: true,
            status: true,
            roleKey: true,
            riskScore: true,
            startedAt: true,
            endedAt: true,
            task: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    // Incidents linked to the project's tasks
    taskIds.length > 0
      ? prisma.incident.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            trigger: true,
            createdAt: true,
            taskId: true,
          },
        })
      : Promise.resolve([]),
    // Key audit events: policy gate, change control, evidence
    taskIds.length > 0
      ? prisma.auditLog.findMany({
          where: {
            taskId: { in: taskIds },
            event: {
              in: [
                'policy_gate_blocked',
                'policy_gate_approved',
                'change_control_submitted',
                'evidence_submitted',
                'github_prs_synced',
                'sandbox_preview_created',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            event: true,
            details: true,
            createdAt: true,
            taskId: true,
            task: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const events: GovernanceEvent[] = [];

  // PRs → timeline events
  for (const pr of prs) {
    const date = pr.merged
      ? (pr.githubMergedAt?.toISOString() ?? pr.githubCreatedAt?.toISOString() ?? null)
      : (pr.githubCreatedAt?.toISOString() ?? null);
    if (!date) continue;
    events.push({
      id: pr.id,
      type: pr.merged ? 'pr_merged' : 'pr_opened',
      title: `#${pr.prNumber} ${pr.title}`,
      date,
      status: pr.merged ? 'merged' : pr.state,
      severity: null,
      classification: pr.classification ?? 'unclassified',
      link: pr.prUrl ?? null,
      meta: {
        prNumber: pr.prNumber,
        ciStatus: pr.ciStatus ?? null,
        bugState: pr.bugState ?? null,
      },
    });
  }

  // Agent runs → timeline events
  for (const run of agentRuns) {
    events.push({
      id: run.id,
      type: 'agent_run',
      title: run.task?.title
        ? `Agent run — ${run.task.title}`
        : `Agent run`,
      date: run.startedAt.toISOString(),
      status: run.status,
      severity: null,
      classification: run.roleKey ?? null,
      link: `/tasks/${run.taskId}`,
      meta: {
        riskScore: run.riskScore ?? null,
        roleKey: run.roleKey ?? null,
      },
    });
  }

  // Incidents → timeline events
  for (const inc of incidents) {
    events.push({
      id: inc.id,
      type: 'incident',
      title: inc.title,
      date: inc.createdAt.toISOString(),
      status: inc.status,
      severity: inc.severity,
      classification: inc.trigger,
      link: inc.taskId ? `/tasks/${inc.taskId}` : null,
      meta: { trigger: inc.trigger },
    });
  }

  // Audit events → policy gate / change control events
  for (const log of auditEvents) {
    const type: GovernanceEventType =
      log.event.startsWith('policy_gate') ? 'policy_gate' :
      log.event.startsWith('change_control') || log.event.startsWith('evidence') ? 'change_control' :
      'policy_gate';

    events.push({
      id: log.id,
      type,
      title: log.task?.title
        ? `${formatEventLabel(log.event)} — ${log.task.title}`
        : formatEventLabel(log.event),
      date: log.createdAt.toISOString(),
      status: log.event,
      severity: null,
      classification: null,
      link: log.taskId ? `/tasks/${log.taskId}` : null,
      meta: {},
    });
  }

  // Sort newest first and cap
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
    total: events.length,
    events: events.slice(0, limit),
  });
}

function formatEventLabel(event: string): string {
  return event
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
