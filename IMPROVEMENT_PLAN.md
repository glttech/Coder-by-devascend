# Coder by DevAscend — IMPROVEMENT_PLAN.md

> Engineering roadmap to take **Coder by DevAscend** from a single-operator AI governance MVP to an industry-grade, multi-tenant AI task orchestration and governance SaaS.

**Tech stack (fixed):** Next.js 14 App Router · TypeScript · Prisma 5 · PostgreSQL · iron-session v8 · React 18 · custom CSS variables (no Tailwind).

**Working branch:** `claude/setup-coder-repo-XFuyw`. Every PR below branches from the previous merged state of this branch and is merged to `main` sequentially. PRs are ordered so that schema, lib, API, and UI layers are introduced bottom-up and never conflict on the same files in flight.

---

## 1. Guiding principles

1. **Bottom-up per PR.** Each PR lands its Prisma migration first, then `src/lib` logic, then `src/app/api` routes, then UI. This keeps a PR self-contained and reviewable.
2. **Additive schema only.** New columns are nullable or defaulted; no destructive migrations until a feature is fully cut over. Multi-tenancy (`orgId`) is introduced once (PR 2) and backfilled, never retro-fitted twice.
3. **Feature-flag everything risky.** Extend `src/lib/featureFlags.ts` rather than scattering `process.env` checks. New flags ship `false` by default.
4. **Reuse existing primitives.** `src/lib/audit.ts`, `authGuard.ts`, `rbac.ts`, `csrf.ts`, `rateLimiter.ts`, `prisma.ts`, `notifications.ts`, and `src/components/ui/*` are extended, not duplicated.
5. **Server-first.** Persistence stays DB-backed. `localStorage` is used *only* for ephemeral UI state (drafts, panel state, theme, recent searches) and is never the source of truth for governance data.
6. **No PII/secret leakage.** Audit trail and structured logs redact secrets; tokens are stored hashed; signed URLs are short-lived.

---

## 2. Phasing & prioritization

Impact/effort matrix drives ordering. P0 = unblocks the SaaS thesis (multi-tenant, billing-ready, secure). P1 = core differentiator (diagrams, real-time, collaboration). P2 = polish/scale.

| Phase | Theme | PRs | Outcome |
|-------|-------|-----|---------|
| **0 — Hardening** | Observability, perf baseline | 1 | Health, structured logs, pagination foundation before traffic grows |
| **1 — Foundation (multi-tenant)** | Orgs, multi-user auth, OAuth, API keys | 2–6 | Real signup/teams; SaaS-shaped tenancy & access |
| **2 — Collaboration** | Comments, real-time SSE, email, search, bulk ops | 7–12 | Teams actually work together in-product |
| **3 — Visualization & sharing** | Mermaid diagrams, persistence, signed URLs, public links, exports | 13–17 | The "save my diagrams" ask + shareable governance artifacts |
| **4 — Automation & integration** | Webhooks, CI/CD dashboard, dashboard widgets | 18–20 | Closes the loop with external tooling |
| **5 — Experience & scale** | Theme persistence, mobile, accessibility, billing | 21–24 | Production UX, monetization, compliance |

**Effort legend:** S ≤ 1 day · M ≤ 3 days · L ≤ 1 week · XL > 1 week.

---

## 3. Cross-cutting schema additions introduced early

To avoid repeated migrations, three models/columns are introduced once and reused:

- **`Organization`** (PR 2) — tenant boundary. Every top-level model (`Project`, `Task`, `User` membership, `ApiKey`, `Webhook`, `Diagram`) carries `orgId`.
- **`Membership`** (PR 2) — `User`↔`Organization` join with per-org `role`.
- **`featureFlags.ts`** — extended each phase with the new flags listed per PR.

---

# Phase 0 — Hardening

## PR 1 — Observability & pagination foundation
**Priority:** P0
**Effort:** M
**Depends on:** none
### What
Structured JSON logging, a `/api/health` endpoint, central error tracking hook, and a reusable cursor-pagination helper applied to the three heaviest list routes (`tasks`, `agent-runs`, `audit`).
### Why
Everything after this scales traffic and data. We need to see failures and not load unbounded lists before adding orgs and real users.
### Files to create/modify
- Create `src/lib/logger.ts` — `log.info/warn/error(event, fields)` emitting single-line JSON (`ts`, `level`, `event`, `requestId`, redacted fields). Wrap `console`.
- Create `src/lib/requestContext.ts` — generates/propagates `x-request-id`; read in `src/middleware.ts`.
- Create `src/lib/pagination.ts` — `parsePageParams(searchParams)` → `{ take, cursor, order }`; `buildPageResult(rows, take)` → `{ items, nextCursor }`.
- Create `src/lib/errorTracking.ts` — thin `captureException(err, ctx)`; no-op unless `SENTRY_DSN`/`ERROR_TRACKING_DSN` set (provider-agnostic shim).
- Create `src/app/api/health/route.ts` — returns `{ status, db: <prisma $queryRaw 'SELECT 1'>, version, uptime }`; 200/503.
- Modify `src/app/global-error.tsx` and `src/app/**/error.tsx` to call `captureException`.
- Modify `src/app/api/tasks/route.ts`, `src/app/api/agent-runs/route.ts`, `src/app/api/audit/route.ts` (and `src/app/audit/page.tsx`, `src/app/tasks/page.tsx`, `src/app/agent-runs/page.tsx`) to use `pagination.ts` with a "Load more"/page control.
- Modify `src/middleware.ts` — attach request id; log method/path/status/latency.
- Extend `src/lib/featureFlags.ts`: `structuredLoggingEnabled` (default true).
### DB changes
None. (Add index review only — see indexes added in later PRs alongside their queries.)
### Security
- Logger redaction list: `password`, `passwordHash`, `token`, `secret`, `cookie`, `authorization`, `SESSION_SECRET`. `/api/health` exposes no secrets and no row counts.
- Rate-limit `/api/health` via existing `rateLimiter.ts` to avoid DB ping abuse.
### Acceptance criteria
- `GET /api/health` returns 200 with DB ok, 503 when DB unreachable.
- All three list endpoints return `{ items, nextCursor }` and accept `?cursor=&limit=`; default limit 25, max 100.
- Logs are valid one-line JSON; a deliberate thrown error appears in `captureException` and is not duplicated to the user with stack traces.
- `npm run typecheck` and `npm run test` pass.

