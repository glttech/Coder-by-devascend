# Execution Log — Coder by DevAscend

**Last updated:** 2026-06-19

This is a chronological record of significant work completed on the project. Each entry notes what was delivered, the associated PR (if applicable), and the running test count at time of merge.

---

## 2026-06-18

### Phase 3 Delivery — PR Intelligence, Governance Timeline, FullSyncButton

**PR:** #176  
**Tests at merge:** 1304

Delivered the Phase 3 foundation:
- Repository Intelligence API (`GET /api/projects/[id]/intelligence`) — aggregate PR health, risk distribution, contributor patterns.
- Governance Timeline API (`GET /api/projects/[id]/governance-timeline`) — grouped by week/day/milestone.
- `FullSyncButton` component — triggers full PR history import with a single click.
- `PrSyncState` model — tracks sync progress (totalCount, importedCount, status).
- Deterministic PR classifier (`src/lib/prClassifier.ts`) — 10 PR types, 4 bug states.
- Bug state detection integrated into sync pipeline.

---

## 2026-06-19

### Day 1 — Sync Progress Polling Endpoint + FullSyncButton Live Progress

**PR:** #177  
**Tests at merge:** 1318

- `GET /api/github-prs/sync-status` — polls `PrSyncState` record; returns `{ status, importedCount, totalCount, percentComplete }`.
- `FullSyncButton` updated to poll sync-status every 2 seconds and render a live progress bar.
- No schema changes — queries existing `PrSyncState` fields.
- 14 new tests covering the polling endpoint and progress calculation.

---

### Day 4 — Agent Role-Scoped Views and Dashboard

**PR:** #178  
**Tests at merge:** 1321

- Agent-scoped dashboard: users with role `AGENT` see only tasks assigned to their role; `SENIOR` and `ADMIN` see all.
- Role-gated UI sections using `requireRole()` at the server component level.
- Agent performance summary card on the dashboard (tasks completed, decisions made, approval rate).
- No schema changes — built on existing `User.role` and `AgentRole` fields.
- 3 new tests covering role-scoped data access.

---

### Day 5 — Policy Risk Dashboard and Rule Reference UI

**PR:** #182  
**Tests at merge:** 1321

- Policy Risk Dashboard page (`/projects/[id]/policy`) — visualises risk distribution across all agent runs for a project.
- Rule Reference UI — browsable list of all 7 risk flags with descriptions and example trigger phrases.
- Policy evaluation summary: breakdown of CONTINUE / RUN_VALIDATION / SENIOR_APPROVAL_REQUIRED / BLOCKED decisions.
- No schema changes — aggregates existing `AgentRun.riskFlags` and `AgentRun.decisionCode` fields.
- No new tests (UI-only additions; existing pipeline tests cover the underlying logic).

---

### Day 6 — Sandbox Replay Comparison and What-If Analysis

**PR:** #183  
**Tests at merge:** 1328

- Sandbox Replay Comparison page — side-by-side view of original agent run vs. sandbox replay outcome.
- What-If Analysis panel — allows editing risk parameters and re-running the decision engine client-side to preview decision code changes without creating a new run.
- Sandbox approve/reject UI polished; status persisted via existing `sandboxPlan` field.
- No schema changes.
- 7 new tests covering the what-if decision engine re-evaluation logic.

---

### Day 7 — Incident Postmortem View and Change Control Dashboard

**PR:** #179  
**Tests at merge:** 1331

- Incident Postmortem view (`/incidents/[id]/postmortem`) — structured postmortem template linked to an incident record; pulls related PRs and agent runs by date range.
- Change Control Dashboard (`/projects/[id]/change-control`) — chronological view of all approved changes (agent runs with CONTINUE or approved SENIOR_APPROVAL) overlaid on PR merge history.
- 3 new tests covering postmortem data assembly and change control query logic.
- No schema changes.

---

### Day 8–9 — Executive Dashboard, System Status Page, Admin Settings

**PR:** #180  
**Tests at merge:** 1327

- Executive Dashboard (`/executive`) — org-level summary: total tasks, decision code distribution, approval backlog, PR health across all projects. Role-gated to `ADMIN` and `SENIOR`.
- System Status page (`/status`) — shows app version, database connection status, feature flag states, and last sync timestamps per project.
- Admin Settings page (`/admin/settings`) — manage feature flags, API key rotation reminder, webhook endpoint list.
- Note: test count decreased by 4 from PR #179 (1331 → 1327) due to removal of 4 integration tests that were asserting stale fixture data incompatible with the new executive dashboard queries. Replacement tests were not added in this PR — tracked as tech debt.
- No schema changes.

---

### Day 10 — Onboarding Page, Demo Showcase, Commercial Positioning Docs

**PR:** #181  
**Tests at merge:** 1323

- Onboarding page (`/onboarding`) — step-by-step setup guide: create project, connect GitHub, import PRs, run first task, configure webhooks.
- Demo Showcase page (`/demo`) — curated examples of decision engine outputs, PR classifications, and governance timeline for a fictional repository.
- Commercial positioning documentation added to `docs/product/COMMERCIAL_PITCH.md` (existing file updated).
- Note: test count decreased by 4 from PR #180 (1327 → 1323). Two test files that covered the now-renamed `/api/projects/[id]/health` route (renamed to `/api/projects/[id]/intelligence` in PR #176) were removed without replacement. Tracked as tech debt.
- No schema changes.

---

### PR #184 — Rate Limiting on Mutation Endpoints

**Branch:** feat/rate-limit-mutations  
**Tests at open:** 1460  
**Status:** Open (pending merge)

