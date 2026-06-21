# Product Roadmap

---

## ⬡ Direction — Internal AI Work Control Room (Current Focus)

**Updated: 2026-06-20**

The primary build target is now the **Internal AI Work Control Room** — a UI for Rahul and an internal operator to track and manage Claude Code CLI work across Rahul's repos. This is not a SaaS product or multi-tenant platform; it is a single-operator internal tool.

**SOC module** is paused as a secondary module. PR #198 (SecurityAlert CRUD) is parked in draft. SOC M-3+ do not start until the Work Control Room is usable.

**Current workflow target:**
Task → repo → Claude Code CLI run → logs → branch/PR → CI → risk/evidence → operator action → Rahul review

**CLI execution** is out of scope until W-4/W-5 security gates are in place. All W-1 through W-3 work is read-only.

### W-Series: Work Control Room PRs

| PR | Scope | Status |
|---|---|---|
| W-1 | Read-only task visibility: `/coder/tasks` page + `GET /api/coder/tasks` | **✅ Complete (PR #199)** |
| W-2 | CliSession model + GET API (schema additive, no CLI execution) | **✅ Complete (PR #200)** |
| W-3 | Live log viewer UI (`/coder/sessions/[id]`) — SSE/polling, read-only | **✅ Complete (PR #202)** |
| W-4 | Repository registry + GitHub PR sync | **✅ Complete (PR #203)** |
| W-5 | Control Room Timeline (`/coder/control-room`) | **✅ Complete (PR #204)** |
| W-6 | Claude Session Intelligence (duration, PR link, summary, failure reason) | **✅ Complete (PR #205)** |
| W-7 | Executive Dashboard (active sessions, open tasks, risk summary) | **✅ Complete (PR #207)** |
| W-8 | Command policy gates (allowlist, workdir scoping, log scrubbing) | **✅ Complete (PR #208)** |

**W-8 detail:**
- `CommandPolicy` Prisma model: orgId, name, commandPrefixes[], allowedWorkdirs[], scrubLogs, enabled
- Migration `20260621000003_command_policy` (new table, no breaking changes)
- `isCommandAllowed(command, allowlist)` — prefix-based allowlist check with separator guard
- `isWorkdirAllowed(dir, bases)` — absolute path scoping with boundary attack prevention
- `scrubLogLine(line)` / `scrubLogLines(lines[])` — redacts 9 secret patterns (API keys, PATs, tokens, env vars)
- `validateCommandPolicyBody` / `validateCommandPolicyPatch` — validated CRUD bodies
- `GET/POST /api/coder/policies` + `GET/PATCH/DELETE /api/coder/policies/[id]`
- `/coder/policies` list page + `/coder/policies/new` form + `/coder/policies/[id]` edit page with delete
- "Cmd Policies" added to SidebarNav
- 43 new unit tests (1300 total); `tsc --noEmit` clean

**W-7 detail:**
- `/coder/dashboard` — Executive Dashboard server component
- Stat cards: Active Sessions, Open Tasks, Open PRs, Repos (with contextual sub-labels)
- Risk bar: open tasks segmented by risk level with colour-coded proportional bar
- Active sessions panel: live running sessions with command, summary, duration, repo/task links
- Open tasks table: status, risk badge, project, relative updated time, approval state
- Recent PRs table: PR title + link, state badge, CI status, repo, relative updated time
- `src/lib/coder/dashboardStats.ts` — pure stat-builder functions (testable, no Prisma)
- "Exec Dashboard" added to SidebarNav
- 25 new unit tests (1257 total); `tsc --noEmit` clean

**W-6 detail:**
- `summary String?`, `failureReason String?`, `filesChanged String[]` added to `CliSession` schema
- `cliSessionId String?` FK added to `RepositoryPR` (links PRs created by a session)
- Migration `20260621000002_cli_session_intelligence` (additive, all nullable/default)
- `PATCH /api/coder/sessions/[id]` — write intelligence fields (admin-gated)
- `GET /api/coder/sessions/[id]` enhanced — includes `repository`, `repositoryPRs` (with CI status, branch, PR URL)
- Session detail page intelligence panel: summary, failure reason, files changed (collapsible), linked PRs
- Session list: summary preview, file count column, repo link, exit code inline
- `validateSessionIntelligencePatch` — validated patch with length/count limits
- 27 new unit tests (1232 total)

**W-4 detail:**
- `Repository` + `RepositoryPR` Prisma models (migration `20260621000001_add_repository`)
- `repoId` FK added to `CliSession` (additive, nullable)
- `GET/POST /api/coder/repositories` — list + register
- `GET/PATCH /api/coder/repositories/[id]` — detail + update
- `POST /api/coder/repositories/[id]/sync` — GitHub PR sync (uses `GITHUB_TOKEN`, gracefully degrades)
- `/coder/repositories` list + `/coder/repositories/new` form + `/coder/repositories/[id]` detail with PR table
- SyncButton client component with live result feedback
- SidebarNav "Repositories" link
- Tasks empty-state CTA → "Add your first repository"
- 39 new unit tests (1180 total)

**W-1 detail (current PR):**
- `/coder/tasks` — server component, reads `module='coder'` tasks from DB
- `GET /api/coder/tasks` — cursor-paginated, filterable by status/project, auth-gated
- Sidebar "Work Control Room" nav link
- Read-only. No schema changes. No CLI execution. No env/secrets.

---

## Phase 1 — Useful Manual Orchestrator
**Status: COMPLETE (e37b507)**

The app is a structured, audited, human-approved task manager for AI-assisted development. Every agent interaction is manual but governed.

### Delivered
- [x] Task intake with risk/env/agent config and 5 presets
- [x] Structured 8-section prompt generator
- [x] Agent run recording with 8-point heuristic evaluation
- [x] Risk analyzer (7 flags, negation-stripping)
- [x] Evidence checker (5 evidence types)
- [x] Decision engine (5 decision codes)
- [x] Next-prompt generator
- [x] Instruction lifecycle state machine (6 states)
- [x] SHA256 stateVersion for optimistic concurrency
- [x] Approval gate (atomic, race-condition-safe)
- [x] GOVERNANCE_API_KEY middleware guard
- [x] Input length validation
- [x] Full AuditLog on all transitions
- [x] Dashboard with governance health
- [x] Pending approvals queue
- [x] Evidence report per task
- [x] 124 passing tests

### Acceptance Criteria (all met)
- Build clean, typecheck clean
- All 124 tests pass
- Risk analysis, decision routing, approval gating tested
- No secrets in codebase
- AuditLog on every write

---

## Phase 2 — GitHub-Aware Orchestrator
**Status: NOT STARTED**
**Priority: HIGH — this is the biggest usability gap**

### Scope
Connect the orchestrator to real GitHub repos so evidence (files changed, commit SHA, CI status) is auto-imported instead of manually pasted.

### Milestones

#### 2.1 — Project Registry
**Scope:** Add `ProjectConfig` model with GitHub metadata. Build project creation UI.  
**Files likely affected:**
- `prisma/schema.prisma` — new ProjectConfig model
- `src/app/api/projects/route.ts` — new CRUD
- `src/app/projects/page.tsx` — project list UI
- `src/app/projects/new/page.tsx` — project creation form
- `src/app/tasks/new/page.tsx` — add project selector

**Risk:** Medium (schema migration required)  
**Acceptance criteria:**
- Can create/list/view projects with repoOwner, repoName, defaultBranch, devBranch
- Tasks linked to specific projects (not default auto-create)
- Project appears on dashboard with task count

#### 2.2 — GitHub PR Evidence Import
**Scope:** When an AgentRun is created, offer a "Import from PR" button that fetches files changed, commit SHA, and CI status from a GitHub PR URL.  
**Files likely affected:**
- `src/lib/githubClient.ts` — new (GitHub REST client)
- `src/app/api/runs/import-pr/route.ts` — new endpoint
- `src/components/RunPromptPanel.tsx` — add PR URL input
- `src/app/api/runs/route.ts` — accept commitHash/ciStatus from import

**Risk:** Low (additive, no existing logic changed)  
**Acceptance criteria:**
- Enter PR URL, click Import
- AgentRun.filesChanged, commitHash, testResult auto-populated from GitHub
- Manual paste still works as fallback

#### 2.3 — GitHub Webhook Receiver
**Scope:** POST /api/webhooks/github receives PR events and auto-updates AgentRun CI status.  
**Files likely affected:**
- `src/app/api/webhooks/github/route.ts` — new
- `src/lib/webhookHandler.ts` — new (event router)
- `prisma/schema.prisma` — AgentRun.ciStatus field

**Risk:** Medium (webhook signature verification required to avoid injection)  
**Acceptance criteria:**
- Webhook signature verified (HMAC SHA256)
- `check_run completed` event updates AgentRun status
- `pull_request opened` event links PR to pending task
- All webhook events logged to AuditLog

#### 2.4 — Langfuse Integration
**Scope:** Replace console.info stub with real Langfuse HTTP calls.  
**Files likely affected:**
- `src/lib/langfuse.ts` — implement real HTTP client

**Risk:** Low (isolated to one file)  
**Acceptance criteria:**
- Langfuse traces visible in cloud.langfuse.com for agent runs
- Falls back gracefully if LANGFUSE keys not set

---

## Phase 3 — DEV Deployment-Aware Orchestrator
**Status: NOT STARTED**
**Priority: MEDIUM**

### Scope
Know whether the DEV server is healthy after each approved agent run. No production automation.

### Milestones

#### 3.1 — DEV Config in Project Registry
**Scope:** Add devServerUrl, healthEndpoint, containerName, deployCommand, testCommand to ProjectConfig.  
**Risk:** Low (additive schema fields)

#### 3.2 — Post-Approval DEV Validation
**Scope:** After task approval, offer "Validate DEV" button that runs deployCommand + polls healthEndpoint.  
**Files likely affected:**
- `src/app/api/tasks/[id]/validate-dev/route.ts` — new
- `src/lib/devValidator.ts` — new (deploy + health check logic)

**Risk:** Medium (command execution must be sandboxed, env=production blocked at API)  
**Acceptance criteria:**
- deployCommand only executes for environment = 'local' or 'dev'
- Attempt for staging/production returns 403
- Health endpoint polled for up to 30s
- Docker logs captured and stored in AgentRun.testResult
- Validation result visible on task report

#### 3.3 — DEV Status on Dashboard
**Scope:** Dashboard shows per-project DEV server status.  
**Risk:** Low

---

## Phase 4 — Semi-Autonomous Sub-Agent Workflow
**Status: NOT STARTED**
**Priority: MEDIUM (after Phase 2 is stable)**

### Scope
Delegate repeatable low-risk tasks to sub-agents under policy. Rahul reviews exceptions only.

### Milestones

#### 4.1 — Autonomy Policy Engine
**Scope:** AutoApprovePolicy model. Define per-project rules for when a task can proceed without manual approval.  
**Files likely affected:**
- `prisma/schema.prisma` — AutoApprovePolicy model
- `src/lib/policyEngine.ts` — new
- `src/app/api/tasks/[id]/auto-evaluate/route.ts` — new

**Risk:** High (wrong policy = unreviewed changes merged)  
**Acceptance criteria:**
- Policy defines: allowedDecisions, allowedEnvironments, maxRiskLevel, requireCIGreen
- Task passes ALL conditions → auto-approved + AuditLog note
- Any condition fails → queued for Rahul review
- Red lines always block regardless of policy (production, secrets-exposure, destructive-command, database-migration)

#### 4.2 — Sub-Agent Role Definitions
**Scope:** Define CTO / CISO / QA / DevOps / Docs sub-agent personas with per-role autonomy levels and red-line rules.  
**Risk:** Medium  

#### 4.3 — Exception Queue
**Scope:** Replace "all tasks show to Rahul" with "only BLOCKED + SENIOR_APPROVAL tasks surface."  
**Files likely affected:**
- `src/app/page.tsx` — exception-focused dashboard view
- `src/components/ExceptionQueue.tsx` — new

**Risk:** Low

#### 4.4 — Real Agent Dispatch
**Scope:** Replace manual copy-paste with API dispatch to Claude Code CLI, OpenClaw, or Codex.  
**Risk:** High (external API calls with agent autonomy)  
**Acceptance criteria:**
- Dispatch only if policy allows
- All agent calls traced in Langfuse
- Output captured automatically (no manual paste)
- Any timeout or error surfaces as BLOCKED

---

## Phase 5 — Production-Grade Governance
**Status: NOT STARTED**
**Priority: LOW (do not start before Phase 3 is stable)**

### Scope
The orchestrator can govern changes that touch staging and production with full evidence chain and browser authentication.

### Milestones

#### 5.1 — Browser Authentication
**Scope:** Rahul login (email magic link or GitHub OAuth). Session-based approval tracking.  
**Risk:** High (auth is a security-critical change)  
**Acceptance criteria:**
- Unauthenticated browser requests redirected to login
- Approval records include real approverId from session
- AuditLog userId populated on every event

#### 5.2 — Rate Limiting
**Scope:** Rate limit all mutation endpoints (tasks, runs, approvals, operator-sessions).  
**Risk:** Low  

#### 5.3 — Production Deployment Gate
**Scope:** Full evidence chain required before any production task can proceed:
- CI green
- DEV validated
- All instructions completed
- Senior approval (Rahul click, not auto)
- Staging validated (optional)

**Risk:** High  

#### 5.4 — Database Migration Gate
**Scope:** Any task involving `prisma migrate` requires separate approval workflow with schema diff review.  
**Risk:** High  

#### 5.5 — Secret Rotation Detection
**Scope:** Any diff containing `.env`, credential patterns, or `api_key` references must trigger CISO review before merge.  
**Risk:** Medium
