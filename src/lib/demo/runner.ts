/**
 * Demo runner — executes governance scenarios end-to-end using the stub orchestrator.
 * FEATURE_AGENT_LLM is false by default; all LLM calls return deterministic stubs.
 * writeTrace / writeAudit swallow DB errors, so this works without a live database.
 */

import { runOrchestrator } from '@/lib/agents/orchestrator';
import { DEMO_SCENARIOS, type DemoScenario } from './seed';

export interface RoleOutput {
  roleKey: string;
  decisionSuggestion: string;
  riskScore: number;
  requiresApproval: boolean;
  recommendation: string;
}

export interface DemoRunResult {
  scenario: DemoScenario;
  roleOutputs: RoleOutput[];
  finalDecision: string;
  seniorApprovalRequired: boolean;
  summary: string;
}

export async function runDemoScenario(scenarioIndex: number): Promise<DemoRunResult> {
  if (scenarioIndex < 0 || scenarioIndex >= DEMO_SCENARIOS.length) {
    throw new Error(
      `Scenario index ${scenarioIndex} out of range (0–${DEMO_SCENARIOS.length - 1})`,
    );
  }

  const scenario = DEMO_SCENARIOS[scenarioIndex];
  const { task, roles } = scenario;

  const roleOutputs: RoleOutput[] = [];
  let finalDecision = 'CONTINUE';
  let seniorApprovalRequired = false;

  // Decision precedence: BLOCKED > SENIOR_APPROVAL_REQUIRED > RUN_VALIDATION > CONTINUE
  const DECISION_RANK: Record<string, number> = {
    CONTINUE: 0,
    RUN_VALIDATION: 1,
    ASK_AGENT_FOR_EVIDENCE: 1,
    SENIOR_APPROVAL_REQUIRED: 2,
    BLOCKED: 3,
  };

  for (const roleKey of roles) {
    const result = await runOrchestrator({
      taskId: task.id,
      taskTitle: task.title,
      taskInstruction: task.instruction,
      riskLevel: task.riskLevel,
      environment: task.environment,
      roleKey,
    });

    const parsed = result.structuredOutput;
    roleOutputs.push({
      roleKey,
      decisionSuggestion: parsed.decisionSuggestion,
      riskScore: parsed.riskScore,
      requiresApproval: parsed.requiresApproval,
      recommendation: parsed.recommendation,
    });

    // Escalate to highest decision seen
    if ((DECISION_RANK[result.decisionCode] ?? 0) > (DECISION_RANK[finalDecision] ?? 0)) {
      finalDecision = result.decisionCode;
    }
    if (result.seniorApprovalRequired) {
      seniorApprovalRequired = true;
    }
  }

  const summary = buildSummary(scenario.task.title, roleOutputs, finalDecision, seniorApprovalRequired);

  return { scenario, roleOutputs, finalDecision, seniorApprovalRequired, summary };
}

function buildSummary(
  taskTitle: string,
  roleOutputs: RoleOutput[],
  finalDecision: string,
  seniorApprovalRequired: boolean,
): string {
  const roleCount = roleOutputs.length;
  const approvalNote = seniorApprovalRequired
    ? 'Senior approval is required before proceeding.'
    : 'No senior approval required — team may proceed per governance policy.';
  return `"${taskTitle}" was reviewed by ${roleCount} governance role${roleCount !== 1 ? 's' : ''}. Final decision: ${finalDecision}. ${approvalNote}`;
}
