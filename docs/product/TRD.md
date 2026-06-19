# Technical Requirements Document — AI Dev Orchestrator (Coder by DevAscend)

**Version:** 1.0  
**Date:** 2026-06-18  
**Branch:** feature/phase3-pr-intelligence

---

## 1. Architecture Overview

Coder by DevAscend is a monolithic Next.js 14 App Router application backed by PostgreSQL. There are no separate microservices. All business logic lives in the Next.js API routes and shared `src/lib/` modules.

```
Browser (React / App Router)
    |
    v
Next.js API Routes (/api/*)
    |
    +-- src/lib/ (pure business logic, no Next.js deps)
    |       |-- prClassifier.ts          (deterministic PR classification)
    |       |-- buildTimeline.ts         (governance timeline builder)
    |       |-- projectHealth.ts         (project health aggregator)
    |       |-- projectIntelligence.ts   (repository intelligence aggregator)
    |       |-- riskAnalyzer.ts          (7-flag heuristic risk analysis)
    |       |-- decisionEngine.ts        (5 decision code routing)
    |       |-- evidenceChecker.ts       (5 missing-evidence types)
    |       |-- promptBuilder.ts         (structured 8-section prompt generator)
    |       |-- promptEvaluator.ts       (8-point heuristic evaluation)
    |       |-- approvalGuard.ts         (concurrent-safe approval gate)
    |       |-- audit.ts                 (AuditLog writer)
    |       |-- rbac.ts                  (role-based access control)
    |       |-- githubClient.ts          (GitHub REST API client)
    |       |-- featureFlags.ts          (feature flag reader)
    |       |-- session.ts / sessionStore.ts (iron-session helpers)
    |
    +-- prisma/
    |       schema.prisma                (single source of truth for DB schema)
    |
    v
PostgreSQL (via Prisma ORM)
    |
    +-- GitHub REST API v3              (outbound only — no webhooks incoming yet)
```

There is no message queue, no background job runner, and no real-time push from GitHub. All GitHub data is fetched on-demand or on manual sync trigger.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | Server components + API routes |
| Language | TypeScript (strict) | No `any` in lib/ |
| ORM | Prisma 5 | PostgreSQL adapter |
| Database | PostgreSQL 15+ | Single database, no read replicas |
| Auth | GitHub OAuth + iron-session | Cookie-based session |
| Styling | Tailwind CSS | No component library dependency |
| Testing | Node.js built-in test runner + tsx | No Jest |
| Email | Resend (stub) | Not wired to production sending yet |
| Diagrams | Mermaid | Server-side generation + SVG export |
| Feature flags | Environment variables | No remote config service |
| AI/LLM | Anthropic Claude (`@anthropic-ai/sdk`) | Gated behind `FEATURE_AGENT_LLM=false` |
| Vector search | pgvector (planned) | RAG foundation exists; not in prod |
| Observability | Langfuse (stub) | Console fallback when keys absent |

---

## 3. Data Models

Key Prisma models as of 2026-06-18. Full schema at `prisma/schema.prisma`.

### Task
The core work unit. Every AI-assisted change starts as a Task.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| title | String | max 500 chars |
| instruction | String | max 50,000 chars |
| agentTool | String | claude-code, openClaw, codex, etc. |
| riskLevel | Enum | LOW / MEDIUM / HIGH / CRITICAL |
| environment | Enum | LOCAL / DEV / STAGING / PRODUCTION |
| approvalRequired | Boolean | Whether human gate is required |
| status | Enum | pending / running / completed / failed |
| projectId | String | FK to Project |
| sandboxPlan | String? | Optional sandbox execution plan |
| Relations | | AgentRun[], Approval?, Instruction[], OperatorSession[], AuditLog[], Comment[] |

