/**
 * GET  /api/demo — list demo scenarios (public, no auth)
 * POST /api/demo — run a demo scenario by index (public, no auth)
 *
 * Intentionally unauthenticated — this endpoint exists to drive the pilot demo
 * for prospective customers and small teams evaluating the platform.
 * It uses deterministic stubs (FEATURE_AGENT_LLM=false) and never writes approvals.
 */

import { NextResponse } from 'next/server';
import { DEMO_SCENARIOS } from '@/lib/demo/seed';
import { runDemoScenario } from '@/lib/demo/runner';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ scenarios: DEMO_SCENARIOS });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scenarioIndex } = body;
  if (typeof scenarioIndex !== 'number') {
    return NextResponse.json({ error: 'scenarioIndex must be a number' }, { status: 400 });
  }

  try {
    const result = await runDemoScenario(scenarioIndex);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Demo run failed';
    if (message.includes('out of range')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error running demo scenario' }, { status: 500 });
  }
}
