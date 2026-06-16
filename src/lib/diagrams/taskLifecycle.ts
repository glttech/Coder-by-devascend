interface TaskData {
  id: string;
  title: string;
  status: string;
  riskLevel: string;
  approvalRequired: boolean;
  agentRuns: Array<{ id: string; status: string; startedAt: Date | null }>;
  instructions: Array<{ id: string; status: string; title: string }>;
}

export function generateTaskLifecycleDiagram(task: TaskData): string {
  const lines: string[] = ['stateDiagram-v2'];

  // State nodes
  lines.push('  [*] --> pending');
  lines.push('  pending --> running: agent dispatched');
  lines.push('  running --> completed: success');
  lines.push('  running --> failed: error');

  if (task.approvalRequired) {
    lines.push('  running --> pending_approval: response submitted');
    lines.push('  pending_approval --> completed: approved');
    lines.push('  pending_approval --> failed: rejected');
  }

  lines.push('  completed --> [*]');
  lines.push('  failed --> pending: retry');

  // Highlight current state
  const current = task.status;
  lines.push(`  note right of ${current.replace('_', '')}: ← current`);

  // Add run count note
  if (task.agentRuns.length > 0) {
    lines.push(`  note left of running: ${task.agentRuns.length} run(s) recorded`);
  }

  return lines.join('\n');
}