---

# Phase 1 — Foundation (multi-tenant)

## PR 2 — Organizations & membership (tenancy core)
**Priority:** P0
**Effort:** XL
**Depends on:** PR 1
### What
Introduce `Organization` and `Membership`. Backfill a single default org and attach all existing `Project`/`Task`/`User` rows to it. Add `orgId` to the session and a tenant-scoping helper used by every data access path.
### Why
Single-user is the core blocker to SaaS. Tenancy must exist before signup, invites, billing, and API keys — and must be retrofitted exactly once.
### Files to create/modify
- Create `src/lib/orgScope.ts` — `requireOrg(session)` and `scoped(orgId)` query helpers (`where: { orgId }`). All list/read routes route through this.
- Modify `src/lib/session.ts` — add `orgId: string` and `activeOrgId` to `AppSession`; keep optional for legacy cookies (forces re-login otherwise).
- Modify `src/lib/authGuard.ts` / `rbac.ts` — resolve role from `Membership` for the active org rather than env var.
- Modify `prisma/schema.prisma` — add models below; add `orgId String` to `Project`, `Task` (denormalized for query speed), `PromptTemplate`, `AgentProvider`.
- Create migration `add_organization_and_membership`.
- Create `prisma/migrations/<ts>_backfill_default_org` data step (or `prisma/seed-org-backfill.ts`) creating `org_default` and setting all existing FKs.
- Modify all `src/app/api/**` read/write routes to filter by `orgId`.
- Create `src/app/api/orgs/route.ts`, `src/app/api/orgs/[id]/route.ts`, `src/app/api/orgs/[id]/members/route.ts`.
- Create `src/app/settings/team/page.tsx` (members list, role chips).
- Create `src/components/OrgSwitcher.tsx` in `AppShell.tsx`.
### DB changes
```prisma
model Organization {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  plan      String       @default("free") // free | pro | enterprise
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  memberships Membership[]
  projects   Project[]
}
model Membership {
  id        String   @id @default(uuid())
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  role      String   @default("reviewer") // owner | admin | reviewer | viewer
  createdAt DateTime @default(now())
  @@unique([orgId, userId])
  @@index([userId])
}
```
Add `orgId String` + `@@index([orgId])` to `Project`, `Task`, `PromptTemplate`, `AgentProvider`. Extend `User.role` semantics to be per-membership (keep column for legacy until PR 3).
### Security
- Every query must be org-scoped; add a test that asserts no list route returns cross-org rows.
- Role hierarchy `owner > admin > reviewer > viewer` enforced in `rbac.ts`; viewer is read-only.
- Session `activeOrgId` validated against `Membership` on each request (prevents org-switch tampering).
### Acceptance criteria
- Existing data is visible under the default org after backfill; no orphan rows (`orgId` non-null everywhere).
- A user in two orgs sees only the active org's data; switching org changes the dataset.
- A cross-org ID in any `/api/...` path returns 404 (not 403, to avoid existence leak).

## PR 3 — Multi-user registration & password auth
**Priority:** P0
**Effort:** L
**Depends on:** PR 2
### What
Real signup creating a `User` + a new `Organization` (owner membership), plus password storage in DB (replacing the env-var admin). Login resolves user by email from DB.
### Why
Removes the hardcoded single admin; enables genuine multi-user onboarding.
### Files to create/modify
- Modify `prisma/schema.prisma` — add `passwordHash String?` and `emailVerifiedAt DateTime?` to `User`. Migration `add_user_credentials`.
- Create `src/app/api/auth/register/route.ts` — validate email/password, bcrypt hash (cost 12), create `User`+`Organization`+`Membership(owner)`, issue session.
- Modify `src/app/api/auth/login/route.ts` — look up `User` by email, compare `passwordHash`; keep env-admin path behind `getAuthMode()` for backward compat / first-boot bootstrap.
- Create `src/app/register/page.tsx` + `src/components/RegisterForm.tsx`.
- Modify `src/lib/loginRateLimit.ts` — apply to register too; per-email and per-IP buckets.
- Modify `prisma/seed-admin.ts` — seed first org owner instead of env-only admin.
### DB changes
`User.passwordHash`, `User.emailVerifiedAt` (nullable). No data loss.
### Security
- Password policy: min 12 chars, zxcvbn-style server check (lightweight, no new heavy dep — length + common-password denylist).
- Uniform timing on login failure; never reveal whether email exists.
- CSRF on register/login via existing `csrf.ts`. Rate limit both.
- bcrypt cost ≥ 12; never log password fields.
### Acceptance criteria
- New user can register, lands in their own org as owner.
- Existing env-admin still logs in until migrated.
- Duplicate email returns generic 409; brute force is throttled.

