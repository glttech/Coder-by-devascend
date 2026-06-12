export interface AgentRunInput {
  agentRunId: string;
  taskId: string;
  prompt: string;
  config?: Record<string, unknown>;
}

export interface AgentRunOutput {
  status: 'succeeded' | 'failed';
  response?: string;
  filesChanged?: string;
  commandsRun?: string;
  testResult?: string;
  commitHash?: string;
  error?: string;
}

export interface AgentStepEvent {
  stepIndex: number;
  type: string; // "thought" | "tool_call" | "tool_result" | "message"
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentProviderAdapter {
  readonly type: string;
  run(input: AgentRunInput): Promise<AgentRunOutput>;
  // Optional streaming — providers may not implement
  stream?(input: AgentRunInput, onStep: (step: AgentStepEvent) => void): Promise<AgentRunOutput>;
}
