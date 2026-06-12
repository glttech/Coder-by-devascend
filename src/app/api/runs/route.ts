import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { evaluateResponse } from '@/lib/promptEvaluator';
import { createTrace, logObservation } from '@/lib/langfuse';
import { writeAudit } from '@/lib/audit';

// POST /api/runs – record an agent run.  Expects JSON with taskId,
// generatedPrompt, selectedTool, and response.  Performs basic evaluation
// using built‑in heuristics and logs prompt/response to Langfuse.
export async function POST(request: Request) {
  const data = await request.json();
  const { taskId, generatedPrompt, selectedTool, response } = data;
  if (!taskId || !generatedPrompt || !selectedTool) {
    return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  try {
    // Create a new agent run record
    const now = new Date();
    const run = await prisma.agentRun.create({
      data: {
        taskId,
        generatedPrompt,
        selectedTool,
        response,
        status: response ? 'succeeded' : 'pending',
        endedAt: response ? now : undefined,
      },
    });
    await writeAudit({
      taskId: run.taskId,
      agentRunId: run.id,
      event: 'agent_run_created',
      details: JSON.stringify({ selectedTool, hasResponse: !!response, status: run.status, at: new Date().toISOString() }),
      userId: null,
    });
    // Create evaluation results if a response was supplied
    if (response) {
      const evaluations = evaluateResponse(generatedPrompt, response);
      await Promise.all(
        evaluations.map((ev) =>
          prisma.evaluation.create({
            data: {
              agentRunId: run.id,
              name: ev.name,
              passed: ev.passed,
              score: ev.passed ? 1 : 0,
              reason: ev.reason,
            },
          }),
        ),
      );
      // Send observations to Langfuse.  Create a trace tied to the task/run and
      // log the prompt and response.  The stubbed functions will simply log to
      // console in this MVP.
      const trace = await createTrace(taskId, run.id, { agentTool: selectedTool });
      await logObservation(trace, 'prompt', generatedPrompt, { agentRunId: run.id });
      await logObservation(trace, 'response', response, { agentRunId: run.id });
    }
    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    console.error(err);
    return new NextResponse(JSON.stringify({ error: 'Failed to record run' }), { status: 500 });
  }
}