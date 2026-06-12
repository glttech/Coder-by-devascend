import type { AgentProviderAdapter, AgentRunInput, AgentRunOutput, AgentStepEvent } from './types';

export interface MockProviderConfig {
  delayMs?: number;       // default 100
  outcome?: 'succeeded' | 'failed'; // default 'succeeded'
  response?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAgentProvider implements AgentProviderAdapter {
  readonly type = 'mock';
  private config: MockProviderConfig;

  constructor(config: MockProviderConfig = {}) {
    this.config = config;
  }

  async run(input: AgentRunInput): Promise<AgentRunOutput> {
    const delayMs = this.config.delayMs ?? 100;
    const outcome = this.config.outcome ?? 'succeeded';
    const response = this.config.response ?? `Mock run completed for task ${input.taskId}`;

    await sleep(delayMs);

    return { status: outcome, response };
  }

  async stream(
    input: AgentRunInput,
    onStep: (step: AgentStepEvent) => void,
  ): Promise<AgentRunOutput> {
    const delayMs = this.config.delayMs ?? 100;
    const outcome = this.config.outcome ?? 'succeeded';
    const response = this.config.response ?? `Mock run completed for task ${input.taskId}`;

    await sleep(Math.floor(delayMs / 3));

    onStep({ stepIndex: 0, type: 'thought', content: 'Analyzing task...' });

    await sleep(Math.floor(delayMs / 3));

    onStep({ stepIndex: 1, type: 'message', content: response });

    return { status: outcome, response };
  }
}
