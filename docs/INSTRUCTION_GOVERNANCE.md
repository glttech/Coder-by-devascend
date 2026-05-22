# INSTRUCTION_GOVERNANCE.md

## Phase 2 Specification — Instruction Lifecycle and Control-Plane Governance

**Status:** Specification only. No code implements this yet.
**Target:** Coder-by-devascend Phase 2

---

## 1. Purpose

This document specifies the instruction governance model for Phase 2 of the AI Dev Orchestrator. It defines how tasks are promoted into agent-executable instructions, how human approval gates work, and how execution results are captured with enough evidence to be trusted.

The goal is to make every AI-driven code change traceable, auditable, and reversible — connecting human intent to agent output through a documented chain of custody.

---

## 2. Why Instruction Governance Is Needed

Phase 1 captures tasks and agent runs but has no formal lifecycle binding them. A task can be submitted, a prompt can be generated, and an agent can produce output — but there is no enforced gate between "a task exists" and "an agent is allowed to act on it". There is no record of who approved what, under what constraints, or what the agent was told it must not touch.

This creates several gaps in production readiness:

- **No approval audit trail.** `approvalRequired: true` on a Task is a flag, not a log. There is no record of who approved, when, or what constraints applied at the time of approval.
- **No scope enforcement.** An agent can reference or modify any file. There is no machine-readable boundary definition per instruction.
- **No evidence binding.** Agent run results exist in the DB but are not linked to a specific git commit, PR, or CI run. There is no way to verify what the agent actually changed.
- **No stale execution prevention.** If project state changes after a task is created, an agent could act on a prompt built from outdated context.
- **No blocker escalation path.** When an agent reports it cannot proceed, there is no structured way to record, classify, or resolve the blocker.

Instruction governance adds a formal lifecycle layer that enforces these constraints before code runs and after it completes.

---

## 3. Roles

### Human Requester
Creates tasks via the dashboard or API. Defines the intent, risk level, target environment, and whether approval is required. Does not trigger execution directly.

### Orchestrator / Control Plane
The Coder-by-devascend application itself. Receives task submissions, builds prompts, evaluates results, computes health/trust signals, and manages the instruction lifecycle. Does not execute code directly.

### Coding Agent
An external AI agent (e.g. Claude Code, Open SWE-agent) that receives an instruction prompt and produces code changes. The agent reads files, edits code, and runs validation commands. It must respect the `doNotTouch` and `guardrails` fields. It must report a structured result to the orchestrator when complete or blocked.

### DevOps / Server Agent
An external agent responsible for infrastructure operations — deployments, migrations, environment config. Operates under stricter constraints than a coding agent. Must never act without an `approved` instruction with `targetEnvironment` explicitly set.

### Human Approver
Reviews a pending instruction before execution is allowed. Records approval in the control plane with a decision ID, timestamp, and their identity. Approval is immutable once recorded.

### CI / Validation Layer
Runs automated checks (build, lint, tests, type-check) after the agent reports completion. Reports pass/fail status back to the instruction result. An instruction cannot be marked `completed` while CI is `failed`.

---

## 4. Lifecycle

```
draft → pending_approval → approved → executing → completed
                                                 ↘ blocked
                       ↘ rejected                ↘ failed
                       ↘ cancelled (any state before executing)
```

| Status | Description |
|---|---|
| `draft` | Instruction created but not submitted for approval. May be edited freely. |
| `pending_approval` | Submitted. Human approver must review before execution can begin. Agent cannot act. |
| `approved` | Approver has recorded a decision. Agent may begin executing. Instruction is now immutable. |
| `executing` | Agent has received the instruction and has started work. No further edits allowed. |
| `completed` | Agent reported success and CI validation passed. Evidence pack is attached. |
| `blocked` | Agent reported it cannot proceed. A blocker record is created. Human resolution required. |
| `failed` | Agent reported an unrecoverable error. Evidence pack includes failure summary. |
| `rejected` | Human approver explicitly rejected the instruction before execution. |
| `cancelled` | Human cancelled a draft or pending_approval instruction before it reached executing. |