## PR 4 — Invite flow & team management
**Priority:** P0
**Effort:** L
**Depends on:** PR 3, PR 11 (email) is optional — invites work via link, email send is wired when PR 11 lands
### What
Org owners/admins invite users by email with a role; invitee accepts via signed token link, creating/attaching their `User` and a `Membership`.
### Why
Teams are the unit of a SaaS; invites are the growth loop.
### Files to create/modify
- Modify `prisma/schema.prisma` — `Invitation` model. Migration `add_invitation`.
- Create `src/lib/invites.ts` — `createInvite`, `verifyInviteToken` (HMAC of id+expiry using `SESSION_SECRET`), `acceptInvite`.
- Create `src/app/api/orgs/[id]/invites/route.ts` (POST create, GET list) and `.../invites/[inviteId]/route.ts` (DELETE revoke).
- Create `src/app/invite/[token]/page.tsx` — accept screen (register if new, attach if existing).
- Modify `src/app/settings/team/page.tsx` — pending invites + role change + remove member.
- Modify `src/components/SidebarNav.tsx` — Team settings entry for admins.
### DB changes
```prisma
model Invitation {
  id        String   @id @default(uuid())
  orgId     String
  email     String
  role      String   @default("reviewer")
  token     String   @unique // hashed
  invitedBy String
  status    String   @default("pending") // pending | accepted | revoked | expired
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([orgId])
  @@index([email])
}
```
### Security
- Token stored hashed (SHA-256) like sessions; raw token only in the emailed/link URL.
- Invites expire (default 7 days); single-use (`status` flips on accept).
- Only `owner`/`admin` can invite; cannot grant a role above their own.
### Acceptance criteria
- Invite link creates exactly one membership; reuse/expiry/revoke all rejected.
- Role downgrade/removal takes effect immediately (active sessions re-evaluated via `Membership`).

## PR 5 — OAuth SSO (GitHub & Google)
**Priority:** P1
**Effort:** L
**Depends on:** PR 3
### What
OAuth login/linking for GitHub and Google. New users get an org; existing users link providers to their account.
### Why
Reduces signup friction; GitHub OAuth also unlocks scoped repo access used by Projects/PR sync.
### Files to create/modify
- Create `src/lib/oauth/github.ts`, `src/lib/oauth/google.ts` — authorize URL, token exchange, profile fetch (no SDK; use `fetch`/existing `retryFetch.ts`).
- Create `src/app/api/auth/oauth/[provider]/route.ts` (start) and `.../[provider]/callback/route.ts`.
- Modify `prisma/schema.prisma` — `OAuthAccount` model. Migration `add_oauth_account`.
- Modify `src/app/login/page.tsx` + `src/app/register/page.tsx` — provider buttons.
- Create `src/app/settings/account/page.tsx` — linked accounts management.
### DB changes
```prisma
model OAuthAccount {
  id             String   @id @default(uuid())
  userId         String
  provider       String   // github | google
  providerUserId String
  accessToken    String?  // encrypted at rest
  refreshToken   String?
  scope          String?
  createdAt      DateTime @default(now())
  @@unique([provider, providerUserId])
  @@index([userId])
}
```
### Security
- `state` param (CSRF) signed + stored in a short-lived cookie; PKCE for Google.
- Tokens encrypted at rest (AES-GCM via `OAUTH_ENC_KEY`), never logged, redacted in audit.
- Email-collision policy: if email matches an existing local account, require login-then-link (no silent account takeover).
- GitHub token scope limited to `read:user`/`repo` only when repo features used.
### Acceptance criteria
- New GitHub/Google login creates user+org; second login on same provider reuses account.
- Linking from settings attaches provider without creating a duplicate user.
- Revoking a link removes stored tokens.

## PR 6 — API key management (programmatic access)
**Priority:** P1
**Effort:** M
**Depends on:** PR 2
### What
Org-scoped API keys for programmatic access to a read/write subset of the API. Keys are hashed, prefixed, scoped, and rate-limited.
### Why
Enables CI pipelines and external automation to create tasks / fetch evidence without a browser session — foundational for the "orchestration platform" thesis.
### Files to create/modify
- Modify `prisma/schema.prisma` — `ApiKey` model. Migration `add_api_key`.
- Create `src/lib/apiKeys.ts` — `generateKey()` → `cda_<orgslug>_<random>`, store `sha256(key)`; `authenticateApiKey(req)`.
- Modify `src/lib/authGuard.ts` — accept `Authorization: Bearer cda_...` as an alternate principal (resolves org + scopes; no CSRF needed for bearer, enforce per-key rate limit).
- Create `src/app/api/keys/route.ts` (create/list) and `.../keys/[id]/route.ts` (revoke).
- Create `src/app/settings/api-keys/page.tsx` (show raw key once on create).
- Modify `src/lib/rateLimiter.ts` — per-key bucket keyed by key id.
### DB changes
```prisma
model ApiKey {
  id         String    @id @default(uuid())
  orgId      String
  name       String
  prefix     String    // first 12 chars, shown in UI
  hashedKey  String    @unique
  scopes     String[]  @default([]) // tasks:read tasks:write evidence:read ...
  createdBy  String
  lastUsedAt DateTime?
  expiresAt  DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  @@index([orgId])
}
```
### Security
- Raw key shown exactly once; only `prefix` retrievable afterward.
- Scope checks enforced per route; default deny.
- Revoked/expired keys rejected; `lastUsedAt` updated async.
- Bearer-authenticated requests bypass cookie-CSRF but are subject to scope + rate limit + audit.
### Acceptance criteria
- `curl -H 'Authorization: Bearer cda_...' /api/tasks` works within scope and is org-scoped.
- Out-of-scope call returns 403; revoked key returns 401.
- Key value is not recoverable from the DB after creation.

---

# Phase 2 — Collaboration

