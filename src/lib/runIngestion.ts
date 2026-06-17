import prisma from './prisma';
import type { AgentRunOutput, AgentStepEvent } from './providers/index';

export interface IngestRunResultInput {
  agentRunId: string;
  output: AgentRunOutput;
  steps?: AgentStepEvent[];
}

export interface EvaluationResult {
  name: string;
  passed: boolean;
  score: number;
  reason: string;
}

export interface IngestRunResultOutput {
  evaluations: EvaluationResult[];
}

/** Callbacks used internally — makes unit testing possible without a real DB. */
export interface RunIngestionCallbacks {
  createSteps(
    steps: Array<{
      agentRunId: string;
      stepIndex: number;
      type: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void>;
  createEvaluations(
    evals: Array<{
      agentRunId: string;
      name: string;
      passed: boolean;
      score: number;
      reason: string;
    }>,
  ): Promise<void>;
}

/** Default callbacks backed by the real Prisma client. */
const defaultCallbacks: RunIngestionCallbacks = {
  async createSteps(steps) {
    if (steps.length === 0) return;
    type CreateManyData = NonNullable<Parameters<typeof prisma.agentStep.createMany>[0]>['data'];
    await prisma.agentStep.createMany({
      data: steps as CreateManyData,
    });
  },
  async createEvaluations(evals) {
    await prisma.evaluation.createMany({ data: evals });
  },
};

/** Pure function: compute evaluation results for a run output. */
export function computeEvaluations(output: AgentRunOutput): EvaluationResult[] {
  const response = output.response ?? '';

  return [
    // output_present: passed if response is non-empty
    {
      name: 'output_present',
      passed: response.length > 0,
      score: response.length > 0 ? 1.0 : 0,
      reason:
        response.length > 0
          ? 'Response is present'
          : 'Response is empty',
    },
    // no_error: passed if status is succeeded
    {
      name: 'no_error',
      passed: output.status === 'succeeded',
      score: output.status === 'succeeded' ? 1.0 : 0,
      reason:
        output.status === 'succeeded'
          ? 'Run succeeded without errors'
          : `Run ended with status '${output.status}'`,
    },
    // response_length: passed if response >= 20 chars; score = min(1, len/100)
    {
      name: 'response_length',
      passed: response.length >= 20,
      score: Math.min(1, response.length / 100),
      reason:
        response.length >= 20
          ? `Response length ${response.length} meets minimum threshold`
          : `Response length ${response.length} is below minimum of 20 characters`,
    },
  ];
}

export async function ingestRunResult(
  input: IngestRunResultInput,
  callbacks: RunIngestionCallbacks = defaultCallbacks,
): Promise<IngestRunResultOutput> {
  const { agentRunId, output, steps = [] } = input;

  // Persist each step as an AgentStep record
  await callbacks.createSteps(
    steps.map((step) => ({
      agentRunId,
      stepIndex: step.stepIndex,
      type: step.type,
      content: step.content,
      metadata: step.metadata,
    })),
  );

  const evaluations = computeEvaluations(output);

  // Create Evaluation records
  await callbacks.createEvaluations(
    evaluations.map((ev) => ({
      agentRunId,
      name: ev.name,
      passed: ev.passed,
      score: ev.score,
      reason: ev.reason,
    })),
  );

  return { evaluations };
}
