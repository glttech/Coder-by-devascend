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
import TranscriptParser from '@/components/TranscriptParser';
import AuditTimeline from '@/components/AuditTimeline';
import DispatchAgentRunButton from '@/components/DispatchAgentRunButton';
import TaskComments from '@/components/TaskComments';

export const dynamic = 'force-dynamic';

const TOOL_DISPLAY: Record<string, string> = {
  'claude-code-manual': 'Claude Code',
  'codex-manual': 'Codex',
  'openclaw-manual': 'OpenClaw',
  'open-swe': 'Open SWE',
};

const ENV_DISPLAY: Record<string, string> = {
  'local': 'Local',
  'dev': 'Development',
  'staging': 'Staging',
  'production': 'Production',
};

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
      assignee: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true, projectId: true } },
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

  const approverId = task.approval?.approverId;
  const approver = approverId
    ? await prisma.user.findUnique({
        where: { id: approverId },
        select: { name: true, email: true },
      })
    : null;

  const creatorLog = await prisma.auditLog.findFirst({
    where: { taskId: task.id, event: 'task_created' },
    include: { user: { select: { name: true, email: true } } },
  });
  const requesterLabel = creatorLog?.user
    ? (creatorLog.user.name ?? creatorLog.user.email)
    : 'System';

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DispatchAgentRunButton taskId={task.id} taskTitle={task.title} />
            {!['completed', 'failed'].includes(task.status) && (
              <Link href={`/tasks/${task.id}/edit`} className="btn btn-ghost btn-sm">
                Edit
              </Link>
            )}
            <CloneTaskButton taskId={task.id} />
            <Link href={`/tasks/${task.id}/report`} className="btn btn-ghost btn-sm">
              View Summary Report →
            </Link>
          </div>
        }
      />

      {/* What to do next — status-based guidance */}
      {task.status === 'pending' && !task.approvalRequired && (
        <div className="section">
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--blue)' }}>Next step:</strong> Copy the generated prompt below, run it in your AI tool, then paste the response back in the &ldquo;Submit AI Response&rdquo; section.
          </div>
        </div>
      )}
      {task.status === 'completed' && (
        <div className="section">
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#16a34a' }}>Task complete.</strong> View the full summary in the <a href={`/tasks/${task.id}/report`} style={{ color: 'var(--blue)' }}>Summary Report</a>.
          </div>
        </div>
      )}
      {task.status === 'failed' && (
        <div className="section">
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#dc2626' }}>Task failed.</strong> Check the AI responses and audit log below for details. You can <a href={`/tasks/${task.id}/edit`} style={{ color: 'var(--blue)' }}>edit the task</a> and retry.
          </div>
        </div>
      )}

      {/* Approval callout — shown when task is awaiting human review */}
      {task.approvalRequired &&
        (task.status === 'pending_approval' || task.status === 'awaiting_approval') && (
        <div className="section">
          <div style={{
            background: 'var(--amber-bg, rgba(251,191,36,0.08))',
            border: '1px solid var(--amber-border, rgba(251,191,36,0.4))',
            borderRadius: 8,
            padding: '14px 18px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1.3 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                This task is waiting for your review.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                The AI has submitted a suggestion. Look at the <strong>AI Suggestions</strong> section below and click <strong>Approve</strong> to accept it, or <strong>Block</strong> to reject it.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="section">
        <Card>
          <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span className="card-title">Task Details</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <EnvBadge env={task.environment} />
              <span className="badge badge-neutral">{TOOL_DISPLAY[task.agentTool] ?? task.agentTool}</span>
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
              <span className="meta-label">Environment</span>
              <span className="meta-value">{ENV_DISPLAY[task.environment] ?? task.environment}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Approval required</span>
              <span className="meta-value">{task.approvalRequired ? 'Yes' : 'No'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Requested by</span>
              <span className="meta-value">{requesterLabel}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Priority</span>
              <span className="meta-value">
                <span className={`badge ${
                  task.priority === 'critical' ? 'badge-sev-high' :
                  task.priority === 'high' ? 'badge-sev-high' :
                  task.priority === 'medium' ? 'badge-warning' : 'badge-success'
                }`} style={task.priority === 'high' ? { background: 'rgba(249,115,22,0.12)', color: '#ea6c00', borderColor: 'rgba(249,115,22,0.3)' } : undefined}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Due date</span>
              <span className="meta-value">
                {task.dueDate ? (
                  <span style={task.dueDate < new Date() ? { color: 'var(--red, #ef4444)', fontWeight: 500 } : undefined}>
                    {task.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : '—'}
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
              <span className="meta-value">
                {task.milestone ? (
                  <Link href={`/projects/${task.milestone.projectId}/milestones/${task.milestone.id}`} style={{ color: 'var(--blue)' }}>
                    {task.milestone.title}
                  </Link>
                ) : '—'}
              </span>
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
            approverName={approver?.name ?? approver?.email ?? undefined}
          />
        </div>
      )}

      {/* Generated Prompt */}
      <div className="section">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Step 1 — Copy the prompt
        </div>
        <Card>
          <CardHeader title="Generated Prompt" subtitle="Structured execution prompt ready to paste into your AI agent" />
          <pre className="prompt-block prompt-block-scrollable">{prompt}</pre>
          <div style={{ marginTop: 10 }}>
            <CopyButton text={prompt} />
          </div>
        </Card>
      </div>

      {/* Submit AI Response */}
      <div className="section">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Step 2 — Submit the AI response
        </div>
        <div className="section-header">
          <span className="section-title">Submit AI Response</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          After using the AI tool with the prompt above, paste its response here. The system will
          check it for safety and tell you what to do next.
        </p>
        <OperatorPanel taskId={task.id} taskTitle={task.title} />
      </div>

      {/* Parse AI Transcript */}
      <div className="section">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Step 2b — Parse AI Transcript
        </div>
        <TranscriptParser taskId={task.id} />
      </div>

      {/* AI Suggestions lifecycle */}
      <div className="section" id="instructions">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Step 3 — Review suggestions
        </div>
        <div className="section-header">
          <span className="section-title">AI Suggestions ({task.instructions.length})</span>
        </div>
        {task.instructions.length === 0 ? (
          <EmptyState
            icon="💡"
            title="No AI suggestions yet"
            description="Use the prompt below to get a response from your AI tool, then paste it back here."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Version</th>
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

      {/* New Agent Run */}
      <div className="section">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
          Track AI responses
        </div>
        <Card>
          <CardHeader title="Record AI Response" subtitle="Submit the AI response to evaluate and track the run" />
          <RunPromptPanel taskId={task.id} prompt={prompt} defaultTool={task.agentTool} />
        </Card>
      </div>

      {/* AI Response History */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">AI Response History ({task.agentRuns.length})</span>
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
      {/* Comments */}
      <div className="section"><div className="card"><TaskComments taskId={task.id} /></div></div>

      {/* Activity Log */}
      <div className="section">
        <details>
          <summary style={{
            cursor: 'pointer',
            userSelect: 'none',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="section-title" style={{ pointerEvents: 'none' }}>Activity Log</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>▸ expand</span>
          </summary>
          <div style={{ marginTop: 16, position: 'relative' }}>
            <AuditTimeline taskId={task.id} />
          </div>
        </details>
      </div>
    </div>
  );
}
