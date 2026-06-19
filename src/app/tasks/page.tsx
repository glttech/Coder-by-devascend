import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskBadge, EnvBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TASK_LIST_LIMIT = 200;

export default async function TaskList() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: TASK_LIST_LIMIT,
    include: {
      instructions: { where: { status: 'pending_approval' }, select: { id: true } },
    },
  });
  const listCapped = tasks.length === TASK_LIST_LIMIT;

  const sevenDaysAgo = new Date(Date.now() - STALE_THRESHOLD_MS);
  const staleCount = tasks.filter(
    (t) => !TERMINAL_STATUSES.has(t.status) && t.updatedAt < sevenDaysAgo,
  ).length;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={listCapped ? `Showing ${TASK_LIST_LIMIT} most recent tasks` : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`}
        badge={
          staleCount > 0 ? (
            <span className="badge badge-warning" title="Non-terminal tasks not updated in 7+ days">
              {staleCount} stale
            </span>
          ) : undefined
        }
        actions={
          <Link href="/tasks/new" className="btn btn-primary">
            + New Task
          </Link>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No tasks yet"
          description="Tasks describe what you want the AI to help with. Create a task, generate a prompt, and review the AI's suggestion before approving it."
          action={<Link href="/tasks/new" className="btn btn-primary">Create your first task</Link>}
        />
      ) : (
        <>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          Risk levels: Low · Medium · High — hover for details
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-hide-mobile">ID</th>
                <th>Title</th>
                <th>Status</th>
                <th className="col-hide-mobile">Priority</th>
                <th className="col-hide-mobile">Risk</th>
                <th className="col-hide-mobile">Environment</th>
                <th className="col-hide-mobile">Agent</th>
                <th className="col-hide-mobile">Last activity</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const stale = !TERMINAL_STATUSES.has(task.status) && task.updatedAt < sevenDaysAgo;
                return (
                  <tr key={task.id} style={stale ? { background: 'var(--amber-bg, rgba(251,191,36,0.05))' } : undefined}>
                    <td className="col-hide-mobile">
                      <Link href={`/tasks/${task.id}`} style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 11 }}>
                        {task.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/tasks/${task.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {task.title}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{task.status}</td>
                    <td className="col-hide-mobile">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: task.priority === 'critical' ? 'var(--red, #ef4444)' :
                            task.priority === 'high' ? '#f97316' :
                            task.priority === 'medium' ? 'var(--amber, #f59e0b)' : 'var(--green, #22c55e)',
                        }} />
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    </td>
                    <td className="col-hide-mobile"><RiskBadge level={task.riskLevel} /></td>
                    <td className="col-hide-mobile"><EnvBadge env={task.environment} /></td>
                    <td className="col-hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{task.agentTool}</td>
                    <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                      <span style={{ color: stale ? 'var(--amber)' : 'var(--text-muted)' }}>
                        {relativeTime(task.updatedAt)}
                      </span>
                      {stale && (
                        <span
                          className="badge badge-warning"
                          style={{ marginLeft: 6, fontSize: 10 }}
                          title="Not updated in 7+ days"
                        >
                          stale
                        </span>
                      )}
                    </td>
                    <td>
                      {task.instructions.length > 0 && (
                        <span className="badge badge-pending_approval">
                          {task.instructions.length} pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
