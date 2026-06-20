# Current State Snapshot — Coder by DevAscend

**Date:** 2026-06-19  
**Branch:** main  
**Last merged PR:** #183 (Phase 3 complete)  
**Open PRs pending merge:** #184–#192 (9 open; all CI green or in progress)  
**Test count at tip of open PRs:** ~1492 passing (local; CI verifies on merge)  
**DEV deployment:** Verified (app running on DEV server)

---

## Feature Status

### Task & Agent Run Management

| Feature | Status | Location |
|---------|--------|----------|
| Task create/list/detail | Built | `/tasks`, `/tasks/new`, `/tasks/[id]` |
| 5 task presets | Built | `src/app/tasks/new/page.tsx` |
| Structured 8-section prompt generator | Built | `src/lib/promptBuilder.ts` |
| Agent run recording (paste-in) | Built | `src/components/RunPromptPanel.tsx` |
| 8-point heuristic evaluation | Built | `src/lib/promptEvaluator.ts` |
| Operator session risk analysis | Built | `src/lib/riskAnalyzer.ts` |
| Decision engine (5 codes) | Built | `src/lib/decisionEngine.ts` |
| Instruction lifecycle (6 states) | Built | PATCH `/api/instructions/[id]` |
| Atomic approval gate | Built | `src/lib/approvalGuard.ts` |
| Policy gate evaluation | Built | `evaluatePolicy` on task page |
| AI Change Control Pack | Built | Evidence API + page per task |
| Sandbox Replay | Built | `sandboxPlan` field; approve/reject sandbox; preview mode |
| Task clone | Built | `POST /api/tasks/[id]/clone` |
| Task PDF export | Built | `GET /api/tasks/[id]/pdf` |
| Task bulk operations | Built | `POST /api/tasks/bulk` |
| Task comments | Built | `/api/tasks/[id]/comments` |
| Task linking to PRs | Partial | Manual PATCH only — auto-link not implemented |

### GitHub PR Intelligence

| Feature | Status | Location |
|---------|--------|----------|
| PR import (URL or owner/repo/number) | Built | `POST /api/github-prs` |
| Incremental PR sync | Built | `POST /api/github-prs/sync` |
| Full PR history import | Built | `FullSyncButton` component + `fullSync: true` |
| PR classification (deterministic) | Built | `src/lib/prClassifier.ts` |
| Bug state detection | Built | `src/lib/prClassifier.ts` |
| PR memory search | Built | `GET /api/github-prs/memory` |
| PR timeline (week/day/milestone) | Built | `src/lib/buildTimeline.ts` |
| Governance Timeline page | Built | `src/app/projects/[id]/timeline/page.tsx` |
| Repository Intelligence API | Built | `GET /api/projects/[id]/intelligence` |
| Repository Intelligence UI | Built | `/projects/[id]/intelligence` page |
| PR refresh from GitHub | Built | `POST /api/github-prs/[id]/refresh` |
| Sync progress polling | Built | `GET /api/github-prs/sync-status` + `PrSyncState` model |
| Agent run linking to PRs | Partial | Manual PATCH only — auto-link not implemented |
| LLM PR summaries | Planned | `FEATURE_REPO_MEMORY_LLM=false` (Phase 3 follow-up) |
| GitHub webhooks (incoming) | Planned | Not started (Phase 3 follow-up) |

### Governance Visualization (Phase 3 — COMPLETE)

| Feature | Status | Location |
|---------|--------|----------|
| Sync progress polling | Built | `GET /api/github-prs/sync-status` |
| FullSyncButton live progress | Built | `src/components/FullSyncButton.tsx` |
| Agent role-scoped dashboard | Built | `/dashboard` (role-filtered views) |
| Policy risk dashboard | Built | `/projects/[id]/policy` |
| Risk rule reference UI | Built | `/projects/[id]/policy` (rule browser) |
| Sandbox replay comparison | Built | `/tasks/[id]/sandbox` |
| What-if analysis panel | Built | `/tasks/[id]/sandbox` |
| Incident postmortem view | Built | `/incidents/[id]/postmortem` |
| Change control dashboard | Built | `/projects/[id]/change-control` |
| Executive dashboard | Built | `/executive` (ADMIN/SENIOR only) — with `error.tsx` crash recovery |
| System status page | Built | `/status` |
| Admin settings page | Built | `/admin/settings` |
| Onboarding page | Built | `/onboarding` |
| Demo showcase page | Built | `/demo` |
| Rate limiting (4 mutations) | Built | `src/lib/rateLimiter.ts` |

### Incident Management

| Feature | Status | Location |
|---------|--------|----------|
| Incident model | Built | `prisma/schema.prisma` |
| Incidents API (CRUD) | Built | `/api/incidents` |
| Incidents page | Built | Navigation accessible |

### Agent Scorecard & Reporting

| Feature | Status | Location |
|---------|--------|----------|
| Agent Scorecard page + API | Built | Provider scorecard |
| Client Report Templates | Built | Task and project report APIs |
| Execution trace (append-only) | Built | `src/lib/trace/writer.ts` |
| Mermaid diagram generation | Built | `/api/diagrams` |
| SVG export | Built | `/api/diagrams/[id]/export` |

### Auth & Platform

| Feature | Status | Location |
|---------|--------|----------|
| GitHub OAuth | Built | `/api/auth/github/callback` |
| iron-session auth | Built | `src/lib/session.ts` |
| RBAC | Built | `src/lib/rbac.ts` |
| API keys (SHA-256) | Built | `/api/keys` |
| Outgoing HMAC webhooks | Built | `/api/webhooks` |
| SSE events | Built | `/api/events` |
| Immutable audit log | Built | `src/lib/audit.ts` |
| Audit log CSV export | Built | `/api/audit/export` |
| Share links | Built | `/api/share-links` |
| Organization invitations | Built | `/api/invite` |
| Notification preferences | Built | `/api/notifications/preferences` |
| Multi-org support | Partial | Schema + API exist; UI limited |
| CI Dashboard | Partial | Route + schema exist; UI partial |
| Billing / usage | Partial | Schema + usage API; no payment gateway |