### AgentRun
Records one execution of an AI agent against a Task.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| taskId | String | FK to Task |
| generatedPrompt | String | What was sent to the agent |
| selectedTool | String | Which agent tool was used |
| response | String? | Pasted agent response |
| filesChanged | String? | Files reported by agent |
| commandsRun | String? | Commands reported by agent |
| testResult | String? | Test output reported by agent |
| commitHash | String? | Commit SHA reported by agent |
| status | Enum | pending / running / completed / failed |
| githubPRId | String? | FK to GithubPR (manual link) |
| Evaluations | | Evaluation[] |

### GithubPR
An imported GitHub Pull Request with classification.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| projectId | String | FK to Project |
| owner | String | GitHub repo owner |
| repo | String | GitHub repo name |
| prNumber | Int | GitHub PR number |
| title | String | |
| body | String? | |
| state | String | open / closed / merged |
| mergedAt | DateTime? | |
| ciStatus | String? | success / failure / pending / null |
| classification | String? | feature / bug_fix / security / migration / etc. |
| classificationSource | String? | auto_title / auto_label / auto_files / manual |
| bugState | String? | known_issue / fixed / regression_risk / needs_retest |
| filesChanged | String[] | List of changed file paths |
| labels | String[] | GitHub PR labels |
| importedAt | DateTime | When first imported |
| lastSyncedAt | DateTime | Last sync from GitHub API |
| taskId | String? | FK to Task (manual link) |

### PrSyncState
Tracks incremental sync state per project to enable efficient delta imports.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| projectId | String | FK to Project (unique) |
| lastSyncedAt | DateTime? | Timestamp of last successful sync |
| fullSyncDone | Boolean | Whether a full history import has been run |
| lastError | String? | Last sync error message, if any |

### Incident
A production or DEV incident linked to a project.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| projectId | String | FK to Project |
| title | String | |
| severity | String | low / medium / high / critical |
| status | String | open / investigating / resolved |
| resolvedAt | DateTime? | |
| summary | String? | |
| relatedPRIds | String[] | GithubPR IDs involved |
| createdAt | DateTime | |

### AuditLog
Immutable event log. No update or delete endpoints exist.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| event | String | Namespaced event type, e.g., `instruction_status_changed` |
| details | Json | Structured event payload |
| taskId | String? | FK to Task |
| instructionId | String? | FK to Instruction |
| userId | String? | FK to User (set when session available) |
| createdAt | DateTime | |

### Other notable models
- **Project** — repoOwner, repoName, defaultBranch, devBranch, devServerUrl, healthEndpoint, autonomyLevel, GitHub PAT reference
- **Instruction** — 6-state lifecycle with SHA256 stateVersion for optimistic concurrency
- **OperatorSession** — riskFlags, missingEvidence, recommendedAction, nextPrompt, seniorApprovalRequired
- **Approval** — tri-state (null / true / false), concurrent-safe write
- **ExecutionTrace** — append-only governance evidence, no update/delete
- **Organization, Membership** — multi-org schema exists; UI partial
- **ApiKey** — SHA-256 hashed, scoped permissions
- **Webhook** — outgoing HMAC-signed delivery
- **CiRun** — CI run records per project
- **Diagram** — Mermaid source + SVG export storage
- **ShareLink** — token-based public report sharing
- **AgentRole** — 7 built-in governance role definitions

---

## 4. API Surface

All routes are under `/api/`. Auth is required for all mutation endpoints. `GOVERNANCE_API_KEY` middleware is also checked when set.

### Task Management
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/tasks | List tasks |
| POST | /api/tasks | Create task |
| GET | /api/tasks/[id] | Get task detail |
| PATCH | /api/tasks/[id] | Update task |
| POST | /api/tasks/[id]/clone | Clone task |
| GET | /api/tasks/[id]/pdf | Export task as PDF |
| POST | /api/tasks/[id]/orchestrate | Trigger agent orchestration |
| GET/POST | /api/tasks/[id]/comments | List / create comments |
| PATCH/DELETE | /api/tasks/[id]/comments/[commentId] | Update / delete comment |
| POST | /api/tasks/bulk | Bulk task operations |
| GET | /api/tasks/export | Export tasks as CSV |

