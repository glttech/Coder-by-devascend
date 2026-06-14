import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAuthEnabled } from '@/lib/session';
import { getFeatureFlags } from '@/lib/featureFlags';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import AgentRunActions from '@/components/AgentRunActions';
import SandboxPreviewPanel from '@/components/SandboxPreviewPanel';
import type { SandboxPlan } from '@/lib/sandboxPlanner';

export const dynamic = 'force-dynamic';

interface AgentRunPageProps {
  params: { id: string };
}

const STEP_TYPE_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'purple'> = {
  thought:     'neutral',
  tool_call:   'info',
  tool_result: 'success',
  message:     'purple',
};

function formatDuration(startedAt: Date, endedAt: Date | null): string {
  if (!endedAt) return '—';
  const ms = endedAt.getTime() - startedAt.getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

export default async function AgentRunPage({ params }: AgentRunPageProps) {
  // Auth guard
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }
  }

  const agentRunRaw = await prisma.agentRun.findUnique({
    where: { id: params.id },
    include: {
      steps: { orderBy: { stepIndex: 'asc' } },
      evaluations: true,
      task: { select: { id: true, title: true } },
    },
  });
  // sandboxPlan is a new column not yet reflected in generated Prisma types;
  // we access it via a safe cast after DB returns the real value.
  const agentRun = agentRunRaw as (typeof agentRunRaw & { sandboxPlan?: string | null }) | null;

  if (!agentRun) {
    notFound();
  }

  // Get user role for actions
  const currentUser = await getCurrentUser();
  const userRole = currentUser?.role ?? 'reviewer';

  const duration = formatDuration(agentRun.startedAt, agentRun.endedAt);

  const flags = getFeatureFlags();
  const sandboxPlan: SandboxPlan | null =
    agentRun.status === 'preview' && agentRun.sandboxPlan
      ? (JSON.parse(agentRun.sandboxPlan) as SandboxPlan)
      : null;

  return (
    <div>
      <PageHeader
        title="Agent Run"
        subtitle={
          <span>
            <Link href={`/tasks/${agentRun.task.id}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>
              {agentRun.task.title}
            </Link>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              {agentRun.id}
            </span>
          </span>
        }
        badge={
          <Badge
            text={agentRun.status}
            variant="status"
          />
        }
      />

      {/* Sandbox Preview Panel */}
      {(agentRun.status === 'preview' || !flags.sandboxMode) && sandboxPlan ? (
        <div className="section">
          <SandboxPreviewPanel
            agentRunId={agentRun.id}
            plan={sandboxPlan}
            sandboxEnabled={flags.sandboxMode}
            userRole={userRole}
          />
        </div>
      ) : agentRun.status === 'preview' && !sandboxPlan ? (
        <div className="section">
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              color: '#1d4ed8',
            }}
          >
            Sandbox mode is disabled. Set <code>FEATURE_SANDBOX_MODE=true</code> to enable.
          </div>
        </div>
      ) : null}

      {/* Timing metadata */}
      <div className="section">
        <Card size="sm">
          <div className="meta-grid">
            <div className="meta-row">
              <span className="meta-label">Tool</span>
              <span className="meta-value">{agentRun.selectedTool}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Started</span>
              <span className="meta-value">{agentRun.startedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Ended</span>
              <span className="meta-value">
                {agentRun.endedAt
                  ? `${agentRun.endedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`
                  : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Duration</span>
              <span className="meta-value">{duration}</span>
            </div>
            {agentRun.commitHash && (
              <div className="meta-row">
                <span className="meta-label">Commit</span>
                <span className="meta-value">
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{agentRun.commitHash}</span>
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Generated Prompt */}
      <div className="section">
        <Card>
          <CardHeader title="Generated Prompt" subtitle="The prompt sent to the agent" />
          <pre className="prompt-block prompt-block-scrollable">{agentRun.generatedPrompt}</pre>
        </Card>
      </div>

      {/* Response */}
      {agentRun.response && (
        <div className="section">
          <Card>
            <CardHeader title="Agent Response" />
            <pre className="prompt-block prompt-block-scrollable" style={{ fontSize: 12 }}>
              {agentRun.response}
            </pre>
            {(agentRun.filesChanged || agentRun.commandsRun || agentRun.testResult) && (
              <div className="meta-grid" style={{ marginTop: 12 }}>
                {agentRun.filesChanged && (
                  <div className="meta-row">
                    <span className="meta-label">Files changed</span>
                    <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{agentRun.filesChanged}</span>
                  </div>
                )}
                {agentRun.commandsRun && (
                  <div className="meta-row">
                    <span className="meta-label">Commands run</span>
                    <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{agentRun.commandsRun}</span>
                  </div>
                )}
                {agentRun.testResult && (
                  <div className="meta-row">
                    <span className="meta-label">Test result</span>
                    <span className="meta-value">{agentRun.testResult}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Steps Timeline */}
      {agentRun.steps.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Steps ({agentRun.steps.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agentRun.steps.map((step) => {
              const variant = STEP_TYPE_VARIANT[step.type] ?? 'neutral';
              return (
                <Card key={step.id} size="sm">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 24 }}>
                      {step.stepIndex}
                    </span>
                    <Badge text={step.type} variant={variant} />
                  </div>
                  <pre
                    className="prompt-block"
                    style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, margin: 0 }}
                  >
                    {step.content}
                  </pre>
                  {step.metadata && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                        metadata
                      </summary>
                      <pre style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, overflow: 'auto' }}>
                        {JSON.stringify(step.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Evaluations */}
      {agentRun.evaluations.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Evaluations ({agentRun.evaluations.length})</span>
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
                {agentRun.evaluations.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 500 }}>{ev.name}</td>
                    <td>
                      <span style={{ color: ev.passed ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {ev.passed ? '✓' : '✗'}
                      </span>
                    </td>
                    <td>
                      {ev.score != null
                        ? `${Math.round(ev.score * 100)}%`
                        : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {ev.reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="section">
        <AgentRunActions
          agentRunId={agentRun.id}
          status={agentRun.status}
          userRole={userRole}
        />
      </div>
    </div>
  );
}
