import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAgentProvider } from '../providers/mock.js';
import type { AgentStepEvent } from '../providers/types.js';

describe('MockAgentProvider', () => {
  it('type equals mock', () => {
    const provider = new MockAgentProvider();
    assert.equal(provider.type, 'mock');
  });

  it('run() returns succeeded with default config', async () => {
    const provider = new MockAgentProvider({ delayMs: 0 });
    const result = await provider.run({ agentRunId: 'run-1', taskId: 'task-1', prompt: 'do something' });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.response, 'Mock run completed for task task-1');
  });

  it('run() returns failed when config.outcome is failed', async () => {
    const provider = new MockAgentProvider({ delayMs: 0, outcome: 'failed' });
    const result = await provider.run({ agentRunId: 'run-2', taskId: 'task-2', prompt: 'do something' });
    assert.equal(result.status, 'failed');
  });

  it('run() uses custom response string', async () => {
    const provider = new MockAgentProvider({ delayMs: 0, response: 'Custom response' });
    const result = await provider.run({ agentRunId: 'run-3', taskId: 'task-3', prompt: 'do something' });
    assert.equal(result.response, 'Custom response');
  });

  it('stream() emits exactly 2 steps then returns result', async () => {
    const provider = new MockAgentProvider({ delayMs: 0 });
    const steps: AgentStepEvent[] = [];
    const result = await provider.stream(
      { agentRunId: 'run-4', taskId: 'task-4', prompt: 'do something' },
      (step) => steps.push(step),
    );
    assert.equal(steps.length, 2);
    assert.equal(steps[0].stepIndex, 0);
    assert.equal(steps[0].type, 'thought');
    assert.equal(steps[0].content, 'Analyzing task...');
    assert.equal(steps[1].stepIndex, 1);
    assert.equal(steps[1].type, 'message');
    assert.equal(result.status, 'succeeded');
  });
});
