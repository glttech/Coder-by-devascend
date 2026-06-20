import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

type EventType = 'pr_merged' | 'pr_opened' | 'agent_run' | 'incident';

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  date: Date;
  status: string | null;
  severity: string | null;
  link: string | null;
  classification: string | null;
}

const BORDER_COLOR: Record<EventType, string> = {
  pr_merged: 'var(--blue)',
  pr_opened: 'var(--border)',
  agent_run: '#8b5cf6',
  incident: 'var(--red)',
};

const EVENT_LABEL: Record<EventType, string> = {
  pr_merged: 'PR Merged',
  pr_opened: 'PR Opened',
  agent_run: 'Agent Run',
  incident: 'Incident',
};

const EVENT_BADGE: Record<EventType, string> = {
  pr_merged: 'badge-success',
  pr_opened: 'badge-neutral',
  agent_run: 'badge-neutral',
  incident: 'badge-sev-high',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function GovernanceTimelinePage({ params }: PageProps) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return <div style={{ padding: 32 }}>Unauthorized</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
      </div>
    );
  }

  // Fetch PRs
  const prs = await prisma.githubPR.findMany({
    where: { projectId: params.id },
    orderBy: [{ githubMergedAt: 'desc' }, { githubCreatedAt: 'desc' }],
    take: 50,
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
  });

  // Fetch task IDs for this project
  const taskIds = await prisma.task
    .findMany({ where: { projectId: params.id }, select: { id: true } })
    .then((r) => r.map((t) => t.id));

  // Fetch agent runs and incidents if there are tasks
  const [agentRuns, incidents] = await Promise.all([
    taskIds.length > 0
      ? prisma.agentRun.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { startedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            taskId: true,
            status: true,
            roleKey: true,
            riskScore: true,
            startedAt: true,
            task: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    taskIds.length > 0
      ? prisma.incident.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { createdAt: 'desc' },
          take: 20,
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
  ]);

  // Build unified event list
  const events: TimelineEvent[] = [];

  for (const pr of prs) {
    const date = pr.merged
      ? pr.githubMergedAt ?? pr.githubCreatedAt
      : pr.githubCreatedAt;
    if (!date) continue;
    events.push({
      id: pr.id,
      type: pr.merged ? 'pr_merged' : 'pr_opened',
      title: `#${pr.prNumber} ${pr.title}`,
      date,
      status: pr.merged ? 'merged' : pr.state,
      severity: null,
      link: pr.prUrl ?? `/projects/${params.id}/prs/${pr.id}`,
      classification: pr.classification ?? null,
    });
  }

  for (const run of agentRuns) {
    events.push({
      id: run.id,
      type: 'agent_run',
      title: run.task?.title ? `Agent: ${run.task.title}` : 'Agent Run',
      date: run.startedAt,
      status: run.status,
      severity: null,
      link: `/tasks/${run.taskId}`,
      classification: run.roleKey ?? null,
    });
  }

  for (const inc of incidents) {
    events.push({
      id: inc.id,
      type: 'incident',
      title: inc.title,
      date: inc.createdAt,
      status: inc.status,
      severity: inc.severity,
      link: inc.taskId ? `/tasks/${inc.taskId}` : null,
      classification: null,
    });
  }

  // Sort newest first
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <PageHeader
        title="Governance Timeline"
        subtitle={
          <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← {project.name}
          </Link>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/projects/${params.id}/intelligence`} className="btn btn-ghost btn-sm">
              Intelligence →
            </Link>
            <Link href={`/projects/${params.id}/prs`} className="btn btn-ghost btn-sm">
              PR History →
            </Link>
          </div>
        }
      />

      <div className="section">
        {events.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              No governance events yet. Import PRs or run an agent to see timeline activity.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map((event) => {
              const borderColor = BORDER_COLOR[event.type];
              const badgeClass = EVENT_BADGE[event.type];
              const label = EVENT_LABEL[event.type];
              return (
                <div
                  key={`${event.type}-${event.id}`}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${borderColor}`,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {label}
                    </span>
                    {event.severity && (
                      <span className="badge badge-sev-high" style={{ fontSize: 10, flexShrink: 0 }}>
                        {event.severity}
                      </span>
                    )}
                    {event.classification && (
                      <span className="badge badge-neutral" style={{ fontSize: 10, flexShrink: 0 }}>
                        {event.classification}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                      {formatDate(event.date)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    {event.link ? (
                      <Link
                        href={event.link}
                        style={{ fontSize: 14, fontWeight: 500, color: 'var(--blue)', lineHeight: 1.4 }}
                      >
                        {event.title.length > 80 ? event.title.slice(0, 80) + '…' : event.title}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>
                        {event.title.length > 80 ? event.title.slice(0, 80) + '…' : event.title}
                      </span>
                    )}
                    {event.status && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {event.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
