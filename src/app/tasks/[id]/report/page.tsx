import prisma from '@/lib/prisma';
import Link from 'next/link';
import { buildPrompt } from '@/lib/promptBuilder';
import { getRiskFlagDetails } from '@/lib/riskAnalyzer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge, RiskBadge, EnvBadge, DecisionBadge, SeverityBadge } from '@/components/ui/Badge';
import { DecisionBanner } from '@/components/ui/DecisionBanner';
import CreateShareLink from '@/components/CreateShareLink';

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
      operatorSessions: { orderBy: { createdAt: 'asc' } },
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
  const sessions = task.operatorSessions;
  const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

  const approvalStatus = task.approval?.approved === true
    ? 'Approved'
    : task.approval?.approved === false
    ? 'Rejected'
    : 'Pending';

  const overallDecision = latestSession?.recommendedAction ?? null;
  const isSafe = !overallDecision || overallDecision === 'CONTINUE';

  return (
    <div>
      <PageHeader
        title={task.title}
        subtitle="Evidence Report"
        badge={
          <div style={{ display: 'flex', gap: 6 }}>
            <RiskBadge level={task.riskLevel} />
            <EnvBadge env={task.environment} />
            {overallDecision && <DecisionBadge decision={overallDecision} />}
          </div>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CreateShareLink entityType="task_report" entityId={task.id} />
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">← Task Detail</Link>
          </div>
        }
      />

      <Card style={{ maxWidth: 820 }}>
        {/* Report header strip */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '2px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task ID</div>
            <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{task.id}</code>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {task.createdAt.toISOString().replace('T', ' ').slice(0, 16)} UTC
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Overall Safety</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: isSafe ? 'var(--green-text)' : 'var(--red-text)' }}>
              {isSafe ? '✓ Safe to continue' : `⚠ ${overallDecision?.replace(/_/g, ' ')}`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Report Generated</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC
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
              <span className="meta-value"><StatusBadge status={task.status} /></span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Approval</span>
              <span className="meta-value">
                {task.approvalRequired ? `Required — ${approvalStatus}` : 'Not required'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Operator Sessions</span>
              <span className="meta-value">{sessions.length} recorded</span>
            </div>
          </div>
        </ReportSection>

        {/* Latest operator session decision */}
        {latestSession && (
          <ReportSection title={`Latest Decision (Step ${latestSession.currentStep})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DecisionBanner
                decision={latestSession.recommendedAction ?? 'CONTINUE'}
                reason={latestSession.decisionReason}
                seniorApprovalRequired={latestSession.seniorApprovalRequired}
              />

              {latestSession.riskFlags.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Risk Flags ({latestSession.riskFlags.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {getRiskFlagDetails(latestSession.riskFlags).map((f) => (
                      <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <SeverityBadge severity={f.severity} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {latestSession.filesMentioned.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Files Changed</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {latestSession.filesMentioned.map((f) => (
                      <code key={f} style={{ fontSize: 11, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', color: 'var(--text-secondary)' }}>
                        {f}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {latestSession.commandsMentioned.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Commands Run</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {latestSession.commandsMentioned.map((c) => (
                      <code key={c} style={{ fontSize: 11, background: '#1e293b', color: '#e2e8f0', borderRadius: 4, padding: '1px 7px' }}>
                        {c}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {latestSession.agentResponse && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Agent Response (excerpt)</div>
                  <pre className="prompt-block" style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11 }}>
                    {latestSession.agentResponse.slice(0, 400)}{latestSession.agentResponse.length > 400 ? '\n…' : ''}
                  </pre>
                </div>
              )}

              {latestSession.nextPrompt && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Recommended Next Prompt</div>
                  <pre className="prompt-block" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {latestSession.nextPrompt}
                  </pre>
                </div>
              )}
            </div>
          </ReportSection>
        )}

        {/* Session timeline */}
        {sessions.length > 1 && (
          <ReportSection title={`Operator Session Timeline (${sessions.length} steps)`}>
            <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Step</th>
                  <th>Decision</th>
                  <th>Risk Flags</th>
                  <th>Missing Evidence</th>
                  <th style={{ width: 130 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const flagDetails = getRiskFlagDetails(s.riskFlags);
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>#{s.currentStep}</td>
                      <td>
                        {s.recommendedAction
                          ? <DecisionBadge decision={s.recommendedAction} />
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {flagDetails.length === 0
                          ? <span style={{ color: 'var(--green-text)', fontSize: 12 }}>✓ None</span>
                          : flagDetails.slice(0, 2).map((f) => f.label).join(', ') + (flagDetails.length > 2 ? ` +${flagDetails.length - 2}` : '')}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.missingEvidence.length === 0
                          ? <span style={{ color: 'var(--green-text)' }}>✓ None</span>
                          : s.missingEvidence.length + ' missing'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {s.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ReportSection>
        )}

        {/* Generated prompt */}
        <ReportSection title="Generated Prompt">
          <pre className="prompt-block prompt-block-scrollable">{prompt}</pre>
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
                        {log.instruction ? log.instruction.title.slice(0, 40) : '—'}
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
            Report generated {new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC
          </span>
        </div>
      </Card>
    </div>
  );
}
