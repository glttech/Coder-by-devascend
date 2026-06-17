/**
 * LLM chat wrapper for agent role execution.
 *
 * Hard safety rules:
 * - When FEATURE_AGENT_LLM=false (the default), all functions return deterministic stubs.
 *   No real API calls are ever made in that mode.
 * - When FEATURE_AGENT_LLM=true, ANTHROPIC_API_KEY must be set or an error is thrown
 *   (fail-closed — never silent fallback).
 * - LLM output can NEVER set Approval.approved = true — that is always a human action.
 *   The requiresApproval field in StructuredAgentOutput only records the recommendation;
 *   approval itself is a separate DB column written only via /api/approvals.
 */

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

// ---------------------------------------------------------------------------
// Stub output (used when FEATURE_AGENT_LLM=false)
// ---------------------------------------------------------------------------

/**
 * Deterministic stub output used when FEATURE_AGENT_LLM=false (the default).
 * requiresApproval is true for high-risk roles — humans must always review those.
 */
export function buildStubOutput(input: AgentRunInput): StructuredAgentOutput {
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

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildUserMessage(input: AgentRunInput): string {
  const parts: string[] = [
    `Task Analysis Request:`,
    ``,
    `Title: ${input.taskTitle}`,
    `Instruction: ${input.taskInstruction}`,
    `Risk Level: ${input.riskLevel}`,
    `Environment: ${input.environment}`,
  ];

  if (input.agentResponse) {
    parts.push(``, `AI Response Under Review:`, input.agentResponse);
  }
  if (input.retrievedContext) {
    parts.push(``, `Retrieved Context:`, input.retrievedContext);
  }

  parts.push(
    ``,
    `Analyze this task according to your governance role and respond ONLY with valid JSON matching this exact schema:`,
    ``,
    `{`,
    `  "roleKey": "${input.role.key}",`,
    `  "findings": [`,
    `    {`,
    `      "category": "string",`,
    `      "severity": "info | low | medium | high | critical",`,
    `      "title": "string",`,
    `      "description": "string",`,
    `      "recommendation": "string"`,
    `    }`,
    `  ],`,
    `  "affectedFiles": ["string"],`,
    `  "riskScore": 0.0,`,
    `  "recommendation": "string",`,
    `  "evidenceGaps": ["string"],`,
    `  "decisionSuggestion": "CONTINUE | RUN_VALIDATION | SENIOR_APPROVAL_REQUIRED | BLOCKED",`,
    `  "requiresApproval": false`,
    `}`,
    ``,
    `Rules:`,
    `- riskScore must be 0.0 to 1.0 (float)`,
    `- decisionSuggestion must be exactly one of the four values above — never "APPROVED"`,
    `- requiresApproval is your recommendation only — it does NOT automatically approve or block`,
    `- Output valid JSON only — no markdown fences, no explanation text`,
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing + validation
// ---------------------------------------------------------------------------

const VALID_DECISIONS = new Set([
  'CONTINUE',
  'RUN_VALIDATION',
  'SENIOR_APPROVAL_REQUIRED',
  'BLOCKED',
]);

const VALID_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

/**
 * Parse the raw LLM text into a StructuredAgentOutput.
 * Strips markdown fences, validates required fields, and clamps riskScore.
 */
export function parseStructuredOutput(raw: string, roleKey: string): StructuredAgentOutput {
  // Strip markdown code fences if present
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`[LLM] Failed to parse JSON response from model. Raw: ${text.slice(0, 200)}`);
  }

  // Validate decision suggestion — must be one of the four allowed values, never "APPROVED"
  const decision = typeof parsed.decisionSuggestion === 'string' ? parsed.decisionSuggestion : '';
  if (!VALID_DECISIONS.has(decision)) {
    throw new Error(
      `[LLM] Invalid decisionSuggestion "${decision}". Must be one of: ${[...VALID_DECISIONS].join(', ')}`,
    );
  }

  // Clamp riskScore to [0, 1]
  let riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 0.3;
  riskScore = Math.max(0, Math.min(1, riskScore));

  // Validate and normalise findings
  const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings = rawFindings
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => ({
      category: typeof f.category === 'string' ? f.category : 'general',
      severity: (VALID_SEVERITIES.has(String(f.severity)) ? f.severity : 'info') as
        | 'info'
        | 'low'
        | 'medium'
        | 'high'
        | 'critical',
      title: typeof f.title === 'string' ? f.title : 'Finding',
      description: typeof f.description === 'string' ? f.description : '',
      recommendation: typeof f.recommendation === 'string' ? f.recommendation : '',
    }));

  const affectedFiles = Array.isArray(parsed.affectedFiles)
    ? parsed.affectedFiles.filter((f): f is string => typeof f === 'string')
    : [];

  const evidenceGaps = Array.isArray(parsed.evidenceGaps)
    ? parsed.evidenceGaps.filter((g): g is string => typeof g === 'string')
    : [];

  return {
    roleKey: typeof parsed.roleKey === 'string' ? parsed.roleKey : roleKey,
    findings,
    affectedFiles,
    riskScore,
    recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
    evidenceGaps,
    decisionSuggestion: decision as StructuredAgentOutput['decisionSuggestion'],
    requiresApproval: parsed.requiresApproval === true,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run an agent role and return structured output.
 *
 * When featureFlags.agentLlmEnabled is false (the default), returns a
 * deterministic stub without making any API calls.
 *
 * When featureFlags.agentLlmEnabled is true, calls the Anthropic API using
 * the role's preferred model. If ANTHROPIC_API_KEY is missing the function
 * throws immediately (fail-closed — never silently falls back to stub).
 */
export async function runAgentRole(input: AgentRunInput): Promise<StructuredAgentOutput> {
  // Read env at call time so tests can control the flag without module cache issues
  if (process.env.FEATURE_AGENT_LLM !== 'true') {
    return buildStubOutput(input);
  }

  // Fail-closed: API key must be present when LLM is enabled
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[LLM] ANTHROPIC_API_KEY is not set. ' +
        'Real LLM calls require this environment variable when FEATURE_AGENT_LLM=true.',
    );
  }

  // Lazy-import to avoid loading the SDK in stub mode
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const model = input.role.modelPref || 'claude-haiku-4-5';

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    system: input.role.systemPrompt,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[LLM] No text content in LLM response');
  }

  return parseStructuredOutput(textBlock.text, input.role.key);
}
