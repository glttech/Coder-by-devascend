/**
 * Agent Orchestrator — sequences role execution through the existing governance pipeline.
 *
 * Hard safety rule: the orchestrator NEVER sets Approval.approved = true.
 * It only produces a decision recommendation. Actual approval always requires
 * a human action via the existing /api/approvals route.
 */

import { computeDecision } from '@/lib/decisionEngine';
import { analyzeRisk } from '@/lib/riskAnalyzer';
import { checkMissingEvidence } from '@/lib/evidenceChecker';
import { writeAudit } from '@/lib/audit';
import { assertRoleCanActOn, getRole } from '@/lib/agents/roles';
import type { StructuredAgentOutput } from '@/lib/agents/roles';
import { runAgentRole } from '@/lib/llm/chat';

export interface OrchestratorInput {
  taskId: string;
  taskTitle: string;
  taskInstruction: string;
  riskLevel: string;
  environment: string;
  roleKey: string;
  agentResponse?: string;
  userId?: string;
}

export interface OrchestratorResult {
  roleKey: string;
  structuredOutput: StructuredAgentOutput;
  decisionCode: string;
  seniorApprovalRequired: boolean;
  reason: string;
  riskScore: number;
}

/**
 * Run a named agent role on a task and route its output through the existing
 * computeDecision engine. Returns a combined result with decision recommendation.
 *
 * Steps:
 * 1. Look up and validate the role
 * 2. Assert the role is authorized for the task's risk level
 * 3. Run the role via runAgentRole (stub or LLM)
 * 4. Analyze risk flags from combined text
 * 5. Check for missing evidence
 * 6. Feed both into computeDecision for the governance decision
 * 7. Write an audit log
 * 8. Return the combined OrchestratorResult
 */
export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  // 1. Look up the role
  const role = getRole(input.roleKey);
  if (!role) {
    throw new Error(`Unknown agent role: "${input.roleKey}"`);
  }

  // 2. Verify the role can act on this risk level
  assertRoleCanActOn(role, input.riskLevel);

  // 3. Run the agent role to get structured output
  const structuredOutput = await runAgentRole({
    role,
    taskTitle: input.taskTitle,
    taskInstruction: input.taskInstruction,
    riskLevel: input.riskLevel,
    environment: input.environment,
    agentResponse: input.agentResponse,
  });

  // 4. Analyze risk flags from the combined instruction + agent response text
  const analysisText =
    input.taskInstruction + ' ' + (input.agentResponse ?? '');
  const riskFlags = analyzeRisk(analysisText);

  // 5. Check for missing evidence
  const missingEvidence = checkMissingEvidence({
    agentResponse: input.agentResponse ?? null,
    filesMentioned: structuredOutput.affectedFiles,
    commandsMentioned: [],
    validationOutput: null,
    reviewerNotes: null,
  });

  // 6. Feed into computeDecision for the final governance decision
  const decision = computeDecision({
    riskFlags,
    missingEvidence,
    filesMentioned: structuredOutput.affectedFiles,
    commandsMentioned: [],
    environment: input.environment,
  });

  // 7. Write audit log
  await writeAudit({
    event: 'agent_role_run',
    taskId: input.taskId,
    userId: input.userId,
    details: JSON.stringify({
      roleKey: input.roleKey,
      decisionCode: decision.code,
      riskScore: structuredOutput.riskScore,
    }),
  });

  // 8. Return combined result
  return {
    roleKey: input.roleKey,
    structuredOutput,
    decisionCode: decision.code,
    seniorApprovalRequired: decision.seniorApprovalRequired,
    reason: decision.reason,
    riskScore: structuredOutput.riskScore,
  };
}
