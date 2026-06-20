# Architecture — Coder by DevAscend

**Last updated:** 2026-06-19

---

## System Overview

Coder by DevAscend is an AI Dev Orchestrator built on **Next.js 14 App Router**. It helps engineering teams govern AI-assisted software development by providing decision pipelines, PR intelligence, audit trails, and role-based approval workflows.

**Technology stack:**

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (TypeScript strict) |
| Database ORM | Prisma 5 |
| Database | PostgreSQL |
| Authentication | GitHub OAuth + iron-session (HttpOnly cookie) |
| Test runner | node:test (native Node.js) |
| Styling | Tailwind CSS |

---

## Data Flow

```
Browser
  └── Next.js App Router (server components default)
        ├── Server Components → Prisma → PostgreSQL  (data fetch at render)
        └── API Routes (Route Handlers) → Prisma → PostgreSQL  (REST mutations)
```

- **Server components** are the default rendering strategy. Data is fetched server-side at request time — no client-side fetch waterfalls for read paths.
- **Client components** (`'use client'`) are used only where browser interactivity is required (forms, live-progress indicators, SSE consumers).
- **Route Handlers** (`src/app/api/**`) expose REST endpoints consumed by both the browser and external integrations.

---

## Authentication Flow

```
User clicks "Sign in with GitHub"
  └── GET /api/auth/github  →  GitHub OAuth authorization URL
        └── GitHub redirects to /api/auth/github/callback
              └── Exchange code for access token
                    └── Fetch GitHub user profile
                          └── Upsert User record in PostgreSQL
                                └── Persist session via iron-session (HttpOnly cookie)
                                      └── Subsequent requests: session verified server-side
```

**iron-session** stores the authenticated user ID in an encrypted, HttpOnly cookie. No token is exposed to JavaScript. Session destruction (logout) is immediate and server-controlled — unlike JWT, there is no token that can remain valid after logout.

**RBAC** is enforced via `requireRole()` in `src/lib/rbac.ts`. Roles include `ADMIN`, `SENIOR`, and `AGENT`. Protected API routes and server components call `requireRole()` to gate access before any data operation.

---

## Core Decision Pipeline

Every agent run passes through a five-stage pipeline:

```
Task (context + environment config)
  └── promptBuilder (src/lib/promptBuilder.ts)
        └── 8-section structured prompt
              └── agentRun (operator pastes output; stored in AgentRun)
                    └── riskAnalyzer (src/lib/riskAnalyzer.ts)
                          └── 7 risk flags + negation stripping
                                └── decisionEngine (src/lib/decisionEngine.ts)
                                      └── One of 5 decision codes
```

**Decision codes:**

| Code | Meaning |
|------|---------|
| `CONTINUE` | Low risk — agent may proceed |
| `RUN_VALIDATION` | Medium risk — run automated checks first |
| `SENIOR_APPROVAL_REQUIRED` | High risk — human senior review required before proceeding |
| `BLOCKED` | Policy violation — execution stopped |
| `SANDBOX` | Requires isolated sandbox replay before any production action |

The `SANDBOX` decision code is gated behind the `sandboxMode` feature flag (see Feature Flags section). It remains `false` until Phase 5.

---

## Key Models and Relationships

```
Organization
  └── User (role: ADMIN | SENIOR | AGENT)
  └── Project (repoOwner, repoName, branch, PAT)
        ├── Task (status, riskLevel, environment config)
        │     ├── AgentRun (prompt, output, decision code, riskFlags)
        │     │     └── GithubPR (agentRunId FK — links PR to the run that produced it)
        │     ├── Approval (atomic gate — one approver, one outcome)
        │     └── Instruction (6-state lifecycle: DRAFT → APPROVED → EXECUTING → DONE | BLOCKED | REJECTED)
        ├── GithubPR (prNumber, type, bugState, classifiedAt)
        │     └── PrSyncState (fullSyncStartedAt, fullSyncCompletedAt, progress tracking)
        └── AuditLog (userId, action, entityType, entityId, createdAt — INSERT-only)
```

**Key relationship notes:**

- `GithubPR.agentRunId` is a nullable FK — set when a PR can be attributed to a specific agent run. Not all PRs are agent-produced.
- `AuditLog` is INSERT-only by convention. No `UPDATE` or `DELETE` operations are performed on this table. See KNOWN_LIMITATIONS.md for the caveat on DB-level enforcement.
- `Instruction` uses `SHA256 stateVersion` for optimistic concurrency — concurrent state transitions are detected and rejected before write.
- `Approval` is atomic: only one approval record can be finalized per instruction (enforced via unique constraint + transaction).

