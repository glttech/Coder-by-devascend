import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { getAuthMode } from '@/lib/session';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  queued: { label: 'Queued', bg: 'rgba(234,179,8,0.12)', color: '#a16207' },
  awaiting_approval: { label: 'Awaiting Approval', bg: 'rgba(249,115,22,0.12)', color: '#c2410c' },
  running: { label: 'Running', bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8' },
  succeeded: { label: 'Succeeded', bg: 'rgba(34,197,94,0.12)', color: '#15803d' },
  failed: { label: 'Failed', bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  pending: { label: 'Pending', bg: 'rgba(100,116,139,0.12)', color: '#475569' },
  blocked: { label: 'Blocked', bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  cancelled: { label: 'Cancelled', bg: 'rgba(100,116,139,0.12)', color: '#475569' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, bg: 'rgba(100,116,139,0.12)', color: '#475569' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

function formatDuration(startedAt: Date, endedAt: Date | null): string {
  if (!endedAt) return '—';
  const ms = endedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatDate(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default async function AgentRunsPage() {
  const authMode = getAuthMode();
  if (authMode === 'enforced') {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }
  }

  const agentRuns = await prisma.agentRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      taskId: true,
      status: true,
      selectedTool: true,
      startedAt: true,
      endedAt: true,
      task: { select: { title: true } },
    },
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Agent Runs</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          All dispatched agent runs — most recent first.
        </p>
      </div>

      {agentRuns.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No agent runs yet.</div>
          <div style={{ fontSize: 13 }}>
            Dispatch one from a task page.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Tool</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {agentRuns.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Link
                      href={`/agent-runs/${run.id}`}
                      style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {run.task.title}
                    </Link>
                    <div>
                      <span className="id-chip" style={{ fontSize: 10 }}>{run.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {run.selectedTool || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatDate(run.startedAt)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatDuration(run.startedAt, run.endedAt)}
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