---

## Migrations in Place

All migrations applied to DEV database as of 2026-06-18:

| Migration | Description |
|-----------|-------------|
| `20260521140745_init` | Initial schema: Task, AgentRun, Evaluation, Approval, AuditLog, OperatorSession |
| `20260525120000_add_operator_session` | OperatorSession model |
| `20260525130000_add_instruction` | Instruction model |
| `20260525140000_instruction_transition_fields` | Transition fields (approvedBy, blockedReason, executingAgent) |
| `20260525150000_instruction_state_version` | SHA256 stateVersion for optimistic concurrency |
| `20260603000001_add_project_github_fields_and_github_pr` | ProjectConfig GitHub fields + GithubPR model |
| `20260612000000_add_user_role` | User.role field |
| `20260612171446_add_active_session` | Session management |
| `20260612183020_add_orchestration_models` | AgentRole, orchestration support |
| `20260612190000_add_notification` | Notification model |
| `20260614000000_add_project_tracker_fields` | Project tracker fields (milestones, devServerUrl, etc.) |
| `20260616000003_add_diagram` | Diagram model |
| `20260616000004_add_api_key` | ApiKey model |
| `20260616000005_add_invitation` | Invitation model |
| `20260616000006_add_comment` | Comment model |
| `20260616000007_add_notification_preference` | NotificationPreference model |
| `20260616000008_add_ci_run` | CiRun model |
| `20260616000009_add_share_link` | ShareLink model |
| `20260616000010_add_webhook` | Webhook model |
| `20260616000011_add_user_credentials` | User password credentials |
| `20260616000012_add_organization` | Organization + Membership models |
| `20260617000001_add_agent_role` | AgentRole definitions |
| `20260617000002_add_execution_trace` | ExecutionTrace (append-only) |
| `20260617000003_pr_memory_index` | PR memory search index |

**Pending migration (in PR #188):** `20260619000001_add_performance_indexes` — 5 indexes for Task, AuditLog, and GithubPR for pagination and evidence timeline queries.

---

## DEV Deployment Status

- App running on DEV server (last verified at PR #183 merge)
- 24 migrations in repo (migration #188 pending DB apply)
- Build clean (TypeScript strict, no errors)
- Test suite: ~1492 passing at tip of open PRs; 0 failures
- Feature flags all default to `false` — no LLM keys required to run
- `open-swe` agent tool disabled in UI with "(coming soon)" label (PR #187)

---

## Known Gaps & Technical Debt

### Security
| ID | Severity | Description |
|----|----------|-------------|
| ~~M1~~ | ~~Medium~~ | ~~No rate limiting on mutation endpoints~~ — **RESOLVED** PR #184 |
| ~~M2~~ | ~~Medium~~ | ~~Route-level auth missing on 11 endpoints~~ — **RESOLVED** PRs #187, #188, #189, #190, #191 |
| ~~M3~~ | ~~Medium~~ | ~~Comment DELETE had no auth or ownership check~~ — **RESOLVED** PR #189 |
| ~~M4~~ | ~~Medium~~ | ~~GET + POST /api/operator-sessions unauthenticated~~ — **RESOLVED** PR #192 |
| ~~M5~~ | ~~Medium~~ | ~~GET /api/incidents + several routes had unbounded findMany()~~ — **RESOLVED** PRs #188, #192 |
| ~~M6~~ | ~~Medium~~ | ~~Webhook event names not validated against allowlist~~ — **RESOLVED** PR #192 |
| L1 | Low | `approverId` on Approval is self-reported in some code paths |
| L2 | Low | AuditLog `userId` not always populated (depends on session presence) |
| L3 | Low | Physical DB-level immutability (row-level security) not enforced |
| L4 | Low | In-memory rate limit buckets — resets on server restart, not distributed |
| L5 | Low | Read endpoints (GET) unrate-limited at route level (middleware handles 60/min) |

### Functional Gaps
| Gap | Impact | Notes |
|-----|--------|-------|
| No incoming GitHub webhooks | Medium | PR data only updated on manual sync or import |
| ~~No auto-link PRs to agent runs~~ | ~~Medium~~ | **RESOLVED** PR #185 — scored discovery + one-click link |
| No real-time PR sync | Low | Batch sync sufficient for current usage |
| CI Dashboard UI incomplete | Low | Schema + route exist; no UI built |
| Multi-org UI incomplete | Low | API works; UI limited to basic org page |
| Langfuse stubbed | Low | Console fallback; no real observability on LLM calls |
| No email/Slack notifications | Low | Preferences stored; no dispatch wired |
| No background job runner | Medium | Full sync blocks the HTTP request; may timeout on very large repos |
| ~~Webhook delivery not implemented~~ | ~~Medium~~ | **RESOLVED** PR #191 — HMAC-signed delivery, 10 event types, auto-disable on 5 failures |

### Technical Debt
| Item | Notes |
|------|-------|
| Full history sync is synchronous | Blocks the HTTP request; should be moved to a background job |
| No connection pooling | Direct PostgreSQL connection; may struggle under concurrent load |
| `open-swe` agent tool stub | Disabled in UI with "(coming soon)"; implementation not started |
| No automated smoke tests in CI | Smoke tests are run manually post-deploy |
| Notification preferences use inline `getIronSession` | Inconsistent with `getCurrentUser()` pattern used elsewhere |
