/**
 * Execution Trace Viewer — /tasks/[id]/trace
 *
 * Server component. Shows the immutable governance trace history for a task.
 * Traces are append-only and cannot be modified or deleted.
 *
 * Auth: any authenticated user (redirect to /auth/login if not).
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

interface TracePageProps {
  params: { id: string };
}

const DECISION_BADGE_CLASS: Record<string, string> = {
  CONTINUE: 'badge-success',
  RUN_VALIDATION: 'badge-warning',
  ASK_AGENT_FOR_EVIDENCE: 'badge-neutral',
  SENIOR_APPROVAL_REQUIRED: 'badge-sev-high',
  BLOCKED: 'badge-sev-high',
};

const APPROVAL_BADGE_CLASS: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-sev-high',
  not_required: 'badge-neutral',
};

export default async function TracePage({ params }: TracePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
  });

  if (!task) {
    notFound();
  }

  const traces = await prisma.executionTrace.findMany({
    where: {
      orgId: 'org_default',
      taskId: params.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Execution Trace"
        subtitle={
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            Task: {task.title}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/tasks/${task.id}/agents`} className="btn btn-ghost btn-sm">
              Agents
            </Link>
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">
              Back to Task
            </Link>
            <a
              href={`/api/traces/export?taskId=${task.id}`}
              className="btn btn-ghost btn-sm"
              download
            >
              Export CSV
            </a>
          </div>
        }
      />

      {/* Immutability notice */}
      <div className="section">
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.3)',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Governance record:</strong>{' '}
          Traces are immutable audit records — they cannot be modified or deleted.
          Every AI decision is captured here for review and accountability.
        </div>
      </div>

      {/* Trace list */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">
            Trace Entries ({traces.length})
          </span>
        </div>

        {traces.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: '32px 16px', textAlign: 'center' }}
          >
            <div className="empty-state-icon" style={{ fontSize: 24, marginBottom: 8 }}>
              ◎
            </div>
            <div className="empty-state-title">No trace entries yet</div>
            <p className="empty-state-description" style={{ maxWidth: 360, margin: '0 auto' }}>
              Run a governance role on this task to generate execution trace records.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {traces.map((trace) => {
              let formattedOutput: string | null = null;
              if (trace.finalOutput) {
                try {
                  formattedOutput = JSON.stringify(JSON.parse(trace.finalOutput), null, 2);
                } catch {
                  formattedOutput = trace.finalOutput;
                }
              }

              let parsedRiskFlags: string[] = [];
              if (trace.riskFlags) {
                try {
                  parsedRiskFlags = JSON.parse(trace.riskFlags) as string[];
                } catch {
                  // ignore
                }
              }

              return (
                <details key={trace.id} className="card" style={{ padding: '14px 16px' }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      listStyle: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {trace.id.slice(0, 8)}
                      </span>
                      {trace.roleKey && (
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{trace.roleKey}</span>
                      )}
                      {trace.decisionCode && (
                        <span
                          className={`badge ${DECISION_BADGE_CLASS[trace.decisionCode] ?? 'badge-neutral'}`}
                          style={{ fontSize: 11 }}
                        >
                          {trace.decisionCode}
                        </span>
                      )}
                      {trace.approvalState && (
                        <span
                          className={`badge ${APPROVAL_BADGE_CLASS[trace.approvalState] ?? 'badge-neutral'}`}
                          style={{ fontSize: 11 }}
                        >
                          {trace.approvalState}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {trace.riskScore != null && (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color:
                              trace.riskScore >= 0.7
                                ? 'var(--red, #ef4444)'
                                : trace.riskScore >= 0.4
                                ? 'var(--amber, #f59e0b)'
                                : 'var(--green, #22c55e)',
                          }}
                        >
                          risk: {trace.riskScore.toFixed(2)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {trace.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                      </span>
                    </div>
                  </summary>

                  {/* Expanded detail */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <div className="meta-grid">
                      <div className="meta-row">
                        <span className="meta-label">Trace ID</span>
                        <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          {trace.id}
                        </span>
                      </div>
                      {trace.agentRunId && (
                        <div className="meta-row">
                          <span className="meta-label">Agent Run ID</span>
                          <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                            {trace.agentRunId}
                          </span>
                        </div>
                      )}
                      {trace.modelUsed && (
                        <div className="meta-row">
                          <span className="meta-label">Model</span>
                          <span className="meta-value">{trace.modelUsed}</span>
                        </div>
                      )}
                      {trace.promptTokens != null && (
                        <div className="meta-row">
                          <span className="meta-label">Prompt Tokens</span>
                          <span className="meta-value">{trace.promptTokens}</span>
                        </div>
                      )}
                      {trace.completionTokens != null && (
                        <div className="meta-row">
                          <span className="meta-label">Completion Tokens</span>
                          <span className="meta-value">{trace.completionTokens}</span>
                        </div>
                      )}
                      {parsedRiskFlags.length > 0 && (
                        <div className="meta-row">
                          <span className="meta-label">Risk Flags</span>
                          <span className="meta-value">
                            {parsedRiskFlags.map((flag) => (
                              <span
                                key={flag}
                                className="badge badge-sev-high"
                                style={{ fontSize: 10, marginRight: 4 }}
                              >
                                {flag}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                      {trace.promptSent && (
                        <div className="meta-row" style={{ alignItems: 'flex-start' }}>
                          <span className="meta-label">Prompt Sent</span>
                          <span
                            className="meta-value"
                            style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}
                          >
                            {trace.promptSent}
                          </span>
                        </div>
                      )}
                    </div>

                    {formattedOutput && (
                      <div style={{ marginTop: 12 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            marginBottom: 6,
                          }}
                        >
                          Final Output
                        </div>
                        <pre
                          style={{
                            background: 'var(--surface-raised, rgba(0,0,0,0.06))',
                            borderRadius: 6,
                            padding: '10px 12px',
                            fontSize: 11,
                            fontFamily: 'monospace',
                            overflowX: 'auto',
                            color: 'var(--text-primary)',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {formattedOutput}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