### Agent Runs
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/agent-runs | List agent runs |
| POST | /api/agent-runs | Create agent run + evaluate |
| GET | /api/agent-runs/[id] | Get run detail |
| PATCH | /api/agent-runs/[id] | Update run |
| POST | /api/agent-runs/[id]/approve | Approve run |
| POST | /api/agent-runs/[id]/run | Dispatch run |
| POST | /api/agent-runs/evaluate | Re-evaluate a run |
| GET | /api/agent-runs/export | Export runs |

### GitHub PRs
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/github-prs | List PRs (requires projectId param) |
| POST | /api/github-prs | Import PR by URL or owner/repo/number |
| GET | /api/github-prs/[id] | Get PR detail |
| PATCH | /api/github-prs/[id] | Update PR (manual classification, task link) |
| POST | /api/github-prs/[id]/refresh | Re-fetch PR from GitHub |
| GET | /api/github-prs/memory | PR memory search |
| POST | /api/github-prs/sync | Incremental or full sync for a project |

### Projects
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/projects | List projects |
| POST | /api/projects | Create project |
| GET | /api/projects/[id] | Get project with config |
| PATCH | /api/projects/[id] | Update project |
| GET | /api/projects/[id]/intelligence | Repository intelligence aggregate |
| GET | /api/projects/[id]/governance-timeline | Unified governance timeline |
| GET | /api/projects/[id]/milestones | List milestones |
| POST | /api/projects/[id]/milestones | Create milestone |
| PATCH | /api/projects/[id]/milestones/[milestoneId] | Update milestone |
| POST | /api/projects/[id]/discover-prs | Discover PRs for project |

### Instructions & Approvals
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/instructions | List instructions |
| POST | /api/instructions | Create instruction |
| GET | /api/instructions/[id] | Get instruction |
| PATCH | /api/instructions/[id] | Transition instruction status |
| GET | /api/instructions/[id]/stale | Check stale state |
| POST | /api/approvals | Record approval decision |

### Operator Sessions
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/operator-sessions | Create session + risk analysis |
| GET | /api/operator-sessions | List sessions (by taskId) |
| PATCH | /api/operator-sessions/[id] | Update session |

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/auth/github | Initiate GitHub OAuth |
| GET | /api/auth/github/callback | OAuth callback |
| POST | /api/auth/login | Email/password login |
| POST | /api/auth/logout | Clear session |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/register | Register new user |
| GET | /api/auth/csrf | CSRF token |

### Platform
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Health check — returns `{"status":"ok"}` |
| GET | /api/audit | List audit events |
| GET | /api/audit/export | Export audit log as CSV |
| GET | /api/events | SSE stream for real-time events |
| GET | /api/traces | List execution traces |
| GET | /api/traces/[id] | Get trace detail |
| GET | /api/traces/export | Export traces |
| GET | /api/search | Cross-entity search |
| GET/POST | /api/keys | List / create API keys |
| DELETE | /api/keys/[id] | Revoke API key |
| GET/POST | /api/webhooks | List / create webhook configs |
| PATCH/DELETE | /api/webhooks/[id] | Update / delete webhook |
| GET/POST | /api/share-links | List / create share links |
| GET | /api/share-links/[id] | Resolve share link |
| GET/POST | /api/diagrams | List / create diagrams |
| GET | /api/diagrams/[id] | Get diagram |
| GET | /api/diagrams/[id]/export | Export diagram as SVG |
| GET | /api/notifications | List notifications |
| GET/PATCH | /api/notifications/preferences | Get / update notification prefs |
| GET/POST | /api/orgs | List / create organizations |
| GET/PATCH | /api/orgs/[id] | Get / update org |
| GET/POST | /api/orgs/[id]/members | List / add members |
| GET/POST | /api/orgs/[id]/invites | List / create invites |
| DELETE | /api/orgs/[id]/invites/[inviteId] | Revoke invite |
| GET | /api/invite/[token] | Resolve invite token |
| POST | /api/invite/[token] | Accept invite |
| GET/POST | /api/users | List / manage users |
| GET | /api/ci/status | CI status aggregate |
| GET | /api/release-checks | List release checks |
| GET | /api/billing | Billing overview |
| GET | /api/billing/usage | Usage metrics |
| GET | /api/agent-roles | List agent role definitions |
| POST | /api/demo/reset | Reset demo data |