## PR 7 — Global search
**Priority:** P1
**Effort:** M
**Depends on:** PR 2
### What
Org-scoped global search across Tasks, Projects, Milestones, Instructions, AgentRuns, GithubPRs with type filters and keyboard shortcut.
### Why
With multi-user data volume, navigation by browsing breaks down.
### Files to create/modify
- Create `src/lib/search.ts` — Postgres full-text (`to_tsvector`) over title/instruction/body fields, ranked, org-scoped.
- Create migration `add_search_indexes` — GIN indexes / generated `tsvector` columns on searchable models.
- Create `src/app/api/search/route.ts` — `?q=&types=task,project&limit=`.
- Create `src/components/GlobalSearch.tsx` (Cmd/Ctrl-K palette) in `AppShell.tsx`; recent searches via localStorage (see PR 21 helper, or inline key `cda.recentSearches`).
### DB changes
Generated `searchVector tsvector` + `@@index` (GIN) on `Task`, `Project`, `Milestone`, `Instruction`, `GithubPR`. Backfill in migration.
### Security
- Results org-scoped and role-filtered (viewer sees only readable entities).
- `q` sanitized into `plainto_tsquery`; no raw SQL interpolation.
### Acceptance criteria
- Cmd-K opens palette; typing returns mixed-type ranked results < 300ms on seed data.
- No cross-org leakage; type filters work; recent searches persist locally.

## PR 8 — Task comments & collaboration
**Priority:** P1
**Effort:** M
**Depends on:** PR 2
### What
Threaded comments on Tasks (and AgentRuns) with @mentions that create notifications.
### Why
Governance is a team conversation; review decisions need discussion captured alongside the task.
### Files to create/modify
- Modify `prisma/schema.prisma` — `Comment` model. Migration `add_comment`.
- Create `src/lib/mentions.ts` — parse `@email`/`@name`, resolve to org members.
- Create `src/app/api/tasks/[id]/comments/route.ts` (+ `[commentId]` for edit/delete).
- Create `src/components/CommentThread.tsx`, `src/components/CommentComposer.tsx`.
- Modify `src/app/tasks/[id]/page.tsx` — comments section.
- Modify `src/lib/notifications.ts` — `mention` notification type; emit on mention.
- Modify `src/lib/audit.ts` — log comment create/delete.
### DB changes
```prisma
model Comment {
  id         String   @id @default(uuid())
  orgId      String
  taskId     String?
  agentRunId String?
  authorId   String
  body       String
  editedAt   DateTime?
  deletedAt  DateTime?
  createdAt  DateTime @default(now())
  @@index([taskId])
  @@index([agentRunId])
}
```
### Security
- Author or admin can edit/delete (soft delete via `deletedAt`).
- Body length limit; markdown rendered sanitized (escape HTML; no raw injection).
- Mentions restricted to org members.
### Acceptance criteria
- Comment appears in thread, oldest-first; mention generates a notification + (when PR 11 lands) email.
- Edit shows "edited"; delete tombstones the comment.

## PR 9 — Real-time updates via SSE
**Priority:** P1
**Effort:** L
**Depends on:** PR 8 (notifications surface), PR 2
### What
Server-Sent Events stream for live task status, agent-run completion, new comments, and notification badge — replacing manual refresh.
### Why
Long-running agent runs and approvals need to update without reload; differentiator vs. static dashboards.
### Files to create/modify
- Create `src/lib/events/bus.ts` — in-process pub/sub; `publish(orgId, event)` / `subscribe(orgId, cb)`. (Postgres `LISTEN/NOTIFY` adapter behind interface so it scales to multi-instance later.)
- Create `src/app/api/events/route.ts` — SSE endpoint (`text/event-stream`), org-scoped, keep-alive pings, auth-gated.
- Create `src/hooks/useEventStream.ts` — `EventSource` client with reconnect/backoff.
- Modify mutation routes (`tasks/[id]`, `agent-runs/[id]/run`, `comments`, `approvals`) to `publish` after commit.
- Modify `src/components/NotificationBell.tsx`, task/run pages to consume the stream and update in place.
### DB changes
None (LISTEN/NOTIFY uses Postgres directly; no schema change).
### Security
- SSE handler authenticates the session and binds the stream to `activeOrgId`; never forward another org's events.
- Heartbeat + max-connection guard per user; close on logout/session revoke.
### Acceptance criteria
- Starting an agent run updates its status live in a second browser tab without reload.
- New comment/notification appears within ~1s; connection auto-recovers after network drop.
- No event from org A reaches a client in org B.

## PR 10 — Bulk operations
**Priority:** P2
**Effort:** M
**Depends on:** PR 1 (pagination), PR 2
### What
Multi-select on Tasks/PRs/Instructions lists with bulk actions: assign, change status/priority, move to milestone, archive, delete.
### Why
Operators managing many tasks need batch throughput; one-by-one is the top friction at scale.
### Files to create/modify
- Create `src/app/api/tasks/bulk/route.ts` — `{ ids: string[], action, payload }`, transactional, org-scoped, per-id permission check.
- Create `src/components/BulkActionBar.tsx` and `src/hooks/useSelection.ts`.
- Modify `src/app/tasks/page.tsx`, `src/app/projects/[id]/prs/page.tsx`, `src/app/instructions/pending/page.tsx` — checkboxes + select-all.
- Modify `src/lib/audit.ts` — single grouped audit entry per bulk action with affected ids.
### DB changes
Optional `Task.archivedAt DateTime?` (+ migration `add_task_archive`) to support archive action.
### Security
- Server re-validates every id belongs to the active org and the user may act on it; partial-success response lists rejected ids.
- Hard caps (e.g. ≤ 200 ids/request) to prevent runaway transactions.
### Acceptance criteria
- Selecting N tasks and applying an action updates exactly those; rejected ids reported, not silently skipped.
- One audit entry records actor, action, and affected ids.

