# Phase 2 Implementation Checklist

Ordered list of PRs/steps to complete Phase 2 (multi-user identity, approval authorship, CSRF hardening, session hardening). Each step builds on the previous one and can be merged independently.

---

## Step 1 — Add `role` field to `User` model

**Branch:** `feat/phase2-user-role`

**What it changes:**
- Adds `role String @default("reviewer")` to the `User` model in `prisma/schema.prisma`
- Generates and runs a migration: `prisma migrate dev --name add-user-role`

**What it might break:**
- Nothing in production (non-breaking: column has a default, existing rows receive `"reviewer"`)
- Any TypeScript code that constructs a `User` object without a `role` field will need updating

**How to verify:**
```sql
SELECT COUNT(*) FROM "User" WHERE role IS NULL;
-- expect: 0
```
- Run `npm run typecheck` — no errors
- Run all existing tests — no failures

---

## Step 2 — Seed admin `User` row at login

**Branch:** `feat/phase2-admin-user-seed`

**What it changes:**
- Updates `src/app/api/auth/login/route.ts` to upsert a `User` row using `ADMIN_USERNAME` as the email when auth mode is `enforced`
- Stores the resulting UUID `id` in the iron-session payload alongside `username`

**What it might break:**
- The login API shape changes — any test that checks the session payload will need updating
- `AppSession.userId` changes from the literal string `'admin'` to a real UUID
  - Update the type in `src/lib/session.ts`: `userId: string` (remove the `'admin'` literal)
  - Any code that does `session.userId === 'admin'` will break and must be updated

**How to verify:**
- Log in and check the session cookie (decode via iron-session); `userId` should be a UUID
- `prisma.user.findUnique({ where: { email: process.env.ADMIN_USERNAME } })` returns a row
- Run `src/lib/__tests__/phase2Contracts.test.ts` — update the `userId` literal assertion if present
- Run full test suite — no failures

---

## Step 3 — Attribute `AuditLog` rows to the authenticated user

**Branch:** `feat/phase2-auditlog-userid`

**What it changes:**
- Updates every API route that calls `prisma.auditLog.create(...)` to include `userId: session.userId`
- `userId` is nullable, so routes that run outside a session (background jobs, startup) pass `null`

**What it might break:**
- Nothing structurally — the column is already nullable
- Any test that asserts the exact shape of an `AuditLog` row without a `userId` will still pass (the field defaults to `null`)

**How to verify:**
- After any admin action (e.g., approve a task), run:
  ```sql
  SELECT "userId" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 1;
  -- expect: non-null UUID
  ```
- Run `npm run typecheck` — no errors
- Run full test suite — no failures

---

## Step 4 — Record approver on `Approval` rows

**Branch:** `feat/phase2-approval-approverid`

**What it changes:**
- Updates the approval/rejection API routes (`src/app/api/approvals/...`) to set `approverId = session.userId` when writing a decision
- `approverId` is already nullable in the schema; existing rows are unaffected

**What it might break:**
- Nothing — the column is already nullable; existing rows keep `approverId = null`
- Any test that constructs an `Approval` fixture without `approverId` continues to pass

**How to verify:**
- Approve or reject a task, then run:
  ```sql
  SELECT "approverId" FROM "Approval" WHERE "taskId" = '<id>';
  -- expect: non-null UUID matching the logged-in user's id
  ```
- Run full test suite — no failures

---

## Step 5 — Add CSRF token generation and validation middleware

**Branch:** `feat/phase2-csrf`

**What it changes:**
- Adds a CSRF utility module at `src/lib/csrf.ts`:
  - `generateCsrfToken(): string` — 32-byte hex token
  - `validateCsrfToken(req, session): boolean` — Double-Submit Cookie check
- Updates `middleware.ts` to:
  - Set a `csrf-token` cookie (`httpOnly: false`, `sameSite: lax`) on authenticated GET requests
  - Validate `x-csrf-token` header on all non-GET, non-public mutation routes
  - Return HTTP 403 if the token is missing or mismatched
- Updates all client-side `fetch` calls that mutate data to include the `x-csrf-token` header

**What it might break:**
- Any direct API call (e.g., `curl`, automated scripts) that omits the CSRF header will receive HTTP 403
- All existing API integration tests must be updated to include the CSRF header
- The login route (`/api/auth/login`) is explicitly exempted — it is unauthenticated

**How to verify:**
- `POST /api/tasks` without `x-csrf-token` header → HTTP 403
- `POST /api/tasks` with correct `x-csrf-token` header → HTTP 200/201
- `GET /api/tasks` (no header needed) → HTTP 200
- `POST /api/auth/login` (exempted) → HTTP 200 with valid credentials
- Run full test suite (tests updated for CSRF header) — no failures

---

## Step 6 — Session rotation on successful login

**Branch:** `feat/phase2-session-rotation`

**What it changes:**
- Updates `src/app/api/auth/login/route.ts` to call `session.destroy()` before `session.save()` after a successful credential check
- This issues a new session cookie on every login, invalidating any previous session

**What it might break:**
- Clients that cache the old session cookie will be logged out — this is expected and correct behavior
- No application logic should depend on session continuity across logins

**How to verify:**
- Log in twice in the same browser; the second login cookie value differs from the first
- After login, the old session cookie is no longer valid (returns 401 on protected routes)
- Run full test suite — no failures

---

## Step 7 — Update contract tests for Phase 2 state

**Branch:** `feat/phase2-update-contracts`

**What it changes:**
- Updates `src/lib/__tests__/phase2Contracts.test.ts` to reflect the new behavior:
  - `AppSession.userId` is now a UUID, not the literal `'admin'`
  - Session cookie name remains `__session` (no change)
  - CSRF middleware is active
- Adds new contract tests for CSRF token generation and validation

**What it might break:**
- Nothing — this is a test-only PR

**How to verify:**
- `./node_modules/.bin/tsx --test src/lib/__tests__/*.test.ts` — all tests pass
- `npm run typecheck` — no errors

---

## Pre-Deployment Checklist

Before merging any Phase 2 PR to `main` for a public-facing deployment:

- [ ] Step 1 (role field) migration has been applied to the production database
- [ ] Step 2 (admin seed) login flow has been verified end-to-end in staging
- [ ] Step 3 (AuditLog userId) — all write routes confirmed to set `userId`
- [ ] Step 4 (Approval approverId) — approval/rejection flow verified in staging
- [ ] Step 5 (CSRF) — all client fetch calls include `x-csrf-token`; middleware active in production
- [ ] Step 6 (session rotation) — verified in staging; old sessions invalidated after login
- [ ] `npm run typecheck` — clean
- [ ] Full test suite — no failures
- [ ] Security review of CSRF implementation completed
