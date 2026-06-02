# Current State Audit

**Date:** 2026-06-02  
**Main HEAD:** e37b507 (post-PR #29)  
**Test result:** 124/124 pass  
**Build result:** Clean

---

## Implemented Features

### Task Management
- Create tasks with: title, instruction, agent tool, risk level, environment, approval required flag
- 5 preset templates (Claude Code PR, OpenClaw Deploy, OpenClaw Readonly, Codex Review, Security Change)
- Task list view with pending instruction count
- Task detail page with all relations
- Task status tracking: pending / running / completed / failed
- Auto-project creation (single default project)

### Prompt Generation
- Structured 8-section prompt generated from task config
- Environment-specific guards (LOCAL / DEV / STAGING / PRODUCTION)
- Risk-level notes in prompt
- STOP conditions embedded in every prompt
- Validation commands section (npm build, test, lint)
- Required report format section
- Copy-to-clipboard button

### Agent Run Recording
- Paste-in agent response via RunPromptPanel
- 8-point heuristic evaluation on response:
  - 5 required section checks
  - destructive command detection
  - secret exposure detection
  - migration/upgrade detection
- EvaluationList renders pass/fail per check
- AgentRun stored with status, timestamps

### Operator Session Workflow
- Create/update operator sessions linked to a task
- Risk analysis with 7 flags (negation-stripping to reduce false positives)
- Evidence checker with 5 missing-evidence types
- Decision engine with 5 decision codes (CONTINUE / BLOCKED / SENIOR_APPROVAL_REQUIRED / RUN_VALIDATION / ASK_AGENT_FOR_EVIDENCE)
- Next-prompt generator produces follow-up instruction text
- Step counter increments on each update
- Decision banner displayed on task report

### Instruction Lifecycle
- Full state machine: draft → pending_approval → approved → executing → completed / blocked
- Required fields enforced per transition (blockedReason, approvedBy, etc.)
- SHA256 stateVersion for optimistic concurrency
- Stale-check endpoint: `GET /api/instructions/[id]/stale`
- Pending approvals queue page
- InstructionActions component with one-click transitions

### Approval Gate
- Approval model with null/true/false tri-state
- State guards via `approvalGuard.ts` pure function:
  - task must exist
  - approvalRequired must be true
  - task must not be in terminal state
  - no prior decision allowed
- Concurrent-safe write: P2002 unique constraint + conditional updateMany
- ApprovalPanel UI: approve / reject buttons
- AuditLog entry on every approval decision

### Security (as of e37b507)
- GOVERNANCE_API_KEY middleware guard on all `/api/*` routes
- Input length guards: title ≤500, body ≤50,000, agentResponse ≤50,000
- Approval race-condition fix (atomic write, no TOCTOU)
- No secrets in codebase (confirmed via diff review)

### Audit Log
- AuditLog created on: instruction created, instruction status changed, operator session created/updated, approval decided
- Audit log viewer with filters (taskId, instructionId, event type)
- Up to 200 entries visible
- JSON details field per entry

### Dashboard
- Total task count + breakdown by status
- Pending approvals count
- Failed evaluations count
- Governance health: pending instructions, blocked instructions, stale (7d+), sessions needing action
- Recent tasks table (6)
- Risky decisions (last 48h, non-CONTINUE)
- Recent agent runs table (5)

### Testing
- 124 tests, 35 suites
- Node.js built-in test runner with tsx
- Coverage: approvalGuard, decisionEngine, evidenceChecker, inputValidation, middleware, nextPromptGenerator, promptBuilder, promptEvaluator, riskAnalyzer, stateVersion

---

## Missing Features (Gap Analysis)

### GitHub Integration — Entirely Missing
- No GitHub connection of any kind
- No repo URL stored per project
- No PR reading, diff fetching, CI status polling
- No webhook receiver
- No commit SHA verification
- Agent evidence must be manually pasted — no auto-import from GitHub

### Project Registry — Skeletal
- `Project` model exists but has only `id`, `name`, `tasks`
- No: repo URL, branch, local path, container names, test command, build command, deploy command, autonomy level, owner, risk profile, environment
- Auto-creates single default project — cannot manage multiple projects meaningfully
- No project detail page or project management UI

### DEV Server / Container Validation — Missing
- No DEV server URL per project
- No health endpoint polling
- No container status check
- No deploy command execution
- No deployment log capture

### Real Agent Execution — Missing (all stubs)
- `openSweAdapter.ts` is a stub returning "run manually"
- `langfuse.ts` is a stub logging to console
- No Claude Code API integration
- No Codex API integration
- No real Open SWE API calls
- No automated prompt dispatch

### Authentication / Authorization — Missing
- No user login (session, JWT, OAuth)
- GOVERNANCE_API_KEY is API-level only; browser UI is unauthenticated
- No user-based approval tracking (`approverId` field exists but is never set)
- Anyone with network access to the app can use all UI features

### Rate Limiting — Missing
- No rate limiting on any endpoint
- Operator session POST/PATCH could be spammed (unbounded LLM invocation surface in Phase 2+)

### Notifications — Missing
- No email, Slack, or webhook notifications
- Rahul must actively check the dashboard for pending items

### Multi-Project Management — Missing
- No project creation UI
- No per-project settings
- No project-level API key scoping
- Dashboard shows all tasks across all projects without grouping

### Task Execution — Manual Only
- No automatic agent invocation
- Rahul must copy prompts and paste responses manually
- No task queue or execution scheduler

---

## Security Posture

### Strengths
- GOVERNANCE_API_KEY guard on all API routes (disabled when env var unset)
- Input length guards prevent oversized payloads
- Atomic approval gate prevents concurrent approval bypass
- State machine enforces valid instruction transitions
- No secrets in codebase
- Risk analyzer flags destructive commands, secret exposure, production access
- Decision engine blocks on critical risk flags
- All state changes produce AuditLog entries

### Weaknesses / Open Findings

| ID | Severity | Finding |
|----|----------|---------|
| H1 | High | Browser UI has no authentication — all pages accessible to anyone with network access |
| M2 | Medium | No rate limiting on any endpoint — operator sessions especially |
| M3 | Medium | `open-swe` agent tool accepted but has no live integration — misleading |
| L4 | Low | `approverId` on Approval is self-reported (never set from a real session identity) |
| L5 | Low | AuditLog `userId` is never populated (no session to extract it from) |
| L6 | Low | `PromptTemplate` model exists but is unused in any UI or API |

---

## Database Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| User | Identity (unused in Phase 1) | email, name |
| Project | Project grouping | name |
| Task | Core work unit | title, instruction, agentTool, riskLevel, environment, approvalRequired, status |
| AgentRun | Agent execution record | generatedPrompt, selectedTool, response, filesChanged, commandsRun, testResult, commitHash, status |
| Evaluation | Per-check pass/fail on AgentRun | name, passed, score, reason |
| Approval | Task approval decision | approved (null/true/false), approverId |
| Instruction | Fine-grained change instruction | title, body, status (6-state lifecycle), approvedBy, stateVersion |
| OperatorSession | Risk analysis session | riskFlags, missingEvidence, recommendedAction, nextPrompt, seniorApprovalRequired |
| AuditLog | Immutable event log | event, details, taskId, instructionId, userId |

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/tasks | Create task |
| GET | /api/tasks | List tasks |
| POST | /api/runs | Record agent run + evaluate |
| POST | /api/approvals | Record approval decision |
| POST | /api/instructions | Create instruction |
| GET | /api/instructions/[id] | Get instruction detail |
| PATCH | /api/instructions/[id] | Status transition |
| GET | /api/instructions/[id]/stale | Check stale state |
| POST | /api/operator-sessions | Create session + risk analysis |
| PATCH | /api/operator-sessions/[id] | Update session |
| GET | /api/operator-sessions?taskId= | List sessions for task |

---

## UI Screens

| Route | Screen |
|-------|--------|
| / | Dashboard (stats, health, recent tasks/runs) |
| /tasks | Task list table |
| /tasks/new | Task creation form with presets |
| /tasks/[id] | Task detail (approval, prompt, runs, instructions) |
| /tasks/[id]/report | Evidence report (full audit trail per task) |
| /audit | Audit log viewer with filters |
| /instructions/pending | Pending approval queue |

---

## Current Manual Steps

Every single one of these steps is currently manual:

1. Copy generated prompt from UI
2. Paste prompt into Claude Code / OpenClaw / Codex
3. Run agent manually in separate terminal / IDE
4. Copy agent output
5. Paste agent output into RunPromptPanel
6. Read risk flags on operator session
7. Decide to continue or block
8. Click approve / reject on task
9. Transition instruction states one by one via UI
10. Check GitHub to see if PR was created (no connection)
11. Check CI status manually (no connection)
12. Deploy to DEV manually (no connection)

---

## Automation Gaps

| Gap | Phase to Close |
|-----|---------------|
| Auto-import GitHub PR evidence | Phase 2 |
| Auto-populate AgentRun from CI results | Phase 2 |
| GitHub webhook receiver | Phase 2 |
| DEV health check after approval | Phase 3 |
| Container/deploy validation | Phase 3 |
| Auto-dispatch agent prompt | Phase 4 |
| Exception-only review queue | Phase 4 |
| Real Langfuse trace logging | Phase 2 |
| Real Open SWE API call | Phase 2 |

---

## Current Risks

| Risk | Impact | Likelihood | Notes |
|------|--------|-----------|-------|
| Browser has no auth | High | Certain | Anyone on network can use app |
| No rate limiting | Medium | Medium | Low risk now; high risk in Phase 4 |
| approverId never set | Low | Certain | Audit trail missing approver identity |
| Single default project | Medium | Certain | Can't manage multiple projects meaningfully |
| All agent interaction manual | High | Certain | Core Phase 2 blocker |
| Langfuse stubbed | Low | Certain | No observability on agent calls |
| Open SWE stubbed | Medium | Certain | Agent tool listed but non-functional |