## PR 11 — Email notifications
**Priority:** P1
**Effort:** M
**Depends on:** PR 3
### What
Transactional email for: invite, task assigned, approval needed, run completed/failed, mention. Provider-agnostic sender with templates and per-user preferences.
### Why
Async governance requires out-of-app reach; invites (PR 4) become real.
### Files to create/modify
- Create `src/lib/email/sender.ts` — interface + SMTP/Resend/SES driver chosen by env (`EMAIL_PROVIDER`); no-op in dev.
- Create `src/lib/email/templates.ts` — typed HTML+text templates.
- Create `src/lib/email/dispatch.ts` — maps notification types → email, respects preferences, dedupes.
- Modify `src/lib/notifications.ts` — after creating in-app notification, enqueue email.
- Modify `prisma/schema.prisma` — `NotificationPreference` model. Migration `add_notification_preference`.
- Create `src/app/api/notifications/preferences/route.ts` and `src/app/settings/notifications/page.tsx`.
### DB changes
```prisma
model NotificationPreference {
  id      String  @id @default(uuid())
  userId  String  @unique
  email   Json    @default("{}") // { approvalNeeded: true, runCompleted: true, mention: true, ... }
  updatedAt DateTime @updatedAt
}
```
### Security
- Unsubscribe links signed (HMAC) and scoped to one category; no open redirect.
- No secret/token content in email bodies; absolute URLs use `APP_URL` allowlist.
- Send failures logged via `logger.ts`, never block the request path (fire-and-forget queue).
### Acceptance criteria
- Assigning a task emails the assignee (if opted in); preference off suppresses it.
- Dev mode logs the email instead of sending; prod uses configured provider.

## PR 12 — Export to CSV
**Priority:** P2
**Effort:** S
**Depends on:** PR 1, PR 2
### What
CSV export for Tasks, AgentRuns, Audit log, and PRs honoring current filters.
### Why
Reporting/compliance teams live in spreadsheets; quick win, low risk.
### Files to create/modify
- Create `src/lib/csv.ts` — streaming CSV serializer (RFC 4180 escaping).
- Create `src/app/api/tasks/export/route.ts`, `.../agent-runs/export/route.ts`, `.../audit/export/route.ts` (stream `text/csv`).
- Modify list pages — "Export CSV" button passing active filters.
### DB changes
None.
### Security
- Org-scoped + role-gated; viewer export limited to readable columns. CSV-injection hardening (prefix `=,+,-,@` with `'`).
- Streamed with a row cap / async job threshold to avoid memory blowups.
### Acceptance criteria
- Export reflects current filters; opens cleanly in Excel/Sheets; no formula injection.

---

# Phase 3 — Visualization & sharing

## PR 13 — Mermaid diagram generation & persistence
**Priority:** P1
**Effort:** L
**Depends on:** PR 2
### What
Generate Mermaid diagrams (task lifecycle, architecture, dependency graph) from entity data, render client-side, and persist the Mermaid source + metadata to the DB so they can be saved, reopened, and re-exported. **This is the user's "save my diagrams" request.**
### Why
Visual artifacts make governance legible to stakeholders and become part of the evidence pack.
### Files to create/modify
- Create `src/lib/diagrams/taskLifecycle.ts` — Task + AgentRun states → Mermaid `stateDiagram-v2`.
- Create `src/lib/diagrams/architecture.ts` — Project + repos/services → `graph TD`.
- Create `src/lib/diagrams/dependencyGraph.ts` — task/milestone dependencies → `graph LR`.
- Create `src/lib/diagrams/index.ts` — `generateDiagram(kind, entityId)` returning `{ source, kind, title }`; server-side Mermaid syntax validation before save.
- Add dependency `mermaid` (client render only) — lazy-loaded.
- Create `src/components/DiagramView.tsx` — renders Mermaid source; pan/zoom; "Save" + "Export" controls.
- Create `src/app/api/diagrams/route.ts` (create/list), `.../diagrams/[id]/route.ts` (get/update/delete).
- Modify `src/app/tasks/[id]/page.tsx`, `src/app/projects/[id]/page.tsx` — "Generate diagram" → preview → save.
- Modify `prisma/schema.prisma` — `Diagram` model. Migration `add_diagram`.
### DB changes
```prisma
model Diagram {
  id        String   @id @default(uuid())
  orgId     String
  kind      String   // task_lifecycle | architecture | dependency | pr_diff
  title     String
  source    String   // Mermaid source (the source of truth)
  entityType String? // task | project | milestone
  entityId  String?
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([orgId])
  @@index([entityType, entityId])
}
```
### Security
- Mermaid source validated/sanitized server-side; rendering sandboxed (`securityLevel: 'strict'`, no click handlers/HTML labels) to prevent XSS via diagram text.
- Org-scoped; size cap on `source`.
### Acceptance criteria
- From a task, generate a lifecycle diagram, save it, reload the page, reopen the saved diagram unchanged.
- Architecture and dependency kinds generate valid Mermaid that renders without error.
- Malicious Mermaid input cannot execute script.

## PR 14 — Diagram & attachment export (PNG/SVG) + signed file storage
**Priority:** P1
**Effort:** L
**Depends on:** PR 13
### What
Export diagrams as SVG/PNG, and introduce a file-storage abstraction with **signed URLs** for diagram blobs and (future) task attachments.
### Why
Stakeholders need portable images; signed URLs give secure, time-boxed access to binary artifacts without proxying through app servers.
### Files to create/modify
- Create `src/lib/storage/index.ts` — `StorageDriver` interface (`put`, `getSignedUrl`, `delete`); S3-compatible driver + local-disk dev driver, chosen by `STORAGE_PROVIDER`.
- Create `src/lib/diagrams/export.ts` — server-side SVG generation; PNG via SVG rasterization (client-side canvas for PNG to avoid native deps, with SVG always available server-side).
- Modify `src/components/DiagramView.tsx` — "Export SVG"/"Export PNG" (client) and "Save as image" (uploads to storage, returns signed URL).
- Modify `prisma/schema.prisma` — `Attachment` model + `Diagram.imageKey String?`. Migration `add_attachment_and_image_key`.
- Create `src/app/api/files/sign/route.ts` — issues short-lived signed URLs after org/role check.
### DB changes
```prisma
model Attachment {
  id         String   @id @default(uuid())
  orgId      String
  storageKey String   // object key, not a public URL
  fileName   String
  contentType String
  sizeBytes  Int
  entityType String?  // task | diagram | comment
  entityId   String?
  createdBy  String
  createdAt  DateTime @default(now())
  @@index([orgId])
  @@index([entityType, entityId])
}
```
Add `Diagram.imageKey String?`.
### Security
- Stored keys are opaque; access only via signed URLs (≤ 5 min TTL) issued after authorization — never store public buckets.
- Content-type allowlist + size limit on upload; virus/extension checks for attachments.
- Signed-URL issuance is org-scoped and audited.
### Acceptance criteria
- A saved diagram exports identical SVG and a rasterized PNG.
- Signed URL works within TTL, 403/expired after; direct object access without a signature is denied.

