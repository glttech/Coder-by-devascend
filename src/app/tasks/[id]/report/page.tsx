import prisma from '@/lib/prisma';
import Link from 'next/link';
import { buildPrompt } from '@/lib/promptBuilder';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge, RiskBadge, EnvBadge, DecisionBadge } from '@/components/ui/Badge';
import { DecisionBanner } from '@/components/ui/DecisionBanner';

export const dynamic = 'force-dynamic';

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

interface ReportPageProps {
  params: { id: string };
}

export default async function EvidenceReportPage({ params }: ReportPageProps) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      approval: true,
      instructions: { orderBy: { createdAt: 'desc' } },
      operatorSessions: { orderBy: { createdAt: 'desc' }, take: 5 },
      audits: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { instruction: { select: { id: true, title: true } } },
      },
      agentRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        include: { evaluations: true },
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

  const prompt = buildPrompt(task);
  const latestSession = task.operatorSessions[0] ?? null;

  const approvalStatus = task.approval?.approved === true
    ? 'Approved'
    : task.approval?.approved === false
    ? 'Rejected'
    : 'Pending';

  return (
    <div>
      <PageHeader
        title={task.title}
        subtitle="Evidence Report"
        badge={
          <div style={{ display: 'flex', gap: 6 }}>
            <RiskBadge level={task.riskLevel} />
            <EnvBadge env={task.environment} />
          </div>
        }
        actions={
          <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">← Task Detail</Link>
        }
      />

      <Card style={{ maxWidth: 780 }}>
        {/* Report header strip */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '2px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task ID</div>
            <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{task.id}</code>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Generated</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
            </div>
          </div>
        </div>

        {/* Task summary */}
        <ReportSection title="Task Summary">
          <div className="meta-grid">
            <div className="meta-row">
              <span className="meta-label">Instruction</span>
              <span className="meta-value">{task.instruction}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Agent Tool</span>
              <span className="meta-value">{task.agentTool}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Project</span>
              <span className="meta-value">{task.project.name}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">{task.status}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Approval</span>
              <span className="meta-value">
                {task.approvalRequired ? `Required — ${approvalStatus}` : 'Not required'}
              </span>
            </div>
          </div>
        </ReportSection>

        {/* Generated prompt */}
        <ReportSection title="Generated Prompt">
          <pre className="prompt-block prompt-block-scrollable">{prompt}</pre>
        </ReportSection>

        {/* Latest operator session */}
        <ReportSection title="Operator Session (latest)">
          {!latestSession ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No operator sessions recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DecisionBanner
                decision={latestSession.recommendedAction ?? 'CONTINUE'}
                reason={latestSession.decisionReason}
                seniorApprovalRequired={latestSession.seniorApprovalRequired}
              />

              {latestSession.riskFlags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Risk Flags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {latestSession.riskFlags.map((flag) => (
                      <span key={flag} className="badge badge-danger">{flag.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}

              {latestSession.missingEvidence.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Missing Evidence</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {latestSession.missingEvidence.map((e) => (
                      <span key={e} className="badge badge-warning">{e.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}

              {latestSession.nextPrompt && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Recommended Next Prompt</div>
                  <pre className="prompt-block" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {latestSession.nextPrompt}
                  </pre>
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Session {latestSession.id.slice(0, 8)} · Step {latestSession.currentStep} · {latestSession.createdAt.toISOString().split('T')[0]}
                {task.operatorSessions.length > 1 && ` · +${task.operatorSessions.length - 1} more`}
              </div>
            </div>
          )}
        </ReportSection>

        {/* Instructions */}
        <ReportSection title={`Instructions (${task.instructions.length})`}>
          {task.instructions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No instructions linked.</p>
          ) : (
            <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>State Version</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {task.instructions.map((instr) => (
                  <tr key={instr.id}>
                    <td style={{ fontWeight: 500 }}>{instr.title}</td>
                    <td><StatusBadge status={instr.status} /></td>
                    <td><span className="id-chip">{instr.stateVersion ? instr.stateVersion.slice(0, 12) : '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{instr.updatedAt.toISOString().split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* Recent audit entries */}
        <ReportSection title="Recent Audit Entries">
          {task.audits.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No audit entries.</p>
          ) : (
            <>
              <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>When</th>
                    <th>Event</th>
                    <th>Instruction</th>
                  </tr>
                </thead>
                <tbody>
                  {task.audits.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {log.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{log.event}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {log.instruction ? log.instruction.title.slice(0, 32) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <Link href={`/audit?taskId=${task.id}`} style={{ color: 'var(--blue)' }}>
                  Full audit log for this task →
                </Link>
              </div>
            </>
          )}
        </ReportSection>

        {/* Agent runs */}
        {task.agentRuns.length > 0 && (
          <ReportSection title="Recent Agent Runs">
            <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Tool</th>
                  <th>Status</th>
                  <th>Evaluations</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {task.agentRuns.map((run) => {
                  const passCount = run.evaluations.filter((e) => e.passed).length;
                  return (
                    <tr key={run.id}>
                      <td><span className="id-chip">{run.id.slice(0, 8)}</span></td>
                      <td style={{ fontSize: 12 }}>{run.selectedTool}</td>
                      <td style={{ fontSize: 12 }}>{run.status}</td>
                      <td style={{ fontSize: 12 }}>
                        {run.evaluations.length > 0
                          ? <span style={{ color: passCount === run.evaluations.length ? 'var(--green)' : 'var(--red)' }}>
                              {passCount}/{run.evaluations.length} passed
                            </span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {run.startedAt.toISOString().split('T')[0]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ReportSection>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <Link href={`/tasks/${task.id}`} style={{ color: 'var(--blue)' }}>← Task detail</Link>
          <Link href="/audit" style={{ color: 'var(--blue)' }}>Audit log</Link>
          <span style={{ marginLeft: 'auto' }}>
            Report generated {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
          </span>
        </div>
      </Card>
    </div>
  );
}
