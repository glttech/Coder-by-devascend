import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

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
    cancelled: {
      background: 'rgba(156,163,175,0.1)',
      color: '#6b7280',
      border: '1px solid rgba(156,163,175,0.3)',
    },
  };
  const style = styles[status] ?? styles.pending;
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return '—';
  const endMs = end ? end.getTime() : Date.now();
  const secs = Math.round((endMs - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: { cursor?: string; taskId?: string; status?: string };
}

export default async function CoderSessionsPage({ searchParams }: PageProps) {
  const cursor = searchParams.cursor;
  const taskId = searchParams.taskId;
  const status = searchParams.status;

  const sessions = await prisma.cliSession.findMany({
    where: {
      ...(taskId ? { taskId } : {}),
      ...(status ? { status } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    include: {
      task: { select: { id: true, title: true } },
      repository: { select: { id: true, fullName: true } },
    },
  });

  const nextCursor =
    sessions.length === PAGE_SIZE ? sessions[sessions.length - 1].createdAt.toISOString() : null;

  const total = cursor ? null : await prisma.cliSession.count({
    where: {
      ...(taskId ? { taskId } : {}),
      ...(status ? { status } : {}),
    },
  });

  const subtitle = total !== null
    ? `${total} session${total !== 1 ? 's' : ''} total`
    : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} shown`;

  return (
    <div>
      <PageHeader title="CLI Sessions" subtitle={subtitle} />

      {sessions.length === 0 && !cursor ? (
        <EmptyState
          icon="▶"
          title="No CLI sessions yet."
          description="Sessions appear here when Claude Code CLI runs are triggered for a task."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Command / Summary</th>
                  <th className="col-hide-mobile">Repo / Task</th>
                  <th>Status</th>
                  <th className="col-hide-mobile">Duration</th>
                  <th className="col-hide-mobile">Files</th>
                  <th className="col-hide-mobile">Started</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <code style={{ fontSize: 12 }}>
                        {truncate(session.command, 50)}
                      </code>
                      {session.summary && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>
                          {truncate(session.summary, 80)}
                        </div>
                      )}
                      {!session.summary && session.workingDir && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {truncate(session.workingDir, 50)}
                        </div>
                      )}
                    </td>

                    <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                      {session.repository ? (
                        <Link
                          href={`/coder/repositories/${session.repository.id}`}
                          style={{ color: 'var(--blue)', fontWeight: 500, display: 'block' }}
                        >
                          {session.repository.fullName}
                        </Link>
                      ) : null}
                      {session.task ? (
                        <Link
                          href={`/tasks/${session.task.id}`}
                          style={{ color: 'var(--text-muted)', fontSize: 11 }}
                        >
                          {truncate(session.task.title, 35)}
                        </Link>
                      ) : (
                        !session.repository && <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge status={session.status} />
                      {session.exitCode !== null && (
                        <div style={{ fontSize: 11, marginTop: 2, color: session.exitCode === 0 ? '#16a34a' : '#dc2626' }}>
                          exit {session.exitCode}
                        </div>
                      )}
                    </td>

                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDuration(session.startedAt, session.completedAt)}
                    </td>

                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {session.filesChanged.length > 0 ? (
                        <span title={session.filesChanged.join('\n')}>{session.filesChanged.length}</span>
                      ) : '—'}
                    </td>

                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {session.startedAt ? formatDate(session.startedAt) : formatDate(session.createdAt)}
                    </td>

                    <td>
                      <Link
                        href={`/coder/sessions/${session.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                href={`/coder/sessions?cursor=${encodeURIComponent(nextCursor)}${taskId ? `&taskId=${taskId}` : ''}${status ? `&status=${status}` : ''}`}
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
