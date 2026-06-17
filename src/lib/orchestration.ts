export const AGENT_RUN_STATUSES = [
  'draft',
  'awaiting_approval',
  'queued',
  'running',
  'succeeded',
  'failed',
  'blocked',
  'cancelled',
] as const;

export type AgentRunStatus = typeof AGENT_RUN_STATUSES[number];

export function isTerminalStatus(status: AgentRunStatus): boolean {
  return ['succeeded', 'failed', 'blocked', 'cancelled'].includes(status);
}

export function isActiveStatus(status: AgentRunStatus): boolean {
  return ['queued', 'running'].includes(status);
}

export function canTransitionTo(from: AgentRunStatus, to: AgentRunStatus): boolean {
  const transitions: Record<AgentRunStatus, AgentRunStatus[]> = {
    draft: ['awaiting_approval', 'cancelled'],
    awaiting_approval: ['queued', 'blocked', 'cancelled'],
    queued: ['running', 'cancelled'],
    running: ['succeeded', 'failed', 'blocked'],
    succeeded: [],
    failed: [],
    blocked: [],
    cancelled: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
