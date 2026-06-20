import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    pending: {
      background: 'rgba(100,116,139,0.1)',
      color: '#64748b',
      border: '1px solid rgba(100,116,139,0.3)',
    },
    running: {
      background: 'rgba(59,130,246,0.1)',
      color: '#2563eb',
      border: '1px solid rgba(59,130,246,0.3)',
    },
    completed: {
      background: 'rgba(34,197,94,0.1)',
      color: '#16a34a',
      border: '1px solid rgba(34,197,94,0.3)',
    },
    failed: {
      background: 'rgba(239,68,68,0.1)',
      color: '#dc2626',
      border: '1px solid rgba(239,68,68,0.3)',
    },
  };
  const style = styles[status] ?? styles.pending;
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    low: '#16a34a',
    medium: '#d97706',
    high: '#dc2626',
  };
  const color = colors[risk] ?? '#64748b';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {risk}
    </span>
  );
}

// ── Approval badge ────────────────────────────────────────────────────────────

function ApprovalBadge({
  approvalRequired,
  approved,
}: {
  approvalRequired: boolean;
  approved: boolean | null | undefined;
}) {
  if (!approvalRequired) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not required</span>;
  }
  if (approved === true) {
    return (
      <span
        style={{
          color: '#16a34a',
          fontSize: 12,
          fontWeight: 600,
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        Approved
      </span>
    );
  }
  if (approved === false) {
    return (
      <span
        style={{
          color: '#dc2626',
          fontSize: 12,
          fontWeight: 600,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        Rejected
      </span>
    );
  }
  return (
    <span
      style={{
        color: '#d97706',
        fontSize: 12,
        fontWeight: 600,
        background: 'rgba(217,119,6,0.1)',
        border: '1px solid rgba(217,119,6,0.3)',
        padding: '2px 8px',
        borderRadius: 4,
      }}
    >
      Awaiting
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: { cursor?: string };
}

export default async function CoderTasksPage({ searchParams }: PageProps) {
  const cursor = searchParams.cursor;

  // module discriminator filter ('coder') is added once the M-1 schema migration
  // (Task.module field) lands on this branch.
  const tasks = await prisma.task.findMany({
    where: {
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    include: {
      project: { select: { id: true, name: true, repoOwner: true, repoName: true } },
      approval: { select: { id: true, approved: true } },
    },
  });

  const nextCursor =
    tasks.length === PAGE_SIZE ? tasks[tasks.length - 1].createdAt.toISOString() : null;

  const total = cursor
    ? null
    : await prisma.task.count({});

  const subtitle = total !== null
    ? `${total} task${total !== 1 ? 's' : ''} total`
    : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} shown`;

  return (
    <div>
      <PageHeader title="Work Control Room" subtitle={subtitle} />

      {tasks.length === 0 && !cursor ? (
        <EmptyState
          icon="◈"
          title="No Coder tasks yet."
          description="This is where Claude Code work items will appear. Create a task and run Claude Code to see it here."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th className="col-hide-mobile">Project / Repo</th>
                  <th>Status</th>
                  <th className="col-hide-mobile">Risk</th>
                  <th className="col-hide-mobile">Approval</th>
                  <th className="col-hide-mobile">Created</th>
                  <th className="col-hide-mobile">Updated</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const repo =
                    task.project.repoOwner && task.project.repoName
                      ? `${task.project.repoOwner}/${task.project.repoName}`
                      : null;
                  return (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          <Link href={`/tasks/${task.id}`} style={{ color: 'var(--text)' }}>
                            {truncate(task.title, 60)}
                          </Link>
                        </div>
                        {task.instruction && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--text-muted)',
                              marginTop: 2,
                            }}
                          >
                            {truncate(task.instruction, 80)}
                          </div>
                        )}
                      </td>

                      <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                        <Link
                          href={`/projects/${task.project.id}`}
                          style={{ color: 'var(--blue)', fontWeight: 500 }}
                        >
                          {task.project.name}
                        </Link>
                        {repo && (
                          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{repo}</div>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={task.status} />
                      </td>

                      <td className="col-hide-mobile">
                        <RiskBadge risk={task.riskLevel} />
                      </td>

                      <td className="col-hide-mobile">
                        <ApprovalBadge
                          approvalRequired={task.approvalRequired}
                          approved={task.approval?.approved}
                        />
                      </td>

                      <td
                        className="col-hide-mobile"
                        style={{ fontSize: 12, color: 'var(--text-muted)' }}
                      >
                        {formatDate(task.createdAt)}
                      </td>

                      <td
                        className="col-hide-mobile"
                        style={{ fontSize: 12, color: 'var(--text-muted)' }}
                      >
                        {formatDate(task.updatedAt)}
                      </td>

                      <td>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                href={`/coder/tasks?cursor=${encodeURIComponent(nextCursor)}`}
                className="btn btn-ghost"
              >
                Next page →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
