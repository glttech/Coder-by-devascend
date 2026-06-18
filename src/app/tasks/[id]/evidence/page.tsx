import prisma from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RiskBadge, StatusBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

interface EvidencePageProps {
  params: { id: string };
}

const ENV_DISPLAY: Record<string, string> = {
  local: 'Local',
  dev: 'Development',
  staging: 'Staging',
  production: 'Production',
};

const TOOL_DISPLAY: Record<string, string> = {
  'claude-code-manual': 'Claude Code',
  'codex-manual': 'Codex',
  'openclaw-manual': 'OpenClaw',
  'open-swe': 'Open SWE',
};

function ApprovalBadge({ approved }: { approved: boolean | null | undefined }) {
  if (approved === true)
    return <span className="badge badge-success">Approved</span>;
  if (approved === false)
    return <span className="badge badge-sev-high">Rejected</span>;
  return <span className="badge badge-neutral">Pending</span>;
}

export default async function EvidencePage({ params }: EvidencePageProps) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      assignee: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true } },
      approval: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      agentRuns: {
        orderBy: { startedAt: 'asc' },
        include: {
          provider: { select: { id: true, name: true, type: true } },
          steps: { orderBy: { stepIndex: 'asc' } },
          evaluations: true,
        },
      },
      audits: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!task) {
    notFound();
  }

  const githubPRs = await prisma.githubPR.findMany({
    where: { taskId: params.id },
    select: {
      id: true,
      prNumber: true,
      title: true,
      state: true,
      merged: true,
      ciStatus: true,
      sourceBranch: true,
      prUrl: true,
      githubCreatedAt: true,
    },
  });

  const generatedAt = new Date().toISOString();

  const rollbackHashes = task.agentRuns
    .map((r) => r.commitHash)
    .filter((h): h is string => Boolean(h));

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
            ← Task
          </Link>
          <h1 className="page-title">Change Control Pack — {task.title}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <RiskBadge level={task.riskLevel} />
            <StatusBadge status={task.status} />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Task Metadata</span>
        </div>
        <div className="card">
          <div className="meta-grid">
            <div className="meta-row">
              <span className="meta-label">Project</span>
              <span className="meta-value">{task.project.name}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Risk Level</span>
              <span className="meta-value"><RiskBadge level={task.riskLevel} /></span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Environment</span>
              <span className="meta-value">{ENV_DISPLAY[task.environment] ?? task.environment}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Approval Required</span>
              <span className="meta-value">{task.approvalRequired ? 'Yes' : 'No'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Priority</span>
              <span className="meta-value">
                <span className={`badge ${
                  task.priority === 'critical' || task.priority === 'high'
                    ? 'badge-sev-high'
                    : task.priority === 'medium'
                    ? 'badge-warning'
                    : 'badge-success'
                }`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Due Date</span>
              <span className="meta-value">
                {task.dueDate
                  ? task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Assignee</span>
              <span className="meta-value">
                {task.assignee ? (task.assignee.name ?? task.assignee.email) : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Milestone</span>
              <span className="meta-value">{task.milestone ? task.milestone.title : '—'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Agent Tool</span>
              <span className="meta-value">
                <span className="badge badge-neutral">
                  {TOOL_DISPLAY[task.agentTool] ?? task.agentTool}
                </span>
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value"><StatusBadge status={task.status} /></span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution History */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Execution History ({task.agentRuns.length})</span>
        </div>
        {task.agentRuns.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No agent runs recorded for this task.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {task.agentRuns.map((run, idx) => (
              <div key={run.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Run #{idx + 1}</span>
                    <span className="id-chip">{run.id.slice(0, 8)}</span>
                    {run.provider && (
                      <span className="badge badge-neutral">{run.provider.name}</span>
                    )}
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="meta-grid">
                  <div className="meta-row">
                    <span className="meta-label">Prompt (preview)</span>
                    <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {run.generatedPrompt.slice(0, 300)}{run.generatedPrompt.length > 300 ? '…' : ''}
                    </span>
                  </div>
                  {run.filesChanged && (
                    <div className="meta-row">
                      <span className="meta-label">Files Changed</span>
                      <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.filesChanged}</span>
                    </div>
                  )}
                  {run.commandsRun && (
                    <div className="meta-row">
                      <span className="meta-label">Commands Run</span>
                      <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.commandsRun}</span>
                    </div>
                  )}
                  {run.testResult && (
                    <div className="meta-row">
                      <span className="meta-label">Test Result</span>
                      <span className="meta-value">{run.testResult}</span>
                    </div>
                  )}
                  {run.commitHash && (
                    <div className="meta-row">
                      <span className="meta-label">Commit Hash</span>
                      <span className="meta-value">
                        <span className="id-chip">{run.commitHash}</span>
                      </span>
                    </div>
                  )}
                  <div className="meta-row">
                    <span className="meta-label">Started</span>
                    <span className="meta-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {run.startedAt.toISOString()}
                    </span>
                  </div>
                  {run.endedAt && (
                    <div className="meta-row">
                      <span className="meta-label">Ended</span>
                      <span className="meta-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {run.endedAt.toISOString()}
                      </span>
                    </div>
                  )}
                </div>
                {run.evaluations.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Evaluations
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
                              <td>{ev.name}</td>
                              <td>
                                <span className={`badge ${ev.passed ? 'badge-success' : 'badge-sev-high'}`}>
                                  {ev.passed ? 'Pass' : 'Fail'}
                                </span>
                              </td>
                              <td>{ev.score != null ? ev.score.toFixed(2) : '—'}</td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.reason ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Record */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Approval Record</span>
        </div>
        <div className="card">
          {task.approval ? (
            <div className="meta-grid">
              <div className="meta-row">
                <span className="meta-label">Decision</span>
                <span className="meta-value"><ApprovalBadge approved={task.approval.approved} /></span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Approver</span>
                <span className="meta-value">
                  {task.approval.user
                    ? (task.approval.user.name ?? task.approval.user.email)
                    : '—'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Timestamp</span>
                <span className="meta-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {task.approval.updatedAt.toISOString()}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {task.approvalRequired
                ? 'Approval required but not yet recorded.'
                : 'No approval required for this task.'}
            </p>
          )}
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Audit Timeline ({task.audits.length})</span>
        </div>
        {task.audits.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No audit events recorded.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Details</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {task.audits.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="badge badge-neutral">{log.event}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 300, wordBreak: 'break-word' }}>
                      {log.details ?? '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {log.user ? (log.user.name ?? log.user.email) : 'System'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.createdAt.toISOString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GitHub PRs */}
      {githubPRs.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">GitHub Pull Requests ({githubPRs.length})</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR #</th>
                  <th>Title</th>
                  <th>State</th>
                  <th>CI Status</th>
                  <th>Branch</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {githubPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <span className="id-chip">#{pr.prNumber}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{pr.title}</td>
                    <td>
                      <span className={`badge ${
                        pr.merged ? 'badge-success' :
                        pr.state === 'open' ? 'badge-neutral' : 'badge-sev-high'
                      }`}>
                        {pr.merged ? 'Merged' : pr.state}
                      </span>
                    </td>
                    <td>
                      {pr.ciStatus ? (
                        <span className={`badge ${
                          pr.ciStatus === 'success' ? 'badge-success' :
                          pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'
                        }`}>
                          {pr.ciStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{pr.sourceBranch ?? '—'}</td>
                    <td>
                      {pr.prUrl ? (
                        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontSize: 12 }}>
                          View PR →
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rollback Note */}
      {rollbackHashes.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Rollback Instructions</span>
          </div>
          <div className="card">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              To roll back changes introduced by this task, run one of the following commands:
            </p>
            {rollbackHashes.map((hash) => (
              <pre key={hash} className="prompt-block" style={{ fontSize: 12, marginBottom: 8 }}>
                git revert {hash}
              </pre>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="section" style={{ paddingBottom: 32 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Change Control Pack generated at {generatedAt}
        </p>
      </div>
    </div>
  );
}
