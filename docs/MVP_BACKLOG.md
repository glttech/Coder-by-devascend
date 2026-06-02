# MVP Backlog — Top 20 Tasks

**Goal:** Make the app genuinely useful as Rahul's AI engineering control room.  
**Ordering:** Impact on daily usefulness, then risk.  
**Safe to auto-merge:** Only if all conditions in AUTONOMY_POLICY.md are met (environment=dev, riskLevel=low, CI green, no red-line flags).

---

## Tier 1 — Project Registry (Unblocks Everything)

### #1 — Project Registry: Schema + API
**Impact:** Critical — without this, multi-project management is impossible  
**Risk:** Medium (schema migration required)  
**Auto-merge safe:** No (schema change)  
**PR scope:** Single PR  

What to build:
- Add `ProjectConfig` model to `prisma/schema.prisma` (see PROJECTS_REGISTRY_SPEC.md)
- `GET /api/projects` — list all projects
- `POST /api/projects` — create project with required fields
- `GET /api/projects/[id]` — get project with config
- `PATCH /api/projects/[id]` — update project config
- Validation: repoOwner, repoName required; autonomyLevel enum check; URL format on healthEndpoint

Tests needed:
- POST /api/projects: valid creation, missing required fields, invalid enum
- PATCH /api/projects/[id]: partial update, invalid fields
- GET /api/projects: returns list

---

### #2 — Project Registry: UI
**Impact:** High — Rahul needs to create and manage projects via the UI  
**Risk:** Low (UI only, no schema changes)  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `src/app/projects/page.tsx` — project list with links to detail
- `src/app/projects/new/page.tsx` — project creation form (name, repoOwner, repoName, defaultBranch, autonomyLevel)
- `src/app/projects/[id]/page.tsx` — project detail with config display
- Update sidebar nav to include Projects link
- Update `src/app/tasks/new/page.tsx` — dropdown to select project (instead of auto-default)

Tests needed:
- Form validation on new project page (client-side)

---

## Tier 2 — GitHub Integration (Core Phase 2 Value)

### #3 — GitHub PR Evidence Import
**Impact:** High — eliminates the most tedious manual step (copy-paste from GitHub)  
**Risk:** Low (additive, no existing logic changed)  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `src/lib/githubClient.ts` — `fetchPRDetails(owner, repo, prNumber, token)` returning filesChanged, commitSHA, ciStatus
- `POST /api/runs` — accept optional `prUrl` field; if provided, auto-populate filesChanged, commitHash, testResult
- `src/components/RunPromptPanel.tsx` — add optional "GitHub PR URL" input field
- Graceful fallback: if PR URL is empty, manual paste still works

Tests needed:
- `githubClient.ts`: mock GitHub API, test PR detail extraction
- `POST /api/runs`: with prUrl + without prUrl, invalid PR URL format

---

### #4 — GitHub Webhook Receiver
**Impact:** High — enables reactive updates when CI changes or PRs are opened  
**Risk:** Medium (webhook signature verification is security-critical)  
**Auto-merge safe:** No (security-critical new endpoint)  
**PR scope:** Single PR  

What to build:
- `POST /api/webhooks/github` — receive GitHub webhook events
- HMAC-SHA256 signature verification using `webhookSecret` from ProjectConfig
- Handle events: `pull_request.opened`, `check_run.completed`
- On `check_run.completed`: update matching AgentRun.testResult with CI status
- On `pull_request.opened`: link PR to pending task (by branch name match)
- All events logged to AuditLog