## PR 15 — PR diff diagrams
**Priority:** P2
**Effort:** M
**Depends on:** PR 13
### What
Generate a Mermaid visualization of a GithubPR's changed files/modules (impact map) saved as a `Diagram(kind: pr_diff)`.
### Why
Reviewers grasp blast radius of a PR visually; ties diagrams into the existing PR governance flow.
### Files to create/modify
- Create `src/lib/diagrams/prDiff.ts` — `GithubPR.filesChanged` → module/folder graph with change-size weighting.
- Modify `src/app/projects/[id]/prs/[prId]/page.tsx` — "Visualize changes" → save diagram.
### DB changes
None (reuses `Diagram`).
### Security
- Reuses PR 13 sanitization. File paths escaped into node labels.
### Acceptance criteria
- A PR with N changed files renders a folder-grouped impact diagram that can be saved and exported.

## PR 16 — Shareable public report links
**Priority:** P1
**Effort:** M
**Depends on:** PR 13 (diagrams in reports), existing report at `src/app/tasks/[id]/report`
### What
Generate revocable public links for task/evidence reports (read-only HTML), optionally password-protected and expiring, embedding saved diagrams.
### Why
Auditors/clients need to view governance evidence without an account — a key SaaS sharing capability.
### Files to create/modify
- Modify `prisma/schema.prisma` — `ShareLink` model. Migration `add_share_link`.
- Create `src/lib/shareLinks.ts` — create/verify (HMAC token), optional bcrypt password, expiry/revoke.
- Create `src/app/api/share-links/route.ts` (+ `[id]` revoke).
- Create `src/app/share/[token]/page.tsx` — public, no-auth, read-only report render (reuses report components).
- Modify `src/app/tasks/[id]/report/page.tsx` — "Create share link" control.
- Modify `src/middleware.ts` — allow `/share/[token]` past auth gate.
### DB changes
```prisma
model ShareLink {
  id           String   @id @default(uuid())
  orgId        String
  entityType   String   // task_report | evidence_pack
  entityId     String
  token        String   @unique // hashed
  passwordHash String?
  expiresAt    DateTime?
  revokedAt    DateTime?
  viewCount    Int      @default(0)
  createdBy    String
  createdAt    DateTime @default(now())
  @@index([orgId])
}
```
### Security
- Public route renders a strictly read-only, redacted view (no internal ids, no mutation controls, secrets stripped).
- Token hashed; expiry + revoke enforced server-side; optional password gate; rate-limited; `viewCount`/access audited.
- `X-Robots-Tag: noindex` and no auth cookies on the public route.
### Acceptance criteria
- A share link renders the report anonymously; revoking or expiry returns 404/410.
- Password-protected link requires the password; no internal/PII fields leak.

## PR 17 — PDF export
**Priority:** P2
**Effort:** M
**Depends on:** PR 16
### What
Server-rendered PDF export of task/evidence reports (with embedded diagrams) for offline distribution.
### Why
Compliance deliverables are frequently required as PDFs.
### Files to create/modify
- Create `src/lib/pdf.ts` — HTML→PDF (headless Chromium via `@sparticuz/chromium` or a print-CSS route) behind an interface so the renderer is swappable.
- Create `src/app/api/reports/[id]/pdf/route.ts` — streams `application/pdf`, org/role gated, reuses the report HTML.
- Modify report pages — "Download PDF".
### DB changes
None.
### Security
- Render from internal report HTML only (no arbitrary URL → SSRF). Org-scoped; signed-URL diagrams resolved server-side.
- Heavy renders run with timeout + concurrency cap.
### Acceptance criteria
- PDF matches the HTML report including saved diagrams; generation is rate-limited and times out gracefully.

---

# Phase 4 — Automation & integration

## PR 18 — Outbound webhooks (Slack, Teams, custom)
**Priority:** P1
**Effort:** L
**Depends on:** PR 2, PR 9 (event bus)
### What
Org-configured outbound webhooks firing on events (run completed/failed, approval needed, task status change), with Slack/Teams presets and HMAC-signed custom payloads, retries, and delivery log.
### Why
Teams live in chat/CI; pushing governance events outward closes the loop.
### Files to create/modify
- Modify `prisma/schema.prisma` — `Webhook` + `WebhookDelivery` models. Migration `add_webhook`.
- Create `src/lib/webhooks/dispatch.ts` — subscribes to the event bus (PR 9), formats per target (`slack`/`teams`/`custom`), signs, posts with retry/backoff via `retryFetch.ts`.
- Create `src/lib/webhooks/format.ts` — Slack Block Kit / Teams Adaptive Card / raw JSON.
- Create `src/app/api/webhooks/route.ts` (+ `[id]` for update/delete/test).
- Create `src/app/settings/webhooks/page.tsx` (config + recent deliveries + "Send test").
### DB changes
```prisma
model Webhook {
  id        String   @id @default(uuid())
  orgId     String
  url       String
  type      String   // slack | teams | custom
  secret    String?  // for HMAC signing (encrypted)
  events    String[] @default([]) // run.completed approval.needed task.updated ...
  enabled   Boolean  @default(true)
  createdBy String
  createdAt DateTime @default(now())
  deliveries WebhookDelivery[]
  @@index([orgId])
}
model WebhookDelivery {
  id         String   @id @default(uuid())
  webhookId  String
  webhook    Webhook  @relation(fields: [webhookId], references: [id])
  event      String
  status     String   // pending | success | failed
  responseCode Int?
  attempts   Int      @default(0)
  createdAt  DateTime @default(now())
  @@index([webhookId])
}
```
### Security
- Custom payloads HMAC-signed (`X-Coder-Signature`); secret encrypted at rest.
- SSRF guard: deny private/loopback/metadata IP ranges for custom URLs; DNS-rebind protection.
- Retries capped with exponential backoff; deliveries audited; secrets never logged.
### Acceptance criteria
- A completed run posts a Slack message; a custom endpoint receives a valid signature.
- Failed deliveries retry then surface in the delivery log; private-IP URLs are rejected.

