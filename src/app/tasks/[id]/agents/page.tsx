/**
 * Agent Orchestration Console — /tasks/[id]/agents
 *
 * Server component that shows the 7 built-in governance roles and any
 * existing role-based AgentRun records for this task.
 *
 * Hard safety notice: AI analysis produces a decision RECOMMENDATION only.
 * No action is taken automatically. Approval always requires human action
 * via the Approval panel on the task page.
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { BUILT_IN_ROLES } from '@/lib/agents/roles';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

interface AgentsPageProps {
  params: { id: string };
}

const RISK_BADGE_CLASS: Record<string, string> = {
  low: 'badge-success',
  medium: 'badge-warning',
  high: 'badge-sev-high',
};

const DECISION_BADGE_CLASS: Record<string, string> = {
  CONTINUE: 'badge-success',
  RUN_VALIDATION: 'badge-warning',
  ASK_AGENT_FOR_EVIDENCE: 'badge-neutral',
  SENIOR_APPROVAL_REQUIRED: 'badge-sev-high',
  BLOCKED: 'badge-sev-high',
};

export default async function AgentsPage({ params }: AgentsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      agentRuns: {
        where: { roleKey: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!task) {
    notFound();
  }

  // Compute senior approval requirement from role run history (PR 2.3)
  const seniorApprovalRuns = task.agentRuns.filter((run) => {
    if (!run.structuredOutput) return false;
    try {
      const parsed = JSON.parse(run.structuredOutput) as {
        requiresApproval?: boolean;
        decisionSuggestion?: string;
      };
      return (
        parsed.requiresApproval === true ||
        parsed.decisionSuggestion === 'SENIOR_APPROVAL_REQUIRED' ||
        parsed.decisionSuggestion === 'BLOCKED'
      );
    } catch {
      return false;
    }
  });

  return (
    <div>
      <PageHeader
        title="Agent Orchestration Console"
        subtitle={
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            Task: {task.title}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/tasks/${task.id}/trace`} className="btn btn-ghost btn-sm">
              Execution Trace
            </Link>
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">
              Back to Task
            </Link>
          </div>
        }
      />

      {/* Senior approval gate banner (PR 2.3) */}
      {seniorApprovalRuns.length > 0 && (
        <div className="section">
          <div
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '2px solid rgba(239,68,68,0.4)',
              borderRadius: 8,
              padding: '14px 18px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1.3 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--red, #dc2626)' }}>
                Senior Approval Required
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {seniorApprovalRuns.length} role run{seniorApprovalRuns.length !== 1 ? 's have' : ' has'} determined
                this task requires senior sign-off.
                No action can proceed until a human approves via the Approval panel.
              </div>
              <Link
                href={`/tasks/${task.id}#approval`}
                className="btn btn-sm btn-primary"
              >
                Go to Approval Panel →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Safety notice */}
      <div className="section">
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.3)',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Governance notice:</strong>{' '}
          AI analysis requires human approval — no action is taken automatically. Role outputs
          produce a decision recommendation only. All approvals must be granted by a human via
          the{' '}
          <Link href={`/tasks/${task.id}#approval`} style={{ color: 'var(--blue)' }}>
            Approval panel
          </Link>
          .
        </div>
      </div>

      {/* Task context */}
      <div className="section">
        <div className="card">
          <div
            className="card-header"
            style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}
          >
            <span className="card-title">Task Context</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className={`badge ${RISK_BADGE_CLASS[task.riskLevel] ?? 'badge-neutral'}`}>
                {task.riskLevel} risk
              </span>
              <span className="badge badge-neutral">{task.environment}</span>
            </div>
          </div>
          <div className="meta-grid" style={{ marginTop: 12 }}>
            <div className="meta-row">
              <span className="meta-label">Title</span>
              <span className="meta-value">{task.title}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Instruction</span>
              <span className="meta-value">{task.instruction}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">{task.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Available roles */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Available Governance Roles ({BUILT_IN_ROLES.length})</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BUILT_IN_ROLES.map((role) => {
            // Only show Run button if the role's maxRiskLevel >= task's riskLevel
            const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
            const roleMax = riskOrder[role.maxRiskLevel] ?? 0;
            const taskRisk = riskOrder[task.riskLevel] ?? 0;
            const canRun = roleMax >= taskRisk;

            return (
              <div
                key={role.key}
                className="card"
                style={{ padding: '14px 16px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{role.name}</span>
                      <span
                        className={`badge ${RISK_BADGE_CLASS[role.maxRiskLevel] ?? 'badge-neutral'}`}
                        style={{ fontSize: 11 }}
                      >
                        up to {role.maxRiskLevel} risk
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        margin: 0,
                        marginBottom: 4,
                      }}
                    >
                      {role.description}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        margin: 0,
                        fontStyle: 'italic',
                      }}
                    >
                      {role.purpose}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {canRun ? (
                      <form action={`/api/tasks/${task.id}/orchestrate`} method="POST">
                        <input type="hidden" name="roleKey" value={role.key} />
                        <button
                          type="submit"
                          className="btn btn-sm btn-primary"
                          title={`Run ${role.name} analysis on this task`}
                        >
                          Run
                        </button>
                      </form>
                    ) : (
                      <span
                        className="badge badge-neutral"
                        title={`This role (max: ${role.maxRiskLevel}) cannot act on ${task.riskLevel}-risk tasks`}
                        style={{ fontSize: 11 }}
                      >
                        Risk too high
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role-based run history */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">
            Role Run History ({task.agentRuns.length})
          </span>
        </div>
        {task.agentRuns.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: '32px 16px', textAlign: 'center' }}
          >
            <div className="empty-state-icon" style={{ fontSize: 24, marginBottom: 8 }}>
              ◎
            </div>
            <div className="empty-state-title">No role runs yet</div>
            <p className="empty-state-description" style={{ maxWidth: 360, margin: '0 auto' }}>
              Select a governance role above and click Run to start an analysis. Results will
              appear here.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Role</th>
                  <th>Risk Score</th>
                  <th>Decision</th>
                  <th>Requires Approval</th>
                  <th>Recommendation</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {task.agentRuns.map((run) => {
                  type ParsedOutput = {
                    decisionSuggestion?: string;
                    requiresApproval?: boolean;
                    recommendation?: string;
                  };
                  let parsed: ParsedOutput = {};
                  try {
                    if (run.structuredOutput) {
                      parsed = JSON.parse(run.structuredOutput) as ParsedOutput;
                    }
                  } catch {
                    // ignore parse errors
                  }

                  const decisionSuggestion = parsed.decisionSuggestion ?? '—';
                  const requiresApproval = parsed.requiresApproval;
                  const recommendation = parsed.recommendation ?? '—';

                  return (
                    <tr key={run.id} style={{ verticalAlign: 'top' }}>
                      <td>
                        <span className="id-chip">{run.id.slice(0, 8)}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{run.roleKey ?? '—'}</td>
                      <td>
                        {run.riskScore != null ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color:
                                run.riskScore >= 0.7
                                  ? 'var(--red, #ef4444)'
                                  : run.riskScore >= 0.4
                                  ? 'var(--amber, #f59e0b)'
                                  : 'var(--green, #22c55e)',
                            }}
                          >
                            {run.riskScore.toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {decisionSuggestion !== '—' ? (
                          <span
                            className={`badge ${DECISION_BADGE_CLASS[decisionSuggestion] ?? 'badge-neutral'}`}
                            style={{ fontSize: 11 }}
                          >
                            {decisionSuggestion}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {requiresApproval != null ? (
                          <span
                            className={requiresApproval ? 'badge-sev-high badge' : 'badge-success badge'}
                            style={{ fontSize: 11 }}
                          >
                            {requiresApproval ? 'Yes' : 'No'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        style={{
                          maxWidth: 300,
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={recommendation}
                      >
                        {recommendation}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {run.startedAt.toISOString().split('T')[0]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
