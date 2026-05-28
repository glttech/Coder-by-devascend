import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskBadge, EnvBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function TaskList() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      instructions: { where: { status: 'pending_approval' }, select: { id: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`}
        actions={
          <Link href="/tasks/new" className="btn btn-primary">
            + New Task
          </Link>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No tasks yet"
          description="Tasks represent units of AI-assisted development work. Create your first task to begin generating prompts and tracking agent runs."
          action={<Link href="/tasks/new" className="btn btn-primary">Create first task</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Env</th>
                <th>Agent</th>
                <th>Created</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
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
                  <td><RiskBadge level={task.riskLevel} /></td>
                  <td><EnvBadge env={task.environment} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{task.agentTool}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {task.createdAt.toISOString().split('T')[0]}
                  </td>
                  <td>
                    {task.instructions.length > 0 && (
                      <span className="badge badge-pending_approval">
                        {task.instructions.length} pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
