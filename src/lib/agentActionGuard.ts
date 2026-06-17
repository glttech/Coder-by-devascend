/**
 * Unauthorized Agent Action Guard (PR 2.5).
 *
 * Enforces the invariant that agents may only act on resources that belong to
 * the current session's task. Prevents an agent run from accidentally (or
 * maliciously) modifying GitHub PRs, tasks, or agent runs that were not
 * created as part of the current orchestration context.
 *
 * Hard safety rules:
 * - An agent NEVER writes to a GitHub PR it did not open in this run.
 * - An agent NEVER approves a task (only humans do that).
 * - An agent NEVER modifies AgentRun records for other tasks.
 * - Guard functions are pure — no side effects, no DB calls.
 *
 * All guard functions return { ok: true } or { ok: false, reason: string }.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardResult = { ok: true } | { ok: false; reason: string };

export interface AgentActionContext {
  /** The task ID this agent run belongs to. */
  taskId: string;
  /** The agent run ID for this execution. */
  agentRunId: string;
  /**
   * GitHub PR numbers opened by this agent run.
   * An empty array means the agent has not opened any PRs.
   */
  ownedPrNumbers: number[];
  /**
   * GitHub repo full name this agent run is authorised for (e.g. "org/repo").
   * Null means no GitHub repo access is authorised.
   */
  authorisedRepo: string | null;
}

// ---------------------------------------------------------------------------
// PR action guard
// ---------------------------------------------------------------------------

/**
 * Assert that the agent is allowed to act on a specific GitHub PR.
 *
 * An agent may only act on:
 * 1. A PR number that appears in context.ownedPrNumbers (i.e. it opened this PR).
 * 2. Within the authorised repository.
 *
 * Any other PR is off-limits.
 */
export function guardPrAction(
  context: AgentActionContext,
  targetRepo: string,
  targetPrNumber: number,
): GuardResult {
  if (!context.authorisedRepo) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] Agent run "${context.agentRunId}" is not authorised for any GitHub ` +
        `repository. Cannot act on PR #${targetPrNumber} in "${targetRepo}".`,
    };
  }

  if (context.authorisedRepo !== targetRepo) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] Agent run "${context.agentRunId}" is authorised for ` +
        `"${context.authorisedRepo}" but attempted to act on PR #${targetPrNumber} ` +
        `in a different repository "${targetRepo}".`,
    };
  }

  if (!context.ownedPrNumbers.includes(targetPrNumber)) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] Agent run "${context.agentRunId}" did not open PR #${targetPrNumber} ` +
        `in "${targetRepo}". Agents may only act on PRs they created in this session. ` +
        `Owned PRs: [${context.ownedPrNumbers.join(', ')}]`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Approval guard
// ---------------------------------------------------------------------------

/**
 * Assert that the agent is NOT attempting to approve a task.
 *
 * Approval is always a human action. This guard is the last line of defence
 * before any approval-shaped payload would reach the database.
 *
 * @param attemptedApproval - true if the agent's output includes an approve/reject decision
 */
export function guardNoApprovalByAgent(attemptedApproval: boolean): GuardResult {
  if (attemptedApproval) {
    return {
      ok: false,
      reason:
        '[AgentActionGuard] Agents are not permitted to set Approval.approved. ' +
        'Approval is a human-only action and must be performed via the Approval panel.',
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Task scope guard
// ---------------------------------------------------------------------------

/**
 * Assert that a resource (e.g. AgentRun, Instruction) belongs to the current task.
 */
export function guardTaskScope(
  context: AgentActionContext,
  resourceTaskId: string | null | undefined,
  resourceLabel: string,
): GuardResult {
  if (!resourceTaskId) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] ${resourceLabel} has no taskId — cannot verify scope for ` +
        `agent run "${context.agentRunId}".`,
    };
  }

  if (resourceTaskId !== context.taskId) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] Agent run "${context.agentRunId}" (task: "${context.taskId}") ` +
        `attempted to modify ${resourceLabel} belonging to a different task ` +
        `"${resourceTaskId}". Cross-task modifications are not permitted.`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Agent run scope guard
// ---------------------------------------------------------------------------

/**
 * Assert that an action targets the agent run itself (not a sibling run).
 */
export function guardAgentRunScope(
  context: AgentActionContext,
  targetAgentRunId: string,
): GuardResult {
  if (targetAgentRunId !== context.agentRunId) {
    return {
      ok: false,
      reason:
        `[AgentActionGuard] Agent run "${context.agentRunId}" attempted to modify a different ` +
        `agent run "${targetAgentRunId}". An agent run may only modify its own record.`,
    };
  }
  return { ok: true };
}