Tests needed:
- Signature verification: valid sig passes, invalid sig returns 401
- `check_run.completed`: AgentRun status updated correctly
- Unknown event type: 200 OK with no-op (don't error on unknown events)

---

## Tier 3 — Dashboard + Usability (Quick Wins)

### #5 — Dashboard: Per-Project Task Grouping
**Impact:** High — dashboard is currently a flat list; Rahul needs to see status per project  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Group dashboard stats by project
- Show per-project: task count, pending approvals, last activity
- "No project configured" prompt with link to /projects/new

Tests needed:
- None required (UI-only)

---

### #6 — AuditLog: Log Task Creation + AgentRun Creation
**Impact:** Medium — audit trail currently missing task and run creation events  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Add `prisma.auditLog.create({ event: 'task_created' })` in `POST /api/tasks`
- Add `prisma.auditLog.create({ event: 'agent_run_created' })` in `POST /api/runs`
- Audit log viewer: add new event types to the filter dropdown

Tests needed:
- After POST /api/tasks: verify AuditLog entry exists with event='task_created'
- After POST /api/runs: verify AuditLog entry exists with event='agent_run_created'

---

### #7 — Task Status Auto-Update
**Impact:** Medium — Task.status currently never changes from 'pending'; no lifecycle progression  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- When a task Approval is set to `approved = true` → set Task.status = 'running'
- When all Instructions for a task reach `completed` → set Task.status = 'completed'
- When any Instruction is `blocked` → set Task.status = 'failed' (or flag for review)
- AuditLog entry on each status change

Tests needed:
- Approval approved → task status becomes 'running'
- Last instruction completed → task status becomes 'completed'
- Instruction blocked → task status becomes 'failed'

---

### #8 — Task Edit Page
**Impact:** Medium — currently there is no way to edit a task after creation  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `PATCH /api/tasks/[id]` — update title, instruction, riskLevel, environment, approvalRequired
- Block edits if task is in `completed` or `failed` status
- `src/app/tasks/[id]/edit/page.tsx` — edit form with current values pre-filled
- AuditLog entry on edit
- "Edit" button on task detail page (only shown for pending/running tasks)

Tests needed:
- PATCH /api/tasks/[id]: valid update, blocked on terminal status, invalid fields

---

### #9 — Instruction Bulk Status View + Quick Approve
**Impact:** Medium — currently approving instructions requires manual API call  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Improve `/instructions/pending` page: show all pending instructions grouped by task
- Add inline "Approve" button on each row (calls PATCH /api/instructions/[id] with status='approved')
- Add inline "Block" button with text field for blockedReason
- Remove requirement to use raw API — make it fully UI-driven

Tests needed:
- None required (UI interaction test only)

---

### #10 — Risk Analyzer: Fuzz Test + Expand Negation Patterns
**Impact:** Medium — M-PI1 security gap from SECURITY_GAP_ANALYSIS.md  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Expand `stripNegatedClauses()` to handle additional patterns:
  - "I did not...", "We have not...", "Nothing was...", "No changes were made to..."
  - "avoided", "skipped", "not executed", "bypassed"
- Add adversarial fuzz test suite with 20+ crafted injection attempts
- Confirm that real-risk phrases still trigger correctly after stripping

Tests needed:
- 20+ adversarial inputs that attempt to suppress risk flags
- Verify all 7 risk rules still fire correctly on genuine risky content

---

## Tier 4 — Security (Close the Known Gaps)

### #11 — Rate Limiting on Mutation Endpoints
**Impact:** Medium — M2 from SECURITY_GAP_ANALYSIS.md  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- In-memory rate limiter in Next.js middleware (or lightweight library)
- Limits: 20 req/min for POST endpoints, 60 req/min for GET
- Return 429 with Retry-After header when exceeded
- Rate limit keyed on IP (or x-forwarded-for in proxy context)

Tests needed:
- Rate limit middleware: 21st request returns 429
- GET endpoints: not rate limited (or higher limit)

---

### #12 — Browser Authentication (Phase 5 pre-req)
**Impact:** High — H1 from SECURITY_GAP_ANALYSIS.md  
**Risk:** High (auth is security-critical)  
**Auto-merge safe:** No  
**PR scope:** Multiple PRs recommended (auth setup, protect pages, populate approverId)  

What to build:
- iron-session or next-auth with GitHub OAuth
- Login page at `/login`
- Extend middleware matcher to ALL routes (not just `/api/*`)
- Unauthenticated → redirect to `/login`
- After login → populate session with userId
- Populate `approverId` in Approval on login session
- Populate `userId` in AuditLog on all events

Tests needed:
- Unauthenticated request to `/tasks` → 302 to `/login`
- Authenticated user can access all pages
- Approval created with correct approverId from session

---

## Tier 5 — Observability + Integrations

### #13 — Langfuse Integration
**Impact:** Medium — replaces console.info stub with real trace logging  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Implement `src/lib/langfuse.ts` with real HTTP POST to Langfuse API
- Graceful fallback when LANGFUSE keys not set (current no-op behavior preserved)
- Test with real API key in dev environment

Tests needed:
- Langfuse unavailable (no keys) → no error thrown
- Mock HTTP call: trace created with correct fields

---

### #14 — Open SWE Adapter (Real Implementation)
**Impact:** Medium — currently a stub; the "open-swe" agent tool is non-functional  
**Risk:** Medium (external API call with agent execution)  
**Auto-merge safe:** No  
**PR scope:** Single PR  

What to build:
- Implement `src/lib/openSweAdapter.ts` with real HTTP POST
- Add OPEN_SWE_API_KEY and OPEN_SWE_BASE_URL to `.env.example`
- Return structured result: status, output, filesChanged, commitHash
- Handle timeouts (30s max), errors, and empty responses
- AgentRun auto-populated from result

Tests needed:
- Adapter: mock HTTP, test success + timeout + error paths
- Verify Open SWE result mapped to AgentRun fields correctly

---

### #15 — Dashboard: "How Old Is This Task?" Staleness Indicators
**Impact:** Low-Medium — helps Rahul spot tasks that are stuck  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Task list: highlight rows where `updatedAt` > 7 days with a "stale" badge
- Dashboard governance health already counts stale instructions — extend to tasks
- Add a "Last activity" column to the task list

Tests needed:
- None required (UI-only)

---

## Tier 6 — Quality of Life

### #16 — Structured Prompt Templates (PromptTemplate model activation)
**Impact:** Low-Medium — PromptTemplate model exists but is unused  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `GET /api/prompt-templates` — list templates
- `POST /api/prompt-templates` — create template
- `src/app/prompt-templates/page.tsx` — UI to manage templates
- Update buildPrompt to optionally use a named template as base

Tests needed:
- CRUD for prompt templates

---

### #17 — Task Clone / Duplicate
**Impact:** Low — saves time when creating similar tasks  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `POST /api/tasks/[id]/clone` — duplicate task with new title "Copy of..."
- Clone includes: instruction, agentTool, riskLevel, environment, approvalRequired
- Does NOT clone: agentRuns, approvals, instructions, auditLogs
- "Clone task" button on task detail page

Tests needed:
- Clone creates new task with correct fields
- Clone does not include relations

---

### #18 — Instruction View in Task Detail: Sort + Filter
**Impact:** Low — currently instructions are unsorted and hard to navigate  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Sort instructions by status: executing first, then approved, then pending_approval, then draft, then completed/blocked
- Filter by status in task detail instructions panel
- Show count per status

Tests needed:
- None required (UI-only)

---

### #19 — Prompt Evaluation: Scope Drift Detection Improvement
**Impact:** Low-Medium — current scope drift check compares lists but may miss renamed files  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- Improve `evaluateResponse` scope-drift check
- Normalize file paths before comparison (remove leading `./`, collapse `//`)
- Detect when response mentions files NOT in the original prompt and flag with specific file names
- Include specific drifted file names in the evaluation `reason` field

Tests needed:
- Scope drift: path normalization, novel files flagged with names
- No drift: subset of prompt files, normalized paths

---

### #20 — Export Evidence Report as JSON
**Impact:** Low — useful for archiving completed tasks  
**Risk:** Low  
**Auto-merge safe:** Yes  
**PR scope:** Single PR  

What to build:
- `GET /api/tasks/[id]/export` — returns full task evidence as JSON
- Includes: task, agentRuns, evaluations, operatorSessions, instructions, auditLogs
- Download button on `/tasks/[id]/report` page
- Scrub any fields matching known secret patterns before export (defensive)

Tests needed:
- Export returns correct structure with all relations
- Secret pattern scrubbing test

---

## Backlog Summary Table

| # | Task | Tier | Risk | Auto-merge | Phase |
|---|------|------|------|-----------|-------|
| 1 | Project Registry: Schema + API | 1 | Medium | No | 2 |
| 2 | Project Registry: UI | 1 | Low | Yes | 2 |
| 3 | GitHub PR Evidence Import | 2 | Low | Yes | 2 |
| 4 | GitHub Webhook Receiver | 2 | Medium | No | 2 |
| 5 | Dashboard: Per-Project Grouping | 3 | Low | Yes | 1.5 |
| 6 | AuditLog: Task + Run Creation | 3 | Low | Yes | 1.5 |
| 7 | Task Status Auto-Update | 3 | Low | Yes | 1.5 |
| 8 | Task Edit Page | 3 | Low | Yes | 1.5 |
| 9 | Instruction Quick Approve UI | 3 | Low | Yes | 1.5 |
| 10 | Risk Analyzer Fuzz + Expand | 3 | Low | Yes | 1.5 |
| 11 | Rate Limiting | 4 | Low | Yes | 1.5 |
| 12 | Browser Authentication | 4 | High | No | 5 |
| 13 | Langfuse Integration | 5 | Low | Yes | 2 |
| 14 | Open SWE Real Adapter | 5 | Medium | No | 2 |
| 15 | Staleness Indicators | 6 | Low | Yes | 1.5 |
| 16 | Prompt Templates Activation | 6 | Low | Yes | 1.5 |
| 17 | Task Clone | 6 | Low | Yes | 1.5 |
| 18 | Instruction Sort + Filter | 6 | Low | Yes | 1.5 |
| 19 | Scope Drift Improvement | 6 | Low | Yes | 1.5 |
| 20 | Export Evidence as JSON | 6 | Low | Yes | 1.5 |