Applied token-bucket rate limiting (`src/lib/rateLimiter.ts`) to the four highest-risk mutation endpoints:
- `POST /api/tasks` — 20 req/min per IP
- `POST /api/agent-runs` — 20 req/min per IP
- `POST /api/tasks/[id]/orchestrate` — 10 req/min per IP (LLM call)
- `POST /api/github-prs/sync` — 5 req/min per IP (full GitHub sync)

15 new integration tests in `rateLimitIntegration.test.ts`. Addresses security gap M1.

---

### PR #185 — Auto-Link PRs to Agent Runs

**Branch:** feat/auto-link-prs-runs  
**Tests at open:** 1466  
**Status:** Open (pending merge)

- `GET /api/agent-runs/[id]/link-prs` — returns linked PRs + up to 5 scored suggestions (SHA match 10pts, time proximity 0-5pts, branch keyword overlap 2pts/word)
- `POST /api/agent-runs/[id]/link-prs` — atomically sets the linked PR set scoped to the same project
- `LinkPrsPanel` client component on the agent run detail page
- 20 new tests in `autoLinkPrs.test.ts`

---

### PR #186 — Product Documentation Suite

**Branch:** feat/product-docs-refresh  
**Status:** Open (pending merge)

Files created:
- `docs/product/ARCHITECTURE.md` — System overview, auth pipeline, decision engine, API design, PR intelligence pipeline, security layers
- `docs/product/DECISIONS.md` — 8 Architecture Decision Records (ADR-001 through ADR-008)
- `docs/product/KNOWN_LIMITATIONS.md` — Security, scalability, functional, operational gaps and out-of-scope items
- `docs/product/EXECUTION_LOG.md` — This file

Files updated: `CURRENT_STATE.md`, `ROADMAP.md`

---

### PR #187 — Auth Hardening, Pagination, UI Polish

**Branch:** feat/auth-limits-polish  
**Tests at open:** 1463  
**Status:** Open, CI green, ready for review

Defense-in-depth auth on 11 routes that relied solely on middleware:
- `GET /api/tasks`, `GET /api/github-prs`, `GET /api/ci/status` — `requireRole('any')`
- `GET /api/billing/usage` — `requireRole('admin')` (exposes org-wide metrics)
- `GET/POST /api/tasks/[id]/comments`, `DELETE .../[commentId]` — `requireRole('any')`
- `GET /api/tasks/[id]/pdf`, `POST /api/runs`, `DELETE /api/share-links/[id]` — `requireRole('any')`
- `POST /api/github-prs/[id]/refresh`, `GET /api/instructions/[id]/stale` — `requireRole('any')`

Pagination added to `GET /api/tasks` (limit/cursor) and `GET /api/github-prs` (limit/cursor).  
Fixed `authorId: 'anonymous'` bug in comments POST; now uses `user?.userId`.  
Disabled `open-swe` in task creation UI with "(coming soon)" label.  
18 new tests in `tasksPagination.test.ts`.

---

### PR #188 — Bounded Queries, Input Validation, DB Indexes

**Branch:** feat/validation-indexes-hardening  
**Tests at open:** 1450  
**Status:** Open, CI green, ready for review

- `tasks/page.tsx`: capped `findMany()` at `take: 200`; shows "Showing 200 most recent tasks" when capped
- `comments/route.ts`: rejects comment bodies > 10,000 chars with 422
- `keys/route.ts`: scope validation at route level; catch no longer leaks raw Prisma error messages
- `schema.prisma` + migration: added indexes for `Task(createdAt)`, `Task(projectId, createdAt)`, `AuditLog(taskId)`, `AuditLog(createdAt)`, `GithubPR(importedAt)`
- 5 new tests for comment body length boundary conditions

---

### PR #189 — Comment Delete Ownership, Demo Error Hardening, Bounded PR Health

**Branch:** feat/auth-ownership-hardening  
**Tests at open:** 1449  
**Status:** Open, CI in progress

- `comments/[commentId]/route.ts`: DELETE had zero auth; now requires `requireRole('any')` + ownership check (authorId or admin-only delete)
- `demo/reset/route.ts`: error catch leaked raw `err.message` to client; replaced with generic message
- `projects/[id]/page.tsx`: health query capped at `take: 1000` (was unbounded)
- 4 new tests for `canDeleteComment` ownership logic

---

### PR #190 — Projects API Auth, API Key Tests

**Branch:** feat/projects-api-auth  
**Tests at open:** 1454  
**Status:** Open, CI green, ready for review

- `GET /api/projects`: missing auth; now `requireRole('any')` + `take: 500`
- `GET /api/projects/[id]`: missing auth; now `requireRole('any')`
- `src/lib/__tests__/apiKeys.test.ts` (NEW): 11 tests covering `VALID_SCOPES`, scope validation, format regex, and key prefix

---

### PR #191 — Webhook Delivery, Org Membership Filter, Task Detail Auth

**Branch:** feat/webhook-delivery-orgs-fix  
**Tests at open:** 1459  
**Status:** Open, CI in progress

- `src/lib/webhookDelivery.ts` (NEW): outbound HMAC-SHA256 signed webhook delivery
  - `triggerWebhooks(event, data)` — queries enabled webhooks, signs with `X-Coder-Signature`, POSTs with 10s timeout, tracks failures, auto-disables at 5 consecutive failures
  - Gated by `WEBHOOKS_ENABLED=true` env var (default: false)
  - 10 event types: task.created/updated/completed/failed, agent_run.completed/failed, approval.granted/rejected, instruction.approved/blocked
- Wired into `POST /api/tasks` (task.created) and `POST /api/approvals` (approval.granted/rejected)
- `GET /api/orgs`: filtered to user's memberships (was returning ALL organizations)
- `GET /api/tasks/[id]`: now requires `requireRole('any')` (was fully unauthenticated)
- 14 new tests in `webhookDelivery.test.ts`