## PR 19 — CI/CD status dashboard
**Priority:** P1
**Effort:** M
**Depends on:** PR 2; reuses `GithubPR.ciStatus` and `githubClient.ts`
### What
A dashboard aggregating CI/CD status across projects/PRs (GitHub Actions runs), with per-project health and drill-down, refreshing live via SSE.
### Why
Governance + delivery health in one place; leverages existing PR/CI fields.
### Files to create/modify
- Modify `src/lib/githubClient.ts` — fetch Actions runs/check-runs for tracked PRs/branches.
- Create `src/lib/ci/aggregate.ts` — roll up `ciStatus` into project/org health.
- Create `src/app/ci/page.tsx` + `src/components/CiStatusGrid.tsx`.
- Create `src/app/api/ci/status/route.ts` (org-scoped aggregate).
- Modify `prisma/schema.prisma` — optional `CiRun` cache model. Migration `add_ci_run`.
### DB changes
```prisma
model CiRun {
  id         String   @id @default(uuid())
  orgId      String
  projectId  String
  prId       String?
  workflow   String
  status     String   // queued | in_progress | success | failure
  url        String?
  updatedAt  DateTime @updatedAt
  @@index([orgId])
  @@index([projectId])
}
```
### Security
- Uses org's GitHub token (from `OAuthAccount`/project config), scope-limited; cross-org isolation enforced.
- API responses rate-limited; GitHub calls cached to respect rate limits.
### Acceptance criteria
- Dashboard shows red/green per project and PR; clicking opens the run; status updates live.

## PR 20 — Customizable dashboard widgets
**Priority:** P2
**Effort:** L
**Depends on:** PR 19, PR 21 (localStorage helper for layout)
### What
A configurable home dashboard of widgets (pending approvals, recent runs, CI health, scorecard, my tasks, diagrams) with per-user layout.
### Why
Different roles need different cockpits; raises daily-active value.
### Files to create/modify
- Create `src/components/widgets/*` (one component per widget, each fetching its own scoped data).
- Create `src/components/DashboardGrid.tsx` — add/remove/reorder; layout persisted.
- Modify `src/app/page.tsx` — render configurable grid (fallback to default layout).
- Modify `prisma/schema.prisma` — `DashboardLayout` model (server persistence so layout follows the user across devices; localStorage caches it). Migration `add_dashboard_layout`.
### DB changes
```prisma
model DashboardLayout {
  id        String   @id @default(uuid())
  userId    String
  orgId     String
  layout    Json     // ordered widget config
  updatedAt DateTime @updatedAt
  @@unique([userId, orgId])
}
```
### Security
- Each widget independently org/role-scoped; viewers don't see admin-only widgets.
- Layout JSON validated against an allowlist of widget ids.
### Acceptance criteria
- User adds/removes/reorders widgets; layout persists across reload and devices; each widget shows only authorized data.

---

# Phase 5 — Experience & scale

## PR 21 — LocalStorage UI-state layer (drafts, panels, theme, recents)
**Priority:** P1
**Effort:** M
**Depends on:** none (but consumed by PR 7/20)
### What
A safe, typed client-side persistence layer for **ephemeral UI state only**: draft form contents, expanded/collapsed panel state, theme preference, and recent searches.
### Why
The user explicitly wants UI state to survive refresh (draft forms, expanded panels, theme) — without making client storage authoritative for governance data.
### Files to create/modify
- Create `src/lib/clientStorage.ts` — namespaced (`cda.`), versioned, SSR-safe (guards `window`), quota-safe (try/catch), with TTL support.
- Create `src/hooks/useLocalStorage.ts`, `src/hooks/useDraft.ts` (autosave form drafts, "restore draft?" prompt), `src/hooks/usePanelState.ts` (collapse state), `src/hooks/useRecentSearches.ts`.
- Modify form pages (`tasks/new`, `tasks/[id]/edit`, `projects/new`, comment composer) to autosave/restore drafts.
- Modify panel-bearing components (`OperatorPanel.tsx`, `RunPromptPanel.tsx`, `ApprovalPanel.tsx`, `AuditTimeline.tsx`) to persist collapse state.
### DB changes
None.
### Security
- Never store secrets, tokens, CSRF tokens, or PII-heavy payloads in localStorage.
- Keys namespaced and versioned; corrupt/oversized data is discarded, not thrown.
- Drafts cleared on successful submit and on logout.
### Acceptance criteria
- Refreshing a half-filled form offers to restore the draft; submit clears it.
- Panel collapse state and recent searches survive reload; logout purges `cda.*` keys.