**Transition rules:**
- Only the orchestrator may advance status.
- `approved → executing` requires the state version to match the version computed at approval time. If project state has changed, the instruction must be re-approved.
- `executing → completed` requires CI status to be `passed` or `skipped` (for non-code instructions).
- `blocked` and `failed` are terminal states. A new instruction must be created to retry; the blocked/failed instruction is not reused.
- `cancelled` is only valid before `executing`.

---

## 5. Proposed Instruction Fields

```typescript
interface Instruction {
  // Identity
  instructionId: string;          // e.g. INSTR-2026-05-22-001 (date-scoped sequential ID)
  taskId: string;                 // FK → Task.id
  projectId: string;              // FK → Project.id (Phase 2 adds Project model)

  // Provenance
  createdAt: Date;
  createdBy: string;              // username or 'system'
  targetAgent: AgentTool;         // 'claude-code-manual' | 'open-swe' | 'codex-manual' | 'openclaw-manual'
  targetEnvironment: string;      // 'local' | 'dev' | 'staging' | 'production'
  riskLevel: RiskLevel;           // 'low' | 'medium' | 'high'

  // Scope constraints (machine-readable, sent to agent)
  scope: string;                  // Human-readable description of what the agent should touch
  contextFiles: string[];         // Files the agent should read to understand context
  doNotTouch: string[];           // Paths, patterns, or systems the agent must not modify
  guardrails: string[];           // Hard rules: e.g. 'do not run migrations in production'
  stopAndReportIf: string[];      // Conditions that require the agent to halt and report

  // Expected outcome (machine-readable, used for validation)
  expectedOutput: string;         // Human-readable description of what done looks like
  validationCommands: string[];   // Commands to run to verify completion, e.g. ['npm run build', 'npm test']

  // Approval
  approvalRequired: boolean;
  approvalRef: string | null;     // FK → Decision.id, set when approved or rejected
  approvedBy: string | null;
  approvedAt: Date | null;

  // State integrity
  stateVersion: string;           // SHA256 hash of task+project context at instruction creation time
  status: InstructionStatus;

  // Timestamps
  updatedAt: Date;
  submittedAt: Date | null;       // When moved to pending_approval
  executingAt: Date | null;       // When agent began work
  resolvedAt: Date | null;        // When moved to any terminal state
}
```

---

## 6. Proposed Result / Outbox Fields

```typescript
interface InstructionResult {
  // Identity
  resultId: string;               // e.g. RES-2026-05-22-001
  instructionId: string;          // FK → Instruction.instructionId

  // Timing
  completedAt: Date;
  durationMs: number | null;      // Elapsed time from executingAt to completedAt

  // Outcome
  executionStatus: 'complete' | 'blocked' | 'failed';
  summary: string;                // One-paragraph human-readable summary from the agent

  // Evidence
  filesChanged: string[];         // Relative paths of all modified files
  commandsRun: string[];          // Commands the agent ran (build, test, migrate, etc.)
  validations: ValidationResult[];// Results of each validationCommand
  blockers: BlockerRecord[];      // Structured blockers if executionStatus is 'blocked'
  risksDetected: string[];        // Any risks the agent flagged during execution

  // GitHub binding (Phase 2 — may be null until integrated)
  commitHash: string | null;
  pullRequestUrl: string | null;
  ciStatus: 'passed' | 'failed' | 'pending' | 'skipped' | null;

  // Evidence pack (Phase 2)
  evidencePackUrl: string | null; // URL to a generated JSON/ZIP artifact with full execution trace
}

interface ValidationResult {
  command: string;
  status: 'passed' | 'failed' | 'skipped';
  output: string | null;
}

interface BlockerRecord {
  blockerId: string;              // e.g. BLK-2026-05-22-001
  severity: 'auto-fix' | 'retry' | 'hard-block';
  description: string;
  affectedFiles: string[];
  suggestedResolution: string | null;
}
```

---

## 7. State Version Hash Concept

When an instruction is created, the orchestrator computes a `stateVersion` hash from the current state of the task and project context:

