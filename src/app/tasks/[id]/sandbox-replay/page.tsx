/**
 * Sandbox Replay Comparison Page — /tasks/[id]/sandbox-replay
 *
 * Server component. Shows a side-by-side comparison of the PLANNED sandbox
 * execution vs the ACTUAL execution for an agent run.
 *
 * Auth: any authenticated user (redirect to /auth/login if not).
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { featureFlags } from '@/lib/featureFlags';
import { PageHeader } from '@/components/ui/PageHeader';
import type { SandboxPlan } from '@/lib/sandboxPlanner';

export const dynamic = 'force-dynamic';

interface SandboxReplayPageProps {
  params: { id: string };
}

/** Parse a nullable JSON string safely; returns null on error or if input is null. */
function tryParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Compute which files were extra/missing between planned and actual. */
function computeFileDiff(
  plannedFiles: string[],
  actualFiles: string[],
): { extra: string[]; missing: string[] } {
  const plannedSet = new Set(plannedFiles);
  const actualSet = new Set(actualFiles);
  const extra = actualFiles.filter((f) => !plannedSet.has(f));
  const missing = plannedFiles.filter(
    (f) => !actualSet.has(f) && f !== '(files to be determined by agent)',
  );
  return { extra, missing };
}

/** Map estimatedRisk string to a numeric score for delta display. */
function riskLevelToScore(level: string | null | undefined): number | null {
  if (!level) return null;
  if (level === 'low') return 0.2;
  if (level === 'medium') return 0.5;
  if (level === 'high') return 0.8;
  return null;
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="badge badge-neutral">—</span>;
  const cls =
    score >= 0.7
      ? 'badge-sev-high'
      : score >= 0.4
      ? 'badge-warning'
      : 'badge-success';
  return (
    <span className={`badge ${cls}`} style={{ fontFamily: 'monospace' }}>
      {score.toFixed(2)}
    </span>
  );
}

function RiskLevelBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <span className="badge badge-neutral">—</span>;
  const cls =
    level === 'high'
      ? 'badge-sev-high'
      : level === 'medium'
      ? 'badge-warning'
      : 'badge-success';
  return <span className={`badge ${cls}`}>{level}</span>;
}

