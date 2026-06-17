/**
 * Execution trace writer — immutable, append-only governance evidence.
 *
 * Hard safety rules:
 * - NEVER update or delete a trace record — append only
 * - MUST redact promptSent and finalOutput before persist
 * - Always paired with a writeAudit call
 */

import prisma from '@/lib/prisma';

export interface ExecutionTraceEntry {
  orgId?: string;
  taskId?: string;
  agentRunId?: string;
  roleKey?: string;
  promptSent?: string; // will be redacted before persist
  modelUsed?: string;
  toolCallsSummary?: string;
  evidenceRefs?: string[];
  riskScore?: number;
  riskFlags?: string[];
  decisionCode?: string;
  approvalState?: string;
  finalOutput?: string; // will be redacted before persist
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Redact sensitive values from text before persisting to the trace log.
 *
 * Patterns removed:
 * - API key / secret / password / token / bearer / authorization assignments
 * - Env-var-style assignments: FOO_KEY=value, BAR_SECRET=value, etc.
 * - Coder API key prefix: cda__<10+ alphanum chars>
 */
export function redactSensitive(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;

  let result = text;

  // Pattern 1: key=value style for api_key, secret_key, password, token, bearer, authorization
  result = result.replace(
    /(api[_-]?key|secret[_-]?key|password|token|bearer|authorization)[=: ]+[^\s]{4,}/gi,
    '[REDACTED]',
  );

  // Pattern 2: ENV_VAR style: FOO_KEY=value, BAR_SECRET=value, BAZ_TOKEN=value, BAZ_PASSWORD=value
  result = result.replace(/[A-Z_]+(KEY|SECRET|TOKEN|PASSWORD)=[^\s]+/g, '[REDACTED]');

  // Pattern 3: Coder API key prefix pattern
  result = result.replace(/cda__[a-z0-9_-]{10,}/g, '[REDACTED]');

  return result;
}

/**
 * Write an immutable execution trace entry.
 *
 * Fire-and-forget: swallows all errors so a trace failure never breaks the main flow.
 * NEVER call prisma.executionTrace.update or .delete — append-only by design.
 */
export async function writeTrace(entry: ExecutionTraceEntry): Promise<void> {
  try {
    await prisma.executionTrace.create({
      data: {
        orgId: entry.orgId ?? 'org_default',
        taskId: entry.taskId,
        agentRunId: entry.agentRunId,
        roleKey: entry.roleKey,
        promptSent: redactSensitive(entry.promptSent),
        modelUsed: entry.modelUsed,
        toolCallsSummary: entry.toolCallsSummary,
        evidenceRefs: entry.evidenceRefs ? JSON.stringify(entry.evidenceRefs) : undefined,
        riskScore: entry.riskScore,
        riskFlags: entry.riskFlags ? JSON.stringify(entry.riskFlags) : undefined,
        decisionCode: entry.decisionCode,
        approvalState: entry.approvalState,
        finalOutput: redactSensitive(entry.finalOutput),
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
      },
    });
  } catch {
    // Swallow all errors — trace must never break main flow
  }
}