## PR 22 — Theme system & persistence (dark/light)
**Priority:** P2
**Effort:** S
**Depends on:** PR 21
### What
Full dark/light theme via CSS variables with system-preference detection and persisted choice (no flash of wrong theme).
### Why
Table-stakes UX; CSS-variable architecture already supports it.
### Files to create/modify
- Modify `src/app/globals.css` — `:root` light tokens + `[data-theme="dark"]` overrides; map all hard-coded colors to variables.
- Create `src/components/ThemeToggle.tsx` and `src/components/ThemeScript.tsx` (inline pre-hydration script setting `data-theme` from localStorage/`prefers-color-scheme`).
- Modify `src/app/layout.tsx` — inject `ThemeScript` in `<head>`; toggle in `AppShell.tsx`.
### DB changes
None (preference in localStorage via PR 21; optional later sync to `NotificationPreference`-style row).
### Security
None notable.
### Acceptance criteria
- Theme persists across reloads with no flash; honors system default on first visit; all surfaces (cards, badges, banners) themed.

## PR 23 — Mobile responsiveness & accessibility (WCAG 2.1 AA)
**Priority:** P1
**Effort:** L
**Depends on:** PR 22 (theme tokens for contrast)
### What
Responsive layouts for all primary views and a WCAG 2.1 AA accessibility pass (semantics, focus management, contrast, keyboard nav, ARIA).
### Why
A SaaS must be usable on phones and meet accessibility/procurement requirements (VPAT).
### Files to create/modify
- Modify `src/app/globals.css` — responsive breakpoints, fluid spacing, container queries where useful; verify token contrast ≥ 4.5:1.
- Modify `src/components/AppShell.tsx`, `SidebarNav.tsx`, `MobileNav.tsx` — collapsible nav, touch targets ≥ 44px.
- Modify Kanban `board/page.tsx` and data tables — horizontal scroll/stacked layouts on small screens.
- Sweep interactive components for: labels on inputs, focus-visible rings, `aria-live` for async (run status, toasts), focus trap in modals/palette, skip-to-content link, semantic landmarks.
- Add `eslint-plugin-jsx-a11y` to lint config.
### DB changes
None.
### Security
None notable.
### Acceptance criteria
- Core flows (login, task create, approve, board) usable at 360px width.
- axe/Lighthouse a11y ≥ 95; full keyboard operation; no contrast failures; screen-reader announces status changes.

## PR 24 — Billing & subscription tiers
**Priority:** P1
**Effort:** XL
**Depends on:** PR 2, PR 6 (limits enforced on keys too)
### What
Stripe-backed subscriptions (free/pro/enterprise) with plan-based limits (members, projects, API keys, retention), checkout, customer portal, and webhook-driven entitlement sync.
### Why
Monetization — the explicit SaaS endpoint. Tenancy + roles + keys must exist first.
### Files to create/modify
- Modify `prisma/schema.prisma` — `Subscription` model + `Organization.plan` already present. Migration `add_subscription`.
- Create `src/lib/billing/stripe.ts` (checkout session, portal), `src/lib/billing/entitlements.ts` (`canCreateProject(org)`, member/key caps).
- Create `src/app/api/billing/checkout/route.ts`, `.../portal/route.ts`, `.../webhook/route.ts` (Stripe signature verified).
- Create `src/app/settings/billing/page.tsx`.
- Modify create paths (projects, members/invites, API keys) to enforce entitlements.
### DB changes
```prisma
model Subscription {
  id                 String   @id @default(uuid())
  orgId              String   @unique
  stripeCustomerId   String?
  stripeSubscriptionId String?
  plan               String   @default("free")
  status             String   @default("active") // active | past_due | canceled
  currentPeriodEnd   DateTime?
  updatedAt          DateTime @updatedAt
}
```
### Security
- Stripe webhook signature verified; idempotent handling; entitlements are server-authoritative (never trust client plan).
- No card data touches our servers (Stripe-hosted checkout/portal).
- Downgrade gracefully enforces caps (read-only over limit, no data destruction).
### Acceptance criteria
- Upgrade via checkout flips `plan`; webhook keeps `status`/`currentPeriodEnd` in sync; exceeding a plan limit is blocked with a clear upgrade prompt.

---

## 4. Dependency graph (build order)

```
PR1
 └─PR2 ── PR3 ──┬─ PR4 ── (PR11)
               ├─ PR5
               ├─ PR6 ─────────────── PR24
               ├─ PR7
               ├─ PR8 ── PR9 ──┬─ PR18
               │               └─ PR20
               ├─ PR10
               ├─ PR12
               ├─ PR13 ──┬─ PR14 ── PR15
               │         └─ PR16 ── PR17
               └─ PR19 ── PR20
PR21 ─ PR22 ─ PR23   (UX track, parallelizable after PR1)
```

## 5. Conflict-avoidance notes for sequential merges

- **`prisma/schema.prisma`** is touched by most PRs. Each PR appends models/columns at the end of its model block; migrations are timestamp-ordered, so sequential merges apply cleanly. Never reorder existing models.
- **`src/lib/featureFlags.ts`** is append-only per PR (new boolean field, default `false`).
- **`src/middleware.ts`** edits are isolated: PR 1 (request id/logging), PR 6 (bearer auth), PR 16 (`/share` allowlist). Keep these in distinct, clearly-commented blocks.
- **`AppShell.tsx`/`SidebarNav.tsx`** gain one nav entry/control per relevant PR — additive list items, low collision risk.
- **`src/lib/audit.ts`** and **`src/lib/notifications.ts`** gain new event types per PR — append to the union/enum, never rename.
- All new API routes live under new path segments, avoiding edits to existing route files except where a route is explicitly being paginated/org-scoped (PR 1, PR 2).

## 6. Definition of done (every PR)

- Prisma migration committed and reversible; `npm run typecheck`, `npm run lint`, `npm run test` green.
- New logic has unit tests in `src/lib/__tests__/`.
- Org-scoping + role checks proven by at least one negative test.
- Audit entries emitted for every state-changing action; secrets redacted in logs.
- New env vars documented in `.env.example`; feature behind a flag where risk warrants.
- No regression to existing decision-engine / evidence / approval flows.
