import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getAuthMode } from '@/lib/session';
import { redirect } from 'next/navigation';
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
        padding: '3px 10px',
        borderRadius: 4,
        fontSize: 13,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

interface AgentRunPageProps {
  params: { id: string };
}

export default async function AgentRunPage({ params }: AgentRunPageProps) {
  const authMode = getAuthMode();
  if (authMode === 'enforced') {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }
  }

  const run = await prisma.agentRun.findUnique({
    where: { id: params.id },
    include: {
      task: { select: { id: true, title: true } },
      evaluations: true,
      steps: { orderBy: { stepIndex: 'asc' } },
    },
  });

  if (!run) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Agent run not found</div>
        <p className="empty-state-description">This agent run ID does not exist or has been removed.</p>
        <Link href="/agent-runs" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
          ← Back to Agent Runs
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/agent-runs" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Agent Runs
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Agent Run</h1>
        <span className="id-chip">{run.id.slice(0, 8)}</span>
        <StatusBadge status={run.status} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <span className="card-title">Details</span>
        </div>
        <div className="meta-grid" style={{ marginTop: 12 }}>
          <div className="meta-row">
            <span className="meta-label">Task</span>
            <span className="meta-value">
              <Link href={`/tasks/${run.task.id}`} style={{ color: 'var(--blue)' }}>
                {run.task.title}
              </Link>
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Status</span>
            <span className="meta-value"><StatusBadge status={run.status} /></span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Tool</span>
            <span className="meta-value">{run.selectedTool || '—'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Started</span>
            <span className="meta-value" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {run.startedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </span>
          </div>
          {run.endedAt && (
            <div className="meta-row">
              <span className="meta-label">Ended</span>
              <span className="meta-value" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {run.endedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC
              </span>
            </div>
          )}
          {run.commitHash && (
            <div className="meta-row">
              <span className="meta-label">Commit</span>
              <span className="meta-value">
                <span className="id-chip">{run.commitHash.slice(0, 12)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {run.response && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Response</span>
          </div>
          <pre className="prompt-block prompt-block-scrollable" style={{ maxHeight: 300 }}>
            {run.response}
          </pre>
        </div>
      )}

      {run.evaluations.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Evaluations ({run.evaluations.length})</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Passed</th>
                  <th>Score</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {run.evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 500 }}>{ev.name}</td>
                    <td>
                      <span style={{ color: ev.passed ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                        {ev.passed ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {ev.score != null ? ev.score.toFixed(2) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ev.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {run.steps.length > 0 && (
        <div className="section">
          <details>
            <summary style={{ cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="section-title">Steps ({run.steps.length})</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>▸ expand</span>
            </summary>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {run.steps.map((step) => (
                <div key={step.id} className="card" style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span className="id-chip">#{step.stepIndex}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{step.type}</span>
                  </div>
                  <pre style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {step.content}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
