import prisma from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { getCurrentUser, getAuthMode } from '@/lib/session';
import { MoveTaskButton } from '@/components/MoveTaskButton';

export const dynamic = 'force-dynamic';

interface BoardPageProps {
  params: { id: string };
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
  { status: 'pending',   label: 'Pending',   color: 'var(--text-muted)',    bg: 'var(--surface)',      border: 'var(--border)' },
  { status: 'running',   label: 'Running',   color: 'var(--blue)',          bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.3)' },
  { status: 'completed', label: 'Completed', color: 'var(--green)',         bg: 'rgba(34,197,94,0.05)',  border: 'rgba(34,197,94,0.3)' },
  { status: 'failed',    label: 'Failed',    color: 'var(--red)',           bg: 'rgba(239,68,68,0.05)',  border: 'rgba(239,68,68,0.3)' },
];

function formatDueDate(date: Date): { label: string; overdue: boolean } {
  const now = new Date();
  const overdue = date < now;
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const authMode = getAuthMode();
  if (authMode === 'misconfigured') {
    throw new Error('Auth is misconfigured. Check server environment variables.');
  }

  if (authMode === 'enforced') {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      redirect('/login');
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    notFound();
  }

  const rawTasks = await prisma.task.findMany({
    where: { projectId: params.id },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    include: { milestone: { select: { id: true, title: true } } },
  });

  // Sort by priority: critical > high > medium > low
  const tasks = [...rawTasks].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
  );

  const byStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.status, tasks.filter((t) => t.status === col.status)]),
  ) as Record<TaskStatus, typeof tasks>;

  return (
    <div>
      <PageHeader
        title={`${project.name} — Board`}
        subtitle={`${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/projects/${project.id}`} className="btn btn-ghost btn-sm">
              ← Project
            </Link>
            <Link href={`/tasks/new`} className="btn btn-primary btn-sm">
              + New Task
            </Link>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          alignItems: 'start',
          overflowX: 'auto',
        }}
      >
        {COLUMNS.map((col) => {
          const colTasks = byStatus[col.status];

          return (
            <div
              key={col.status}
              style={{
                background: col.bg,
                border: `1px solid ${col.border}`,
                borderRadius: 8,
                padding: 12,
                minHeight: 200,
              }}
            >
              {/* Column header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: col.color,
                  }}
                >
                  {col.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: col.color,
                    background: 'var(--surface)',
                    border: `1px solid ${col.border}`,
                    borderRadius: 12,
                    padding: '1px 8px',
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '24px 0',
                    }}
                  >
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const due = task.dueDate ? formatDueDate(task.dueDate) : null;

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '10px 12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                      >
                        {/* Title */}
                        <Link
                          href={`/tasks/${task.id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--text)',
                            display: 'block',
                            marginBottom: 6,
                            lineHeight: 1.35,
                          }}
                        >
                          {task.title}
                        </Link>

                        {/* Badges row */}
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            marginBottom: 6,
                          }}
                        >
                          <Badge text={task.priority} variant="severity" />
                          <RiskBadge level={task.riskLevel} />
                        </div>

                        {/* Meta row */}
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          {task.agentTool && (
                            <span title="Agent tool" style={{ fontFamily: 'monospace' }}>
                              {task.agentTool}
                            </span>
                          )}
                          {task.milestone && (
                            <span title="Milestone">
                              {task.milestone.title}
                            </span>
                          )}
                          {due && (
                            <span
                              title="Due date"
                              style={{ color: due.overdue ? 'var(--red)' : undefined, fontWeight: due.overdue ? 600 : undefined }}
                            >
                              {due.overdue ? 'Overdue: ' : 'Due: '}
                              {due.label}
                            </span>
                          )}
                        </div>

                        {/* Move button */}
                        <MoveTaskButton
                          taskId={task.id}
                          currentStatus={col.status}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
