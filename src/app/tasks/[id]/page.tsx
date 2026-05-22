import prisma from '@/lib/prisma';
import { buildPrompt } from '@/lib/promptBuilder';
import Link from 'next/link';
import RunPromptPanel from '@/components/RunPromptPanel';
import EvaluationList from '@/components/EvaluationList';
import ApprovalPanel from '@/components/ApprovalPanel';
import CopyButton from '@/components/CopyButton';

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