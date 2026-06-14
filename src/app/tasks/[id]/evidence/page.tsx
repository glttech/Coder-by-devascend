import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskBadge, StatusBadge } from '@/components/ui/Badge';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

interface EvidencePageProps {
  params: { id: string };
}

function ApprovalBadge({ approved }: { approved: boolean | null }) {
  if (approved === true) return <span className="badge badge-success">Approved</span>;
  if (approved === false) return <span className="badge badge-sev-high">Rejected</span>;
  return <span className="badge badge-pending_approval">Pending</span>;
}

export default async function EvidencePage({ params }: EvidencePageProps) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true, projectId: true } },
      agentRuns: {
        include: {
          provider: { select: { id: true, name: true, type: true } },
          evaluations: true,
        },
        orderBy: { startedAt: 'asc' },
      },
      approval: {
        include: { user: { select: { name: true, email: true } } },
      },
      audits: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!task) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Task not found</div>
      </div>
    );
  }

  const githubPRs = await prisma.githubPR.findMany({
    where: { taskId: params.id },
    select: { prNumber: true, title: true, state: true, merged: true, ciStatus: true, sourceBranch: true, prUrl: true, githubCreatedAt: true },
    orderBy: { githubCreatedAt: 'asc' },
  });

  const generatedAt = new Date().toISOString();
  const rollbackHashes = task.agentRuns.filter((r) => r.commitHash).map((r) => r.commitHash!);

  return (
    <div>
      <PageHeader
        title={`Change Control Pack — ${task.title}`}
        subtitle={<span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{task.id}</span>}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">← Task</Link>
            <a href={`/api/tasks/${task.id}/report`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Download Report</a>
          </div>
        }
      />

      {/* Task Metadata */}
      <div className="section">
        <div className="section-header"><span className="section-title">Task Details</span></div>
        <div className="card">
          <div className="meta-grid">
            <div className="meta-row"><span className="meta-label">Project</span><span className="meta-value"><Link href={`/projects/${task.project.id}`} style={{ color: 'var(--blue)' }}>{task.project.name}</Link></span></div>
            <div className="meta-row"><span className="meta-label">Status</span><span className="meta-value"><StatusBadge status={task.status} /></span></div>
            <div className="meta-row"><span className="meta-label">Risk Level</span><span className="meta-value"><RiskBadge level={task.riskLevel} /></span></div>
            <div className="meta-row"><span className="meta-label">Environment</span><span className="meta-value"><span className="badge badge-neutral">{task.environment}</span></span></div>
            <div className="meta-row"><span className="meta-label">Approval Required</span><span className="meta-value">{task.approvalRequired ? 'Yes' : 'No'}</span></div>
            <div className="meta-row"><span className="meta-label">Priority</span><span className="meta-value">{task.priority}</span></div>
            {task.dueDate && <div className="meta-row"><span className="meta-label">Due Date</span><span className="meta-value">{new Date(task.dueDate).toLocaleDateString()}</span></div>}
            {task.assignee && <div className="meta-row"><span className="meta-label">Assignee</span><span className="meta-value">{task.assignee.name ?? task.assignee.email}</span></div>}
            {task.milestone && <div className="meta-row"><span className="meta-label">Milestone</span><span className="meta-value"><Link href={`/projects/${task.milestone.projectId}/milestones/${task.milestone.id}`} style={{ color: 'var(--blue)' }}>{task.milestone.title}</Link></span></div>}
            <div className="meta-row"><span className="meta-label">Agent Tool</span><span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{task.agentTool}</span></div>
            <div className="meta-row"><span className="meta-label">Created</span><span className="meta-value">{new Date(task.createdAt).toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      {/* Task Instruction */}
      <div className="section">
        <div className="section-header"><span className="section-title">Original Request</span></div>
        <div className="card">
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, margin: 0, color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.6 }}>
            {task.instruction}
          </pre>
        </div>
      </div>

      {/* Execution History */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Execution History ({task.agentRuns.length} run{task.agentRuns.length !== 1 ? 's' : ''})</span>
        </div>
        {task.agentRuns.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13 }}>No agent runs yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {task.agentRuns.map((run, i) => (
              <div key={run.id} className="card">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Run #{i + 1}</span>
                  <span className={`badge badge-${run.status === 'succeeded' ? 'success' : run.status === 'failed' ? 'sev-high' : 'neutral'}`}>{run.status}</span>
                  {run.provider && <span className="badge badge-neutral" style={{ fontSize: 10 }}>{run.provider.name}</span>}
                  {run.startedAt && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(run.startedAt).toLocaleString()}</span>}
                </div>
                <div className="meta-grid">
                  {run.filesChanged && <div className="meta-row"><span className="meta-label">Files Changed</span><span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{run.filesChanged}</span></div>}
                  {run.commandsRun && <div className="meta-row"><span className="meta-label">Commands Run</span><span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{run.commandsRun}</span></div>}
                  {run.testResult && (
                    <div className="meta-row">
                      <span className="meta-label">Test Result</span>
                      <span className="meta-value">
                        <span className={`badge badge-${/pass/i.test(run.testResult) ? 'success' : 'sev-high'}`} style={{ fontSize: 11 }}>{run.testResult.slice(0, 100)}</span>
                      </span>
                    </div>
                  )}
                  {run.commitHash && <div className="meta-row"><span className="meta-label">Commit</span><span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{run.commitHash}</span></div>}
                </div>
                {run.evaluations.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>EVALUATIONS</div>
                    {run.evaluations.map((ev, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
                        <span className={`badge badge-${ev.passed ? 'success' : 'sev-high'}`} style={{ fontSize: 10 }}>{ev.passed ? 'PASS' : 'FAIL'}</span>
                        <span style={{ fontWeight: 500 }}>{ev.name}</span>
                        {ev.reason && <span style={{ color: 'var(--text-muted)' }}>— {ev.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Record */}
      <div className="section">
        <div className="section-header"><span className="section-title">Approval Record</span></div>
        <div className="card">
          {task.approval ? (
            <div className="meta-grid">
              <div className="meta-row"><span className="meta-label">Decision</span><span className="meta-value"><ApprovalBadge approved={task.approval.approved} /></span></div>
              {task.approval.user && <div className="meta-row"><span className="meta-label">Approver</span><span className="meta-value">{task.approval.user.name ?? task.approval.user.email}</span></div>}
              <div className="meta-row"><span className="meta-label">Updated</span><span className="meta-value">{new Date(task.approval.updatedAt).toLocaleString()}</span></div>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{task.approvalRequired ? 'Approval pending.' : 'No approval required for this task.'}</span>
          )}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="section">
        <div className="section-header"><span className="section-title">Risk Assessment</span></div>
        <div className="card">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>Risk Level</div>
              <RiskBadge level={task.riskLevel} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>Environment</div>
              <span className="badge badge-neutral">{task.environment}</span>
            </div>
          </div>
          {task.audits.filter((a) => a.event.startsWith('risk') || a.event.includes('block') || a.event.includes('escalat')).length > 0 ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Risk-related events</div>
              <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
                <thead><tr><th>When</th><th>Event</th><th>Details</th></tr></thead>
                <tbody>
                  {task.audits.filter((a) => a.event.startsWith('risk') || a.event.includes('block') || a.event.includes('escalat')).map((log, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.event}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.details ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No risk-related audit events recorded.</p>
          )}
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="section">
        <div className="section-header"><span className="section-title">Audit Timeline ({task.audits.length} events)</span></div>
        {task.audits.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13 }}>No audit events recorded.</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead><tr><th>Time</th><th>Event</th><th>Actor</th><th>Details</th></tr></thead>
              <tbody>
                {task.audits.map((log, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{log.event}</span></td>
                    <td style={{ fontSize: 12 }}>{log.user ? (log.user.name ?? log.user.email) : 'system'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300, wordBreak: 'break-word' }}>{log.details ?? '—'}</td>
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
          <div className="section-header"><span className="section-title">GitHub Pull Requests</span></div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead><tr><th>PR</th><th>Title</th><th>State</th><th>CI</th><th>Branch</th></tr></thead>
              <tbody>
                {githubPRs.map((pr) => (
                  <tr key={pr.prNumber}>
                    <td>
                      {pr.prUrl ? (
                        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>#{pr.prNumber}</a>
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>#{pr.prNumber}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{pr.title}</td>
                    <td><span className={`badge badge-${pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'}`}>{pr.merged ? 'merged' : pr.state}</span></td>
                    <td>{pr.ciStatus ? <span className={`badge badge-${pr.ciStatus === 'success' ? 'success' : pr.ciStatus === 'failure' ? 'sev-high' : 'neutral'}`}>{pr.ciStatus}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{pr.sourceBranch ?? '—'}</td>
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
          <div className="section-header"><span className="section-title">Rollback Note</span></div>
          <div className="card">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>To revert the changes made by this task, run:</p>
            {rollbackHashes.map((hash) => (
              <pre key={hash} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, margin: '0 0 8px' }}>
                git revert {hash}
              </pre>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 24, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Generated at {new Date(generatedAt).toLocaleString()} · Coder by DevAscend</span>
        <PrintButton />
      </div>
    </div>
  );
}
