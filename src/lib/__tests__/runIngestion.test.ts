import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ingestRunResult, computeEvaluations } from '../runIngestion.js';
import type { RunIngestionCallbacks } from '../runIngestion.js';

// ── In-memory stub that captures DB calls ────────────────────────────────────

interface StepRecord {
  agentRunId: string;
  stepIndex: number;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface EvalRecord {
  agentRunId: string;
  name: string;
  passed: boolean;
  score: number;
  reason: string;
}

function makeCallbacks(): {
  callbacks: RunIngestionCallbacks;
  steps: StepRecord[];
  evals: EvalRecord[];
} {
  const steps: StepRecord[] = [];
  const evals: EvalRecord[] = [];
  const callbacks: RunIngestionCallbacks = {
    async createSteps(data) {
      steps.push(...data);
    },
    async createEvaluations(data) {
      evals.push(...data);
    },
  };
  return { callbacks, steps, evals };
}

// ── computeEvaluations — pure function tests ─────────────────────────────────

describe('computeEvaluations — succeeded output with non-empty response', () => {
  const output = {
    status: 'succeeded' as const,
    response: 'This is a long enough response for the task completed successfully.',
  };
  const evals = computeEvaluations(output);

  it('returns exactly 3 evaluations', () => {
    assert.equal(evals.length, 3);
  });

  it('output_present passes with score 1.0', () => {
    const ev = evals.find((e) => e.name === 'output_present');
    assert.ok(ev, 'output_present evaluation must exist');
    assert.equal(ev.passed, true);
    assert.equal(ev.score, 1.0);
  });

  it('no_error passes with score 1.0', () => {
    const ev = evals.find((e) => e.name === 'no_error');
    assert.ok(ev, 'no_error evaluation must exist');
    assert.equal(ev.passed, true);
    assert.equal(ev.score, 1.0);
  });

  it('response_length passes for long response', () => {
    const ev = evals.find((e) => e.name === 'response_length');
    assert.ok(ev, 'response_length evaluation must exist');
    assert.equal(ev.passed, true);
    assert.ok(ev.score > 0, 'score should be positive');
  });
});

describe('computeEvaluations — failed output', () => {
  const output = {
    status: 'failed' as const,
    response: 'Something went wrong during execution of the task.',
  };
  const evals = computeEvaluations(output);

  it('no_error fails for failed status', () => {
    const ev = evals.find((e) => e.name === 'no_error');
    assert.ok(ev, 'no_error evaluation must exist');
    assert.equal(ev.passed, false);
    assert.equal(ev.score, 0);
  });

  it('output_present still passes if response is non-empty', () => {
    const ev = evals.find((e) => e.name === 'output_present');
    assert.ok(ev, 'output_present evaluation must exist');
    assert.equal(ev.passed, true);
  });
});

describe('computeEvaluations — empty response', () => {
  const output = { status: 'succeeded' as const, response: '' };
  const evals = computeEvaluations(output);

  it('output_present fails for empty response', () => {
    const ev = evals.find((e) => e.name === 'output_present');
    assert.ok(ev, 'output_present evaluation must exist');
    assert.equal(ev.passed, false);
    assert.equal(ev.score, 0);
  });

  it('response_length fails for empty response', () => {
    const ev = evals.find((e) => e.name === 'response_length');
    assert.ok(ev, 'response_length evaluation must exist');
    assert.equal(ev.passed, false);
    assert.equal(ev.score, 0);
  });
});

describe('computeEvaluations — undefined response', () => {
  const output = { status: 'succeeded' as const };
  const evals = computeEvaluations(output);

  it('output_present fails when response is undefined', () => {
    const ev = evals.find((e) => e.name === 'output_present');
    assert.ok(ev);
    assert.equal(ev.passed, false);
  });

  it('response_length fails when response is undefined', () => {
    const ev = evals.find((e) => e.name === 'response_length');
    assert.ok(ev);
    assert.equal(ev.passed, false);
  });
});

describe('computeEvaluations — response_length score calculation', () => {
  it('score is capped at 1.0 for response >= 100 chars', () => {
    const longResponse = 'x'.repeat(100);
    const evals = computeEvaluations({ status: 'succeeded' as const, response: longResponse });
    const ev = evals.find((e) => e.name === 'response_length');
    assert.ok(ev);
    assert.equal(ev.score, 1.0);
  });

  it('score is min(1, len/100) for short response', () => {
    const response = 'x'.repeat(50); // 50 chars → score 0.5
    const evals = computeEvaluations({ status: 'succeeded' as const, response });
    const ev = evals.find((e) => e.name === 'response_length');
    assert.ok(ev);
    assert.equal(ev.score, 0.5);
  });
});

// ── ingestRunResult — with injected in-memory callbacks stub ─────────────────

describe('ingestRunResult — succeeded output, no steps', () => {
  let evals: EvalRecord[] = [];

  before(async () => {
    const { callbacks, evals: captured } = makeCallbacks();
    await ingestRunResult(
      {
        agentRunId: 'run-001',
        output: {
          status: 'succeeded',
          response: 'Task completed successfully with all checks passing.',
        },
      },
      callbacks,
    );
    evals = captured;
  });

  it('creates 3 evaluation records', () => {
    assert.equal(evals.length, 3);
  });

  it('all 3 evaluations pass for a good succeeded run', () => {
    for (const ev of evals) {
      assert.equal(ev.passed, true, `evaluation '${ev.name}' should pass`);
    }
  });
});

describe('ingestRunResult — returns correct structure', () => {
  it('returns evaluations array with correct structure', async () => {
    const { callbacks } = makeCallbacks();
    const result = await ingestRunResult(
      {
        agentRunId: 'run-002',
        output: {
          status: 'succeeded',
          response: 'Another successful run with sufficient response length here.',
        },
      },
      callbacks,
    );
    assert.ok(Array.isArray(result.evaluations));
    assert.equal(result.evaluations.length, 3);
    for (const ev of result.evaluations) {
      assert.ok(typeof ev.name === 'string', 'name must be a string');
      assert.ok(typeof ev.passed === 'boolean', 'passed must be boolean');
      assert.ok(typeof ev.score === 'number', 'score must be a number');
      assert.ok(typeof ev.reason === 'string', 'reason must be a string');
    }
  });
});

describe('ingestRunResult — failed output', () => {
  it('no_error evaluation fails for failed run', async () => {
    const { callbacks, evals } = makeCallbacks();
    await ingestRunResult(
      {
        agentRunId: 'run-003',
        output: {
          status: 'failed',
          response: 'Run encountered an error during execution phase.',
        },
      },
      callbacks,
    );
    const noError = evals.find((e) => e.name === 'no_error');
    assert.ok(noError, 'no_error evaluation must be created');
    assert.equal(noError.passed, false);
    assert.equal(noError.score, 0);
  });
});

describe('ingestRunResult — empty response', () => {
  it('output_present evaluation fails for empty response', async () => {
    const { callbacks, evals } = makeCallbacks();
    await ingestRunResult(
      {
        agentRunId: 'run-004',
        output: { status: 'succeeded', response: '' },
      },
      callbacks,
    );
    const outputPresent = evals.find((e) => e.name === 'output_present');
    assert.ok(outputPresent, 'output_present evaluation must be created');
    assert.equal(outputPresent.passed, false);
    assert.equal(outputPresent.score, 0);
  });
});

describe('ingestRunResult — with steps', () => {
  let steps: StepRecord[] = [];
  let evals: EvalRecord[] = [];

  before(async () => {
    const { callbacks, steps: capturedSteps, evals: capturedEvals } = makeCallbacks();
    await ingestRunResult(
      {
        agentRunId: 'run-005',
        output: {
          status: 'succeeded',
          response: 'Task done with multiple steps captured during execution.',
        },
        steps: [
          { stepIndex: 0, type: 'thought', content: 'Analyzing task...' },
          { stepIndex: 1, type: 'tool_call', content: 'Running tests...', metadata: { tool: 'bash' } },
          { stepIndex: 2, type: 'message', content: 'Task completed.' },
        ],
      },
      callbacks,
    );
    steps = capturedSteps;
    evals = capturedEvals;
  });

  it('step count equals input steps length', () => {
    assert.equal(steps.length, 3, 'should persist exactly 3 steps');
  });

  it('step indices are preserved', () => {
    assert.equal(steps[0].stepIndex, 0);
    assert.equal(steps[1].stepIndex, 1);
    assert.equal(steps[2].stepIndex, 2);
  });

  it('step types are preserved', () => {
    assert.equal(steps[0].type, 'thought');
    assert.equal(steps[1].type, 'tool_call');
    assert.equal(steps[2].type, 'message');
  });

  it('step metadata is preserved', () => {
    assert.deepEqual(steps[1].metadata, { tool: 'bash' });
  });

  it('also creates 3 evaluations alongside steps', () => {
    assert.equal(evals.length, 3);
  });
});

describe('ingestRunResult — no steps provided', () => {
  it('does not create any step records when steps is omitted', async () => {
    const { callbacks, steps } = makeCallbacks();
    await ingestRunResult(
      {
        agentRunId: 'run-006',
        output: {
          status: 'succeeded',
          response: 'Task completed successfully with no streaming steps captured.',
        },
      },
      callbacks,
    );
    assert.equal(steps.length, 0, 'no steps should be persisted');
  });
});
