// Prompt quality evaluator.
//
// Scores a generated prompt against a set of heuristic checks before the run
// is dispatched. Each check contributes one point. The final score is the
// fraction of checks that passed (0.0 – 1.0). A prompt is considered
// "passed" when score >= 0.75.

export interface PromptEvalResult {
  passed: boolean;
  score: number; // 0.0 – 1.0
  reasons: string[];
}

export interface PromptEvalInput {
  prompt: string;
  taskTitle: string;
  riskLevel: string; // 'low' | 'medium' | 'high'
}

/**
 * Evaluate a generated prompt and return a quality score.
 *
 * Checks (each worth 1 point out of a total of 3 or 4):
 * 1. Prompt length >= 50 chars.
 * 2. Prompt length >= 200 chars for high-risk tasks (only counted when riskLevel === 'high').
 * 3. Prompt contains the task title (case-insensitive).
 * 4. Prompt does not contain placeholder text (TODO / FIXME / PLACEHOLDER).
 *
 * Note: check 2 is skipped (not counted in total_checks) when riskLevel is
 * not 'high', so the denominator varies between 3 and 4.
 */
export function evaluatePrompt(input: PromptEvalInput): PromptEvalResult {
  const { prompt, taskTitle, riskLevel } = input;
  const reasons: string[] = [];
  let passedChecks = 0;
  let totalChecks = 0;

  // Check 1: minimum length for any risk level.
  totalChecks += 1;
  if (prompt.length >= 50) {
    passedChecks += 1;
  } else {
    reasons.push('Prompt too short');
  }

  // Check 2: extended minimum length for high-risk prompts.
  if (riskLevel === 'high') {
    totalChecks += 1;
    if (prompt.length >= 200) {
      passedChecks += 1;
    } else {
      reasons.push('High-risk prompt must be >= 200 chars');
    }
  }

  // Check 3: prompt references the task title.
  totalChecks += 1;
  if (prompt.toLowerCase().includes(taskTitle.toLowerCase())) {
    passedChecks += 1;
  } else {
    reasons.push('Prompt should reference the task title');
  }

  // Check 4: no placeholder text.
  totalChecks += 1;
  const placeholderPattern = /\b(TODO|FIXME|PLACEHOLDER)\b/i;
  if (!placeholderPattern.test(prompt)) {
    passedChecks += 1;
  } else {
    reasons.push('Prompt contains placeholder text');
  }

  const score = totalChecks > 0 ? passedChecks / totalChecks : 0;

  return {
    passed: score >= 0.75,
    score,
    reasons,
  };
}
