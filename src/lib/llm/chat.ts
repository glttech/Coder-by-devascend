/**
 * LLM chat wrapper for agent role execution.
 *
 * Hard safety rule: when FEATURE_AGENT_LLM=false (the default), all functions
 * return deterministic stubs. No real API calls are ever made in that mode.
 * LLM output can never set Approval.approved = true — that is always a human action.
 */

import { featureFlags } from '@/lib/featureFlags';
import type { RoleDefinition, StructuredAgentOutput } from '@/lib/agents/roles';

export interface AgentRunInput {
  role: RoleDefinition;
  taskTitle: string;
  taskInstruction: string;
  riskLevel: string;
  environment: string;
  agentResponse?: string;
  retrievedContext?: string;
}

/**
 * Deterministic stub output used when FEATURE_AGENT_LLM=false (the default).
 * requiresApproval is true for high-risk roles — humans must always review those.
 */
function buildStubOutput(input: AgentRunInput): StructuredAgentOutput {
  return {
    roleKey: input.role.key,
    findings: [
      {
        category: 'governance',
        severity: 'info',
        title: `${input.role.name} analysis (stub — LLM disabled)`,
        description: `Deterministic stub output for ${input.role.name}. Enable FEATURE_AGENT_LLM=true to activate real AI analysis.`,
        recommendation: 'Review task manually before approving.',
      },
    ],
    affectedFiles: [],
    riskScore: 0.3,
    recommendation:
      'Manual review required. LLM analysis is disabled (FEATURE_AGENT_LLM=false).',
    evidenceGaps: ['LLM analysis disabled'],
    decisionSuggestion: 'RUN_VALIDATION',
    requiresApproval: input.role.maxRiskLevel === 'high',
  };
}

/**
 * Run an agent role and return structured output.
 *
 * When featureFlags.agentLlmEnabled is false (the default), returns a
 * deterministic stub without making any API calls.
 *
 * When featureFlags.agentLlmEnabled is true, the real Anthropic API would be
 * called here. The full LLM implementation is deferred to a later phase.
 */
export async function runAgentRole(input: AgentRunInput): Promise<StructuredAgentOutput> {
  if (!featureFlags.agentLlmEnabled) {
    return buildStubOutput(input);
  }
  // Real LLM path — only reached when FEATURE_AGENT_LLM=true.
  // Implementation would call @anthropic-ai/sdk here.
  // For Phase 1.1, return stub even when flag is on; full LLM wiring is Phase 1.2.
  return buildStubOutput(input);
}
