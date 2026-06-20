# Known Limitations — Coder by DevAscend

**Last updated:** 2026-06-19

This document is an honest account of what the system does not do, does not enforce, or does imperfectly as of the current release. It exists so that operators, integrators, and future contributors do not discover these gaps by surprise in production.

For planned mitigations, see ROADMAP.md (Phase 4 and Phase 5).

---

## Security Limitations

### AuditLog immutability is convention only

The `AuditLog` table is INSERT-only by application-layer convention (`src/lib/audit.ts` exposes no update or delete helpers). However, **no database-level constraint prevents UPDATE or DELETE** on audit rows. A user with direct database access, or a future code path that bypasses `src/lib/audit.ts`, can modify or delete audit records without detection.

Mitigation planned: PostgreSQL Row-Level Security (RLS) in Phase 5.

### Multi-org database isolation is application-layer only

Each organization's data is isolated by filtering queries on `organizationId` in the application layer. There is **no database-level isolation** between organizations (no separate schemas, no row-level security policies). A bug in query construction could expose one organization's data to another.

Mitigation planned: Database-level isolation enforcement in Phase 5.

### Rate limiting applies to mutation endpoints only

Rate limiting (`src/lib/rateLimiter.ts`) is applied to four POST endpoints:
- `POST /api/tasks`
- `POST /api/agent-runs`
- `POST /api/tasks/[id]/orchestrate`
- `POST /api/github-prs/sync`

**All GET (read) endpoints are unprotected by rate limiting.** A client can make unlimited read requests. This is an acceptable risk for the current team-tool usage pattern but is not suitable if public or untrusted clients gain access.

Mitigation planned: Rate limiting on all endpoints in Phase 5.

### In-memory rate limit buckets

Rate limit state is stored in process memory. **Server restarts reset all buckets.** A client that triggers a rate limit can bypass it by waiting for a restart (or by triggering a restart). This is not a distributed rate limit.

Mitigation planned: Redis-backed distributed rate limiting in Phase 5.

---

## Scalability Limitations

### No database connection pooling

The application uses a direct PostgreSQL connection via Prisma with no connection pooler. Under high concurrent load, the number of open connections may exceed PostgreSQL's `max_connections` limit, causing connection errors.

**Current safe range:** Low-to-moderate concurrent usage by a small team (fewer than ~20 simultaneous requests).

Mitigation path: PgBouncer in front of PostgreSQL, or Prisma Accelerate as the connection layer.

### Full PR sync blocks the HTTP request

`POST /api/github-prs/sync` with `fullSync: true` fetches all PRs from GitHub synchronously within a single HTTP request. For repositories with hundreds or thousands of PRs, this can run for 30–90 seconds and may hit server timeout limits.

The `PrSyncState` record provides polling-based progress tracking (`GET /api/github-prs/sync-status`), but the request itself is not offloaded to a background worker.

**Practical limit:** Repositories with fewer than ~500 PRs complete within acceptable time. Larger repositories are at risk of timeout.

Mitigation planned: Background job system in Phase 4.

### In-memory rate limit buckets reset on restart

Documented above under Security Limitations. Also a scalability limitation: in a multi-instance deployment, each instance maintains independent rate limit buckets. A client can make up to N × (per-instance limit) requests by distributing across N instances.

---

## Functional Gaps

### Auto-link PRs to tasks is not implemented

PRs cannot be automatically linked to tasks by branch name matching. The link between a `Task` and a `GithubPR` (via `AgentRun.agentRunId`) must be set manually via `PATCH /api/agent-runs/[id]`. This is a known friction point in the workflow.

Planned: Auto-link by branch name pattern in Phase 3 follow-up.

### Email notifications are wired but not dispatched

Notification preferences are stored per user (`/api/notifications/preferences`). The preference data model supports email, Slack, and in-app notification channels. However, **no email is actually sent** — the dispatch layer is not implemented. Preferences are stored but produce no outgoing messages.

Planned: Email dispatch implementation in Phase 4.

### Langfuse integration is stubbed

LLM observability via Langfuse is wired in the codebase but falls back to `console.log` output when `LANGFUSE_SECRET_KEY` is not set. No traces, spans, or scores are sent to Langfuse in the current deployment. The stub exists so the integration point is defined and can be activated without code changes.

### open-swe agent is non-functional

`open-swe` is listed as an agent option in the task creation UI. Selecting it does not dispatch a real agent — it is a UI stub. The agent dispatch mechanism (`FEATURE_AGENT_LLM=false`) is gated and non-functional until Phase 4.

### LLM PR summaries are disabled

`FEATURE_REPO_MEMORY_LLM` defaults to `false`. PR summaries are classification labels and metadata only — no LLM-generated natural language summary is produced. Enabling this flag requires an LLM API key and the feature has not been end-to-end tested in the current codebase.

---

## Operational Gaps

### No staging environment

There is one DEV deployment. There is no staging environment that mirrors production configuration. Changes are developed on DEV and then reviewed before production deployment. This increases the risk that environment-specific issues are found only in production.

Planned: Staging environment definition in Phase 5.

### Smoke tests are manual

No automated smoke test suite is wired to CI. After each deployment, smoke tests (verifying that the app starts, the login flow works, and key API routes respond) are run manually. There is no automated gate that prevents a broken build from being deployed.

Planned: Automated smoke tests in Phase 5 CI pipeline.

### No automated rollback procedure

There is no documented or scripted rollback procedure for a failed deployment. Rollback currently requires manual intervention (re-deploying the previous build artifact and, if a migration ran, manually reverting the database).

Planned: Rollback procedure documentation and tooling in Phase 5.

### No distributed rate limiting

Documented above under Security and Scalability. Rate limit state does not survive restarts and does not coordinate across multiple instances.

---

## Out of Scope

These items are **not planned** for any current phase. They are listed here to set expectations clearly.

### Multi-tenant SaaS with per-tenant database isolation

The system uses a shared PostgreSQL database with application-layer `organizationId` filtering. Separate databases per tenant (for true isolation) are not planned. The product is designed as a self-hosted team tool, not a public multi-tenant SaaS.

### Production deployment gate

A formal production deployment gate (requiring a complete evidence chain, policy sign-off, and a senior approval before any production push) is Phase 5 scope. **It is not active in the current system.** The `sandboxMode` feature flag that would enable the `SANDBOX` decision code and production replay is `false` and will remain so until Phase 5 security review is complete.

### GitHub incoming webhooks

Real-time PR sync via GitHub push/PR webhooks (HMAC-verified receiver) is not implemented. PR data is only updated when a manual sync is triggered (`POST /api/github-prs/sync`). This was planned for Phase 3 but is deferred to Phase 3 follow-up.

### GitLab, Bitbucket, or other VCS integrations

Only GitHub is supported. No integration with GitLab, Bitbucket, Azure DevOps, or any other version control system is planned.

### Mobile application

No mobile app, no responsive-first mobile UI. The tool is designed for desktop browser usage by engineering teams.
