import prisma from '@/lib/prisma';
import { buildPrompt } from '@/lib/promptBuilder';
import Link from 'next/link';
import RunPromptPanel from '@/components/RunPromptPanel';
import EvaluationList from '@/components/EvaluationList';
import ApprovalPanel from '@/components/ApprovalPanel';
import CopyButton from '@/components/CopyButton';
import OperatorPanel from '@/components/OperatorPanel';
import InstructionActions from '@/components/InstructionActions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, RiskBadge, EnvBadge } from '@/components/ui/Badge';
import CloneTaskButton from '@/components/CloneTaskButton';
import DiagramPanel from '@/components/DiagramPanel';
import { generateTaskLifecycleDiagram } from '@/lib/diagrams';

export const dynamic = 'force-dynamic';

interface TaskPageProps {
  params: { id: string };
}

export default async function TaskPage({ params }: TaskPageProps) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      agentRuns: { include: { evaluations: true } },
      project: true,
      approval: true,
      instructions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!task) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Task not found</div>
        <p className="empty-state-description">This task ID does not exist or has been removed.</p>
      </div>
    );
  }

  const prompt = buildPrompt(task);

  return (
    <div>
      <PageHeader
        title={task.title}
        subtitle={
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            {task.id}
          </span>
        }
        badge={<RiskBadge level={task.riskLevel} />}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {!['completed', 'failed'].includes(task.status) && (
              <Link href={`/tasks/${task.id}/edit`} className="btn btn-ghost btn-sm">
                Edit
              </Link>
            )}
            <CloneTaskButton taskId={task.id} />
            <Link href={`/tasks/${task.id}/report`} className="btn btn-ghost btn-sm">
              Evidence Report →
            </Link>
          </div>
        }
      />

      {/* Metadata */}
      <div className="section">
        <Card>
          <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span className="card-title">Task Details</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <EnvBadge env={task.environment} />
              <span className="badge badge-neutral">{task.agentTool}</span>
            </div>
          </div>
          <div className="meta-grid" style={{ marginTop: 12 }}>
            <div className="meta-row">
              <span className="meta-label">Instruction</span>
              <span className="meta-value">{task.instruction}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">{task.status}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Approval required</span>
              <span className="meta-value">{task.approvalRequired ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Approval */}
      {task.approvalRequired && (
        <div className="section">
          <ApprovalPanel
            taskId={task.id}
            approvalRequired={task.approvalRequired}
            approved={task.approval?.approved}
          />
        </div>
      )}

      {/* Generated Prompt */}
      <div className="section">
        <Card>
          <CardHeader title="Generated Prompt" subtitle="Structured execution prompt ready to paste into your AI agent" />
          <pre className="prompt-block prompt-block-scrollable">{prompt}</pre>
          <div style={{ marginTop: 10 }}>
            <CopyButton text={prompt} />
          </div>
        </Card>
      </div>

      {/* New Agent Run */}
      <div className="section">
        <Card>
          <CardHeader title="Record Agent Run" subtitle="Submit the agent response to evaluate and track the run" />
          <RunPromptPanel taskId={task.id} prompt={prompt} defaultTool={task.agentTool} />
        </Card>
      </div>

      {/* Instructions lifecycle */}
      <div className="section" id="instructions">
        <div className="section-header">
          <span className="section-title">Instructions ({task.instructions.length})</span>
        </div>
        {task.instructions.length === 0 ? (
          <EmptyState
            icon="◉"
            title="No instructions linked"
            description="Instructions track discrete work items through the approval → execution → completion lifecycle. Create one via the API to start."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>State Version</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {task.instructions.map((instr) => (
                  <tr key={instr.id} style={{ verticalAlign: 'top' }}>
                    <td>
                      <span className="id-chip">{instr.id.slice(0, 8)}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{instr.title}</td>
                    <td><StatusBadge status={instr.status} /></td>
                    <td>
                      <span
                        className="id-chip"
                        title={instr.stateVersion ?? undefined}
                        style={{ cursor: instr.stateVersion ? 'help' : 'default' }}
                      >
                        {instr.stateVersion ? instr.stateVersion.slice(0, 12) : '—'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {instr.createdAt.toISOString().split('T')[0]}
                    </td>
                    <td>
                      <InstructionActions instructionId={instr.id} currentStatus={instr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operator Console */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Operator Console</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          After running the prompt in an AI coding agent, paste the response here. The system will
          analyze risk, check for missing evidence, and generate a safe next step.
        </p>
        <OperatorPanel taskId={task.id} taskTitle={task.title} />
      </div>

      {/* Previous Runs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Previous Runs ({task.agentRuns.length})</span>
        </div>
        {task.agentRuns.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No runs recorded yet"
            description="Submit an agent response above to record a run and see evaluation results here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {task.agentRuns.map((run) => (
              <Card key={run.id} size="sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="id-chip">{run.id.slice(0, 8)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{run.selectedTool}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{run.status}</span>
                </div>
                <pre className="prompt-block" style={{ maxHeight: 160, overflowY: 'auto', fontSize: 11 }}>
                  {run.response || 'No response recorded.'}
                </pre>
                {run.evaluations.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <EvaluationList evaluations={run.evaluations} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Diagrams */}
      <div className="section">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Diagrams
        </div>
        <Card>
          <CardHeader title="Task Diagrams" subtitle="Generate and save visual diagrams for this task" />
          <DiagramPanel
            entityType="task"
            entityId={task.id}
            generators={[
              {
                kind: 'task_lifecycle',
                label: '📊 Lifecycle',
                source: generateTaskLifecycleDiagram({
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  riskLevel: task.riskLevel,
                  approvalRequired: task.approvalRequired,
                  agentRuns: task.agentRuns,
                  instructions: task.instructions,
                }),
              },
            ]}
          />
        </Card>
      </div>

      {/* Activity Log */}
      <div className="section">
        <div className="section-title">Activity Log</div>
        <div className="card" style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
          View detailed activity in the <a href="/audit" style={{ color: 'var(--blue)' }}>Audit Log</a>.
        </div>
      </div>
    </div>
  );
}