```
stateVersion = SHA256(
  task.title + task.instruction + task.riskLevel + task.environment +
  project.currentSprint + project.currentModule +
  project.nextActions[0] + project.nextActions[1] + project.nextActions[2] +
  blockers.activeBlockId
)
```

The hash is stored on the Instruction record at creation time.

**Why this matters:**

When the agent is about to begin executing, the orchestrator recomputes the hash from the current live state. If the hash does not match the stored `stateVersion`, it means something changed since the instruction was approved — a new task was added, the project's next action changed, a blocker appeared, or the sprint advanced. The instruction is then flagged as **stale** and execution is blocked until a human re-approves with the updated context.

This prevents the common failure mode where an agent executes a prompt that was approved yesterday against a project state that has since changed, producing work that conflicts with current intent.

---

## 8. Staleness Detection

An instruction becomes stale when any of the following are true:

| Signal | Threshold | Action |
|---|---|---|
| `task.updatedAt > instruction.createdAt` | Any | Flag instruction as stale; require re-approval |
| `stateVersion` at execution time ≠ `stateVersion` at creation time | Any | Block execution; notify human |
| `instruction.status = 'approved'` for longer than 48h without executing | 48h | Surface WARNING in dashboard |
| `instruction.status = 'executing'` with no result for longer than 4h | 4h | Surface AT_RISK; alert human |
| Agent reports `filesChanged` that include paths in `doNotTouch` | Any | Immediately flag result as `failed`; surface CRITICAL |

Staleness is a **derived read-only signal** computed from timestamps and hashes. It never modifies historical records. A stale instruction must be re-submitted, not edited in place.

---

## 9. Health / Trust Signals

The Phase 2 dashboard should surface the following signals per instruction and per project. These are read-only computed indicators, not mutable state.

| Signal | Severity | Condition |
|---|---|---|
| Approved instruction waiting too long | WARNING | `status = 'approved'` and `approvedAt` was > 24h ago without `executingAt` |
| Execution result without approval | CRITICAL | `InstructionResult` exists but linked instruction never reached `approved` |
| Missing expected output | WARNING | `instruction.expectedOutput` is empty or whitespace |
| Validation missing | WARNING | `instruction.validationCommands` is empty for a non-trivial instruction |
| CI failed | AT_RISK | `result.ciStatus = 'failed'` |
| Agent changed files outside scope | CRITICAL | Any path in `result.filesChanged` matches a pattern in `instruction.doNotTouch` |
| High-risk task without approval | CRITICAL | `instruction.riskLevel = 'high'` and `instruction.approvalRequired = false` |
| Stale instruction | WARNING | `stateVersion` mismatch detected at execution boundary |
| Blocked result unresolved | AT_RISK | `result.executionStatus = 'blocked'` and `blockers[].severity = 'hard-block'` with no resolution after 24h |

These signals feed a per-project **trust status**: `TRUSTED | NEEDS_REVIEW | STALE_OR_INCONSISTENT | AT_RISK`.

Trust status is derived from the worst open signal across all active instructions for the project. It is not stored — it is computed on read.

---

## 10. Relationship to Current Phase 1

### What exists today

| Capability | Phase 1 implementation |
|---|---|
| Task intake | `POST /api/tasks` — creates a Task row with title, instruction, riskLevel, environment, agentTool, approvalRequired |
| Prompt builder | `src/lib/promptBuilder.ts` — assembles a structured prompt from Task fields and project context |
| Agent run capture | `POST /api/runs` — creates AgentRun with generatedPrompt, response, selectedTool, status, endedAt |
| Heuristic evaluation | `src/lib/promptEvaluator.ts` — 8 pass/fail checks: length, instruction_present, scope-drift, guardrail compliance, etc. |
| Approval status | `Task.approvalRequired` boolean + `Task.status` string field — flag only, no decision log |
| Audit-oriented DB | `AuditLog` table records create/update events on Task and AgentRun with actor, action, before/after metadata |

### What is not implemented yet