export default async function SandboxReplayPage({ params }: SandboxReplayPageProps) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    redirect('/auth/login');
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      approval: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!task) {
    notFound();
  }

  // Fetch the most recent AgentRun with a sandboxPlan
  const agentRun = await prisma.agentRun.findFirst({
    where: { taskId: params.id, sandboxPlan: { not: null } },
    orderBy: { startedAt: 'desc' },
  });

  // Count total evidence chunks for this task
  const evidenceCount = await prisma.evidenceChunk.count({
    where: { taskId: params.id },
  });

  const sandboxPlan = agentRun ? tryParseJson<SandboxPlan>(agentRun.sandboxPlan) : null;

  // Parse actual files/commands from agentRun fields
  const actualFiles: string[] = agentRun?.filesChanged
    ? agentRun.filesChanged
        .split(/[,\n]/)
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  const actualCommands: string[] = agentRun?.commandsRun
    ? agentRun.commandsRun
        .split(/[,\n]/)
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const plannedFiles = sandboxPlan?.plannedFiles ?? [];
  const plannedCommands = sandboxPlan?.plannedCommands ?? [];

  const fileDiff = computeFileDiff(plannedFiles, actualFiles);

  // Risk delta
  const plannedRiskScore = riskLevelToScore(sandboxPlan?.estimatedRisk);
  const actualRiskScore = agentRun?.riskScore ?? null;
  const riskDelta =
    plannedRiskScore !== null && actualRiskScore !== null
      ? actualRiskScore - plannedRiskScore
      : null;

  // Evidence gap: were any evidence chunks captured?
  const evidenceGapDetected = agentRun !== null && evidenceCount === 0;

  // Approval status
  const approvalStatus = task.approval
    ? task.approval.approved === true
      ? 'Approved'
      : task.approval.approved === false
      ? 'Rejected'
      : 'Pending'
    : null;
  const approverName = task.approval?.user
    ? (task.approval.user.name ?? task.approval.user.email)
    : null;

  return (
    <div>
      <PageHeader
        title="Sandbox Replay"
        subtitle={
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            Task: {task.title}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/tasks/${task.id}/trace`} className="btn btn-ghost btn-sm">
              Trace
            </Link>
            <Link href={`/tasks/${task.id}/evidence`} className="btn btn-ghost btn-sm">
              Evidence
            </Link>
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost btn-sm">
              Back to Task
            </Link>
          </div>
        }
      />

      {/* Sandbox mode disabled banner */}
      {!featureFlags.sandboxMode && (
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
            <strong style={{ color: 'var(--text-primary)' }}>
              Sandbox Replay is not enabled in this environment.
            </strong>{' '}
            Set{' '}
            <code
              style={{
                background: 'rgba(99,102,241,0.1)',
                padding: '1px 5px',
                borderRadius: 3,
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              FEATURE_SANDBOX_MODE=true
            </code>{' '}
            to enable live sandbox execution. Historical replay data from previous sandbox runs is
            shown below.
          </div>
        </div>
      )}

      {/* No sandbox plan found */}
      {!agentRun && (
        <div className="section">
          <div
            className="empty-state"
            style={{ padding: '32px 16px', textAlign: 'center' }}
          >
            <div className="empty-state-icon" style={{ fontSize: 24, marginBottom: 8 }}>
              ◎
            </div>
            <div className="empty-state-title">No sandbox plan recorded</div>
            <p className="empty-state-description" style={{ maxWidth: 400, margin: '0 auto' }}>
              No agent runs with a sandbox plan were found for this task.
              Trigger a sandbox preview via the API to generate one.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {agentRun && (
        <>
          {/* Run summary */}
          <div className="section">
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    Agent Run
                  </div>
                  <span className="id-chip" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {agentRun.id.slice(0, 8)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    Status
                  </div>
                  <span className="badge badge-neutral">{agentRun.status}</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    Tool
                  </div>
                  <span className="badge badge-neutral">{agentRun.selectedTool}</span>
                </div>
                {agentRun.commitHash && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                      Commit
                    </div>
                    <span className="id-chip">{agentRun.commitHash.slice(0, 12)}</span>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                    Started
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {agentRun.startedAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column comparison */}
          <div className="section">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              {/* LEFT: Planned Execution */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 14,
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--blue, #3b82f6)',
                      display: 'inline-block',
                    }}
                  />
                  Planned Execution
                </div>

                {sandboxPlan ? (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 6,
                        }}
                      >
                        Summary
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                        {sandboxPlan.summary}
                      </p>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 6,
                        }}
                      >
                        Planned Files ({plannedFiles.length})
                      </div>
                      {plannedFiles.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {plannedFiles.map((f, i) => (
                            <span
                              key={i}
                              className="badge badge-neutral"
                              style={{ fontFamily: 'monospace', fontSize: 10, alignSelf: 'flex-start' }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 6,
                        }}
                      >
                        Planned Commands ({plannedCommands.length})
                      </div>
                      {plannedCommands.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {plannedCommands.map((c, i) => (
                            <code
                              key={i}
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 11,
                                background: 'rgba(0,0,0,0.05)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                display: 'block',
                              }}
                            >
                              {c}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 6,
                        }}
                      >
                        Estimated Risk
                      </div>
                      <RiskLevelBadge level={sandboxPlan.estimatedRisk} />
                    </div>

                    {sandboxPlan.warnings.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            marginBottom: 6,
                          }}
                        >
                          Warnings
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {sandboxPlan.warnings.map((w, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 12,
                                color: 'var(--amber, #f59e0b)',
                                marginBottom: 2,
                              }}
                            >
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    No sandbox plan data available.
                  </p>
                )}
              </div>

              {/* RIGHT: Actual Results */}
              <div className="card" style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 14,
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--green, #22c55e)',
                      display: 'inline-block',
                    }}
                  />
                  Actual Results
                </div>

                {agentRun.response ? (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Response Summary
                    </div>
                    <pre
                      style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        background: 'rgba(0,0,0,0.04)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        maxHeight: 120,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        margin: 0,
                      }}
                    >
                      {agentRun.response.slice(0, 600)}
                      {agentRun.response.length > 600 ? '…' : ''}
                    </pre>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                    No response recorded.
                  </p>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
                    Files Changed ({actualFiles.length})
                  </div>
                  {actualFiles.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None recorded</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {actualFiles.map((f, i) => (
                        <span
                          key={i}
                          className="badge badge-success"
                          style={{ fontFamily: 'monospace', fontSize: 10, alignSelf: 'flex-start' }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
                    Commands Run ({actualCommands.length})
                  </div>
                  {actualCommands.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None recorded</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {actualCommands.map((c, i) => (
                        <code
                          key={i}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            background: 'rgba(0,0,0,0.05)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            display: 'block',
                          }}
                        >
                          {c}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                {agentRun.testResult && (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 6,
                      }}
                    >
                      Test Result
                    </div>
                    <span
                      className={`badge ${
                        agentRun.testResult.toLowerCase().includes('pass')
                          ? 'badge-success'
                          : agentRun.testResult.toLowerCase().includes('fail')
                          ? 'badge-sev-high'
                          : 'badge-neutral'
                      }`}
                    >
                      {agentRun.testResult}
                    </span>
                  </div>
                )}

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 6,
                    }}
                  >
                    Actual Risk Score
                  </div>
                  <RiskBadge score={actualRiskScore} />
                </div>
              </div>
            </div>
          </div>

          {/* Diff Summary Section */}
          <div className="section">
            <div className="section-header">
              <span className="section-title">Diff Summary — Planned vs Actual</span>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              {fileDiff.extra.length === 0 && fileDiff.missing.length === 0 && actualCommands.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  No deviations detected — actual execution matched the plan, or insufficient data to compare.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fileDiff.extra.length > 0 && (
                    <div
                      style={{
                        background: 'rgba(239,68,68,0.04)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 6,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626', marginBottom: 6 }}>
                        {fileDiff.extra.length} extra file{fileDiff.extra.length !== 1 ? 's' : ''} modified
                        (not in plan)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {fileDiff.extra.map((f, i) => (
                          <span
                            key={i}
                            className="badge badge-sev-high"
                            style={{ fontFamily: 'monospace', fontSize: 10 }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {fileDiff.missing.length > 0 && (
                    <div
                      style={{
                        background: 'rgba(251,191,36,0.06)',
                        border: '1px solid rgba(251,191,36,0.3)',
                        borderRadius: 6,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#b45309', marginBottom: 6 }}>
                        {fileDiff.missing.length} planned file{fileDiff.missing.length !== 1 ? 's' : ''} not
                        modified
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {fileDiff.missing.map((f, i) => (
                          <span
                            key={i}
                            className="badge badge-warning"
                            style={{ fontFamily: 'monospace', fontSize: 10 }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {actualCommands.length > 0 &&
                    actualCommands.some((c) => !plannedCommands.includes(c)) && (
                      <div
                        style={{
                          background: 'rgba(239,68,68,0.04)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 6,
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626', marginBottom: 6 }}>
                          Unexpected commands run
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {actualCommands
                            .filter((c) => !plannedCommands.includes(c))
                            .map((c, i) => (
                              <code
                                key={i}
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  background: 'rgba(239,68,68,0.08)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  display: 'block',
                                  color: '#dc2626',
                                }}
                              >
                                {c}
                              </code>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* What-If Analysis */}
          <div className="section">
            <div className="section-header">
              <span className="section-title">What-If Analysis</span>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div className="meta-grid">
                {/* Risk delta */}
                <div className="meta-row">
                  <span className="meta-label">Planned Risk</span>
                  <span className="meta-value">
                    <RiskLevelBadge level={sandboxPlan?.estimatedRisk} />
                    {plannedRiskScore !== null && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        ({plannedRiskScore.toFixed(2)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Actual Risk Score</span>
                  <span className="meta-value">
                    <RiskBadge score={actualRiskScore} />
                  </span>
                </div>
                {riskDelta !== null && (
                  <div className="meta-row">
                    <span className="meta-label">Risk Delta</span>
                    <span className="meta-value">
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            riskDelta > 0.1
                              ? '#dc2626'
                              : riskDelta < -0.1
                              ? 'var(--green, #22c55e)'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {riskDelta > 0 ? '+' : ''}
                        {riskDelta.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                        {riskDelta > 0.1
                          ? '— execution was riskier than planned'
                          : riskDelta < -0.1
                          ? '— execution was safer than planned'
                          : '— within expected range'}
                      </span>
                    </span>
                  </div>
                )}

                {/* Evidence gap */}
                <div className="meta-row">
                  <span className="meta-label">Evidence Captured</span>
                  <span className="meta-value">
                    {evidenceGapDetected ? (
                      <span className="badge badge-warning">Gap detected — 0 evidence chunks</span>
                    ) : (
                      <span className="badge badge-success">
                        {evidenceCount} chunk{evidenceCount !== 1 ? 's' : ''} captured
                      </span>
                    )}
                  </span>
                </div>

                {/* Approval status */}
                <div className="meta-row">
                  <span className="meta-label">Approval Status</span>
                  <span className="meta-value">
                    {approvalStatus ? (
                      <span
                        className={`badge ${
                          approvalStatus === 'Approved'
                            ? 'badge-success'
                            : approvalStatus === 'Rejected'
                            ? 'badge-sev-high'
                            : 'badge-warning'
                        }`}
                      >
                        {approvalStatus}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">No approval record</span>
                    )}
                    {approverName && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        by {approverName}
                      </span>
                    )}
                  </span>
                </div>

                {/* Sandbox plan approval requirement */}
                {sandboxPlan && (
                  <div className="meta-row">
                    <span className="meta-label">Plan Requires Approval</span>
                    <span className="meta-value">
                      {sandboxPlan.requiresApproval ? (
                        <span className="badge badge-warning">Yes</span>
                      ) : (
                        <span className="badge badge-success">No</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
