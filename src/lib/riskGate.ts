// Risk gate — blocks agent runs that lack required evidence before dispatch.
//
// This is a pure function so it can be tested without a database.

export interface RiskGateInput {
  riskLevel: string;       // 'low' | 'medium' | 'high'
  environment: string;     // 'local' | 'dev' | 'staging' | 'production'
  approvalRequired: boolean;
  hasApproval: boolean;    // true when an Approval record exists with approved === true
  promptScore: number;     // 0.0 – 1.0 from evaluatePrompt
}

export interface RiskGateResult {
  allowed: boolean;
  blockedReasons: string[];
}

/**
 * Decide whether a run should be allowed to proceed.
 *
 * Rules evaluated in order (multiple may apply):
 * 1. High-risk run without approval → block.
 * 2. Production non-low-risk run without approval → block.
 * 3. Prompt quality score below 0.5 → block.
 *
 * A run is allowed only when no rules fire.
 */
export function checkRiskGate(input: RiskGateInput): RiskGateResult {
  const { riskLevel, environment, hasApproval, promptScore } = input;
  const blockedReasons: string[] = [];

  // Rule 1: high-risk requires approval.
  if (riskLevel === 'high' && !hasApproval) {
    blockedReasons.push('High-risk run requires approval');
  }

  // Rule 2: non-low-risk production run requires approval.
  if (environment === 'production' && riskLevel !== 'low' && !hasApproval) {
    blockedReasons.push('Non-low-risk production run requires approval');
  }

  // Rule 3: prompt quality score too low.
  if (promptScore < 0.5) {
    blockedReasons.push('Prompt quality score too low');
  }

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
  };
}