---

## 5. Security Model

### Authentication
- GitHub OAuth (primary): iron-session cookie, 7-day TTL
- Email/password (secondary): bcrypt-hashed, session cookie
- `GOVERNANCE_API_KEY`: environment variable guard on all `/api/*` routes; checked before session when set

### RBAC
- Roles: `admin`, `operator`, `viewer`
- `requireRole(user, role)` pure function — no database call on the hot path
- All mutation endpoints check role before operating
- Org-scoped queries enforce `orgId` filter on every database read involving org data

### Audit Logging
- `writeAudit(event, details, { taskId, instructionId, userId })` on every state transition
- `AuditLog` and `ExecutionTrace` have no update or delete endpoints in the API
- Immutability enforced at application layer (no `.update()` or `.delete()` ORM calls on these tables)
- `userId` populated from session when session is present

### Known Open Items
- No rate limiting on mutation endpoints (planned)
- `approverId` on Approval is self-reported in some paths (no identity verification)
- Physical immutability (PostgreSQL row-level security) not yet enforced at DB layer

---

## 6. Feature Flags

All feature flags are environment variables. Default is `false` (off) for all opt-in features. No remote config service.

| Flag | Default | Effect |
|------|---------|--------|
| `FEATURE_BILLING` | false | Enables billing UI and usage enforcement |
| `FEATURE_AGENT_LLM` | false | Enables live LLM calls via Anthropic SDK |
| `FEATURE_RAG_EMBED` | false | Enables pgvector RAG embedding pipeline |
| `FEATURE_SANDBOX_MODE` | false | Enables sandbox replay UI and plan approval |
| `FEATURE_REPO_MEMORY_LLM` | false | Enables LLM-powered PR summaries |
| `ORCHESTRATION_ENABLED` | false | Enables multi-agent orchestration flow |
| `NOTIFICATIONS_ENABLED` | false | Enables notification dispatch |
| `STRUCTURED_LOGGING` | false | Switches console logs to JSON format |

All flags are read at startup via `src/lib/featureFlags.ts`. Tests always use `false` defaults so no LLM keys are required to run the test suite.

---

## 7. External Integrations

### GitHub REST API v3 (only active external integration)
- Used by: `src/lib/githubClient.ts`
- Endpoints called: `GET /repos/{owner}/{repo}/pulls/{number}`, `GET /repos/{owner}/{repo}/pulls` (list)
- Auth: `GITHUB_TOKEN` from environment (personal access token or GitHub App token)
- Scope required: `repo` (read-only on private repos)
- Rate limits: 5,000 requests/hour authenticated; sync logic paginates with early-exit when no new changes
- No incoming webhooks from GitHub are implemented

### Planned (not started)
- GitLab API — no implementation
- Slack — no implementation
- Resend email — client installed, no production sending wired
- Razorpay — no implementation

---

## 8. Constraints

- **No automated migrations on deploy.** `prisma migrate deploy` is run manually by the operator following the dev-release runbook. Never auto-run on application startup.
- **No LLM calls by default.** `FEATURE_AGENT_LLM=false` means the test suite, CI, and default dev environment require no Anthropic API key.
- **No process manager assumed.** The application does not manage its own restart. The operator restarts the Next.js dev server or production process manually after deploys.
- **No S3 or external storage.** All data lives in PostgreSQL. No file attachments, no object storage.
- **Single database.** No read replicas, no sharding, no connection pooling middleware (PgBouncer) in the current deployment.
- **No background job runner.** All operations are synchronous within the API request lifecycle. Long-running syncs (full PR history import) block the request until complete.
