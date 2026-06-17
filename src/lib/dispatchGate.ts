// Dispatch approval gate.
//
// Before an agent run is queued, this module decides whether the run should
// proceed immediately (queue), be held for human approval (await_approval), or
// be rejected outright (reject). This is a pure function so it can be tested
// without a database or feature-flag service.

export interface DispatchContext {
  approvalRequired: boolean;
  riskLevel: string; // "low" | "medium" | "high"
  orchestrationEnabled: boolean;
}

export type DispatchDecision =
  | { action: 'queue' }
  | { action: 'await_approval'; reason: string }
  | { action: 'reject'; reason: string };

/**
 * Resolve the dispatch decision for an agent run given context.
 *
 * Rules (in precedence order):
 * 1. If orchestrationEnabled is false → reject immediately.
 * 2. If approvalRequired is true OR riskLevel is 'high' → hold for approval.
 * 3. Otherwise → queue.
 */
export function resolveDispatch(ctx: DispatchContext): DispatchDecision {
  if (!ctx.orchestrationEnabled) {
    return { action: 'reject', reason: 'Orchestration feature is disabled' };
  }

  if (ctx.approvalRequired) {
    return {
      action: 'await_approval',
      reason: 'Task requires explicit approval before execution',
    };
  }

  if (ctx.riskLevel === 'high') {
    return {
      action: 'await_approval',
      reason: 'High-risk tasks require approval before execution',
    };
  }

  return { action: 'queue' };
}