---

## API Design

All API endpoints follow these conventions:

| Convention | Detail |
|------------|--------|
| Protocol | REST over HTTPS |
| Payload format | JSON (request and response) |
| Authentication | iron-session cookie (browser) or SHA-256 API key (programmatic) |
| Webhook delivery | HMAC-SHA256 signed payloads (secret per webhook endpoint) |
| Pagination | Cursor-based (`cursor` + `limit` query params) — no offset pagination |
| Error shape | `{ error: string }` with appropriate HTTP status code |

**API key hashing:** API keys are generated as random bytes and stored as SHA-256 hashes. The plaintext is shown once at creation and never stored.

**HMAC webhooks:** Outgoing webhook payloads include an `X-Webhook-Signature` header. Recipients verify the HMAC-SHA256 signature using the shared secret stored per webhook endpoint.

---

## PR Intelligence Pipeline

```
GitHub REST API (per project PAT)
  └── POST /api/github-prs/sync  (or fullSync: true for full history)
        └── Fetch PR list + metadata from GitHub
              └── prClassifier (src/lib/prClassifier.ts)
                    └── Deterministic rule engine — 10 PR types
                          ├── feature | bugfix | refactor | test | docs
                          ├── chore | security | performance | revert | ci
                          └── bugState: INTRODUCED | FIXED | REGRESSED | CLEAN
                                └── Store/upsert GithubPR records
                                      └── PrSyncState updated (progress tracking)
```

**Classification is deterministic** — no LLM is used. Rules are based on PR title patterns, labels, and changed file paths. This ensures zero API cost, predictable results, and full testability. See ADR-001 in DECISIONS.md.

**PrSyncState** tracks full-sync progress: `totalCount`, `importedCount`, `status` (`IDLE | IN_PROGRESS | COMPLETE | FAILED`). The sync progress endpoint (`GET /api/github-prs/sync-status`) polls this record so the UI can show live progress without websockets.

---

## Security Layers

| Layer | Implementation |
|-------|---------------|
| Session auth | iron-session HttpOnly cookie — no JS access to session token |
| RBAC | `requireRole()` in `src/lib/rbac.ts` — checked at route and component level |
| Rate limiting | `src/lib/rateLimiter.ts` — token bucket, applied to mutation endpoints |
| CSRF | Next.js built-in protections + SameSite cookie attribute |
| Webhook verification | HMAC-SHA256 — receivers must verify `X-Webhook-Signature` |
| API key storage | SHA-256 hash only — plaintext never persisted |
| Input validation | Length guards on all freetext fields; Zod schemas on structured inputs |

**Rate limiting scope (current):** Applied to POST `/api/tasks`, POST `/api/agent-runs`, POST `/api/tasks/[id]/orchestrate`, and POST `/api/github-prs/sync`. Read endpoints are not rate-limited. See KNOWN_LIMITATIONS.md.

---

## Feature Flags

Feature flags are defined in `src/lib/featureFlags.ts` and read from environment variables at runtime. All flags default to `false` — the application runs fully without any LLM or external AI service keys.

| Flag | Default | Controls |
|------|---------|---------|
| `FEATURE_AGENT_LLM` | `false` | Real LLM calls for agent suggestions |
| `FEATURE_REPO_MEMORY_LLM` | `false` | LLM-generated PR summaries |
| `sandboxMode` | `false` | SANDBOX decision code activation (Phase 5 only) |

`sandboxMode` will remain `false` until Phase 5 security review is complete. Enabling it prematurely allows the `SANDBOX` decision code to route runs to an isolated replay environment that does not yet have production-grade isolation.

---

## Known Architectural Limitations

These are documented here for transparency. See KNOWN_LIMITATIONS.md for the full list.

- **No connection pooling:** The app uses a direct PostgreSQL connection via Prisma. Under high concurrent load, connection limits may be reached. PgBouncer or Prisma Accelerate is the mitigation path.
- **No background job system:** Full PR sync runs synchronously within the HTTP request. Large repositories (thousands of PRs) may hit server timeouts. Background job processing is planned for Phase 4.
- **In-memory rate limit buckets:** Rate limit state is held in process memory. Server restarts reset all buckets. Distributed rate limiting (e.g., Redis-backed) is planned for Phase 5.