| Capability | Notes |
|---|---|
| DB-backed instruction lifecycle | The `Instruction` model does not exist. Tasks and AgentRuns have no formal `draft → completed` progression. |
| Automatic agent execution | All agent runs are manual. There is no mechanism to dispatch a prompt to an agent programmatically. |
| Real GitHub PR binding | `AgentRun` has no `commitHash` or `pullRequestUrl`. PRs are created manually. |
| Real Open SWE automation | The `open-swe` agent tool is a valid enum value but has no integration. Prompts are copied manually. |
| Real Langfuse integration | `LANGFUSE_*` env vars are documented in `.env.example` but no tracing calls exist in the codebase. |
| Real Promptfoo integration | No Promptfoo configuration or test suite exists. Evaluation is heuristic only. |
| Immutable audit trail | `AuditLog` rows can be deleted via Prisma. There is no append-only enforcement or cryptographic sealing. |
| State version hash | No hash is computed or stored. Instructions can be acted on regardless of whether context has changed. |
| Scope enforcement | `doNotTouch` and `guardrails` are not machine-enforced. The heuristic evaluator checks for scope drift in response text but cannot verify what files an agent actually touched. |
| Evidence pack | No structured artifact is generated after execution. Results exist only as free-text `AgentRun.response`. |
| JSONL event log | Designed (see `PROJECT_DETAIL_AND_EVENT_MODEL.md` in the reference repo). Not implemented. |

---

## 11. Future Phase 2 Implementation Plan

These are proposed steps. None are committed to, scoped, or estimated here. This is a directional roadmap only.

### Step 1 — Add Instruction model
Add `Instruction` to `prisma/schema.prisma` with the fields defined in Section 5. Link to existing `Task` and `User` models. Write and run migration. Add `POST /api/instructions` and `GET /api/instructions/[id]` routes. Update task detail page to show linked instruction.

### Step 2 — Add instruction approval flow
Add `POST /api/instructions/[id]/approve` and `/reject` and `/modify` routes. Record each decision in an `InstructionDecision` table (or extend `AuditLog`). Make approval immutable once recorded. Surface pending approvals on the dashboard.

### Step 3 — Add Result / Evidence model
Add `InstructionResult` to the schema. Add `POST /api/instructions/[id]/result` endpoint for agents to submit structured results. Link AgentRun to InstructionResult. Display result on task detail page.

### Step 4 — Add state version hash
On instruction creation, compute SHA256 of task+project context. Store as `stateVersion`. On execution boundary, recompute and compare. Surface mismatch as a dashboard warning before allowing the agent to proceed.

### Step 5 — Add dashboard health signals
Implement the nine signals defined in Section 9 as computed properties in `src/lib/healthEngine.ts`. Surface them as color-coded badges on the task list and project detail pages. No new DB columns needed — all signals are derived from existing timestamps and status fields.

### Step 6 — Add GitHub PR / CI linkage
When an agent reports a result, accept an optional `pullRequestUrl` and `commitHash`. Store on `InstructionResult`. Add a polling or webhook mechanism to check CI status from the GitHub API. Update `result.ciStatus` when CI completes.

### Step 7 — Add evidence pack generation
On instruction completion, generate a structured JSON artifact containing: instruction fields, result fields, validation outputs, files changed, commit hash, CI status. Store as a file or DB blob referenced by `evidencePackUrl`. Make it downloadable from the dashboard.

---

## 12. Reference

This specification is informed by the governance patterns observed in the `app-dev-portfolio` prototype, specifically:

- The AGENT_INBOX / AGENT_OUTBOX / DECISIONS markdown control-file pattern
- The multi-signal health computation model (`computeSystemHealth`, `computeControlIntegrity`, `computeStaleState`)
- The atomic file write pattern (write to `.tmp`, then `fs.rename`)
- The `stateVersion` SHA256 fingerprint concept
- The structured prompt builder (`buildStartWorkPrompt`, `buildNextPrompt`)
- The blocker classification model (AUTO-FIX / RETRY / HARD BLOCK)

That prototype used the local filesystem as its state store, which made it machine-specific and non-portable. This specification replaces file-based state with Prisma-backed DB models while preserving the governance contract semantics.
