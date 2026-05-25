import prisma from '@/lib/prisma';
import { buildPrompt } from '@/lib/promptBuilder';
import Link from 'next/link';
import RunPromptPanel from '@/components/RunPromptPanel';
import EvaluationList from '@/components/EvaluationList';
import ApprovalPanel from '@/components/ApprovalPanel';
import CopyButton from '@/components/CopyButton';
import OperatorPanel from '@/components/OperatorPanel';
import InstructionActions from '@/components/InstructionActions';

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  draft:            { background: '#6b7280', color: '#fff' },
  pending_approval: { background: '#d97706', color: '#fff' },
  approved:         { background: '#2563eb', color: '#fff' },
  executing:        { background: '#7c3aed', color: '#fff' },
  completed:        { background: '#16a34a', color: '#fff' },
  blocked:          { background: '#dc2626', color: '#fff' },
};

function InstructionStatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? { background: '#6b7280', color: '#fff' };
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...style }}>
      {status.replace('_', ' ')}
    </span>
  );
}

interface TaskPageProps {
  params: { id: string };
}

/**
 * Task detail page.  Displays the generated execution prompt, existing runs,
 * evaluation results and approval panel.  Users can copy the prompt, run
 * it manually, paste the response, and record the run.
 */
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
    return <p className="text-red-600">Task not found.</p>;
  }
  const prompt = buildPrompt(task);
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Task Details</h2>
        <div className="space-y-1 text-sm">
          <div><strong>Title:</strong> {task.title}</div>
          <div><strong>Instruction:</strong> {task.instruction}</div>
          <div><strong>Agent Tool:</strong> {task.agentTool}</div>
          <div><strong>Risk Level:</strong> {task.riskLevel}</div>
          <div><strong>Environment:</strong> {task.environment}</div>
          <div><strong>Status:</strong> {task.status}</div>
          <div><strong>Approval Required:</strong> {task.approvalRequired ? 'Yes' : 'No'}</div>
        </div>
      </section>

      {/* Approval section */}
      <section>
        <ApprovalPanel
          taskId={task.id}
          approvalRequired={task.approvalRequired}
          approved={task.approval?.approved}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Generated Prompt</h2>
        <div className="bg-gray-100 border rounded p-4 whitespace-pre-wrap text-sm">
          {prompt}
        </div>
        {/* CopyButton is a client component, imported from '@/components/CopyButton' */}
        <CopyButton text={prompt} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">New Agent Run</h2>
        <RunPromptPanel taskId={task.id} prompt={prompt} defaultTool={task.agentTool} />
      </section>

      {/* Instructions — Phase 2 lifecycle foundation */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        {task.instructions.length === 0 ? (
          <p className="text-sm text-gray-600">
            No instructions yet. Use <code>POST /api/instructions</code> with this task ID to create one.
          </p>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border-b py-2 text-left">ID</th>
                <th className="border-b py-2 text-left">Title</th>
                <th className="border-b py-2 text-left">Status</th>
                <th className="border-b py-2 text-left">Created</th>
                <th className="border-b py-2 text-left">State Version</th>
                <th className="border-b py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {task.instructions.map((instr) => (
                <tr key={instr.id} className="hover:bg-gray-100" style={{ verticalAlign: 'top' }}>
                  <td className="py-2 pr-2 text-xs" style={{ fontFamily: 'monospace' }}>{instr.id.slice(0, 8)}</td>
                  <td className="py-2 pr-2">{instr.title}</td>
                  <td className="py-2 pr-2">
                    <InstructionStatusBadge status={instr.status} />
                  </td>
                  <td className="py-2 pr-2">{instr.createdAt.toISOString().split('T')[0]}</td>
                  <td className="py-2 pr-2 text-xs" style={{ fontFamily: 'monospace', color: '#6b7280' }} title={instr.stateVersion ?? undefined}>
                    {instr.stateVersion ? instr.stateVersion.slice(0, 12) : '—'}
                  </td>
                  <td className="py-2 pr-2">
                    <InstructionActions instructionId={instr.id} currentStatus={instr.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Operator Console — Phase 1.5 */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Operator Console</h2>
        <p className="text-sm" style={{ color: '#6b7280', marginBottom: 12 }}>
          After running a prompt in an AI coding agent, paste the response here. The system will
          analyze risk, check for missing evidence, and generate a safe next prompt.
        </p>
        <OperatorPanel taskId={task.id} taskTitle={task.title} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Previous Runs</h2>
        {task.agentRuns.length === 0 ? (
          <p className="text-sm text-gray-600">No runs recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {task.agentRuns.map((run) => (
              <div key={run.id} className="border rounded p-4">
                <div className="flex justify-between text-sm mb-1">
                  <div>
                    <strong>Run:</strong> {run.id.slice(0, 8)} ({run.selectedTool})
                  </div>
                  <div>
                    <strong>Status:</strong> {run.status}
                  </div>
                </div>
                <div className="bg-gray-50 border rounded p-2 text-xs whitespace-pre-wrap mb-2">
                  {run.response || 'No response recorded.'}
                </div>
                {run.evaluations.length > 0 && (
                  <EvaluationList evaluations={run.evaluations} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}