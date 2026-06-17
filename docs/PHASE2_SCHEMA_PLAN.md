# Phase 2 Schema Plan

## Current State (as of `main` @ `227fd1d`)

### Authentication

- Single admin identity via two env vars: `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`.
- Auth mode is derived at runtime by `getAuthMode()` in `src/lib/session.ts`:
  - `disabled` — neither var is set (safe local dev)
  - `enforced` — both vars are set; login required
  - `misconfigured` — only one var is set; treated as server error (HTTP 500)
- Session cookie name: `__session` (iron-session, httpOnly, sameSite=lax)
- Session payload: `{ userId: 'admin', username: string, loginAt: string }` — the `userId` field is the string literal `'admin'`, not a database FK.
- `SESSION_SECRET` must be at least 32 characters when auth is enforced.

### Database schema — identity fields

The Prisma schema (`prisma/schema.prisma`) already contains a `User` model and nullable FK columns on `AuditLog` and `Approval`. However, **no migration has been run** to populate these columns in production, and **no login flow writes a real user row**. The schema additions are structural placeholders only.

```prisma
model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String?
  approvals Approval[]
  auditLogs AuditLog[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model AuditLog {
  // ...
  userId  String?        // nullable — all existing rows are NULL
  user    User?          @relation(fields: [userId], references: [id])
}

model Approval {
  // ...
  approverId String?
  user       User?   @relation(fields: [approverId], references: [id])
}
```

### What is NOT wired up today

- No `User` rows are created at login — the current login route validates env-var credentials only.
- `iron-session` stores `userId: 'admin'` (a literal string constant, not a DB UUID).
- All `AuditLog` rows are created without a `userId` — attribution is implicit (system/admin).
- `Approval.approverId` is never set by any write route.
- No CSRF protection on any mutation route.
- No session rotation on privilege change.

---

## Proposed Phase 2 Additions

Phase 2 wires up the identity plumbing that the schema already anticipates.

### Goals

1. Issue real `User` rows and store a UUID-based `userId` in the session.
2. Attribute every `AuditLog` write to the authenticated user.
3. Record who approved/rejected an `Approval`.
4. Harden sessions with CSRF tokens and session rotation.

### Schema diff (informational — do NOT apply as a migration)

The Prisma schema already has the necessary models and columns. No additional schema changes are required for Phase 2. The diff below is included for documentation purposes to contrast with the pre-migration state:

```prisma
// Already present — shown here for clarity
model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String?
  role      String     @default("reviewer") // NEW field to add: "admin" | "reviewer"
  approvals Approval[]
  auditLogs AuditLog[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}
```

The one genuine schema addition is a `role` field on `User`. It can default to `"reviewer"` making it safe to add with a single nullable/default migration.

### Migration path (safe order)

#### Step 1 — Add `role` to `User`

```prisma
model User {
  // ...existing fields...
  role String @default("reviewer") // "admin" | "reviewer"
}
```

**Risk:** Non-breaking. The column has a default so all existing rows (currently zero in production) receive `"reviewer"`.
**Verify:** `SELECT COUNT(*) FROM "User" WHERE role IS NULL;` returns 0.

#### Step 2 — Seed the admin `User` row at startup

Add a startup routine (or login route) that upserts a `User` row using `ADMIN_USERNAME` as the email when auth mode is `enforced`. This creates the bridge between the env-var credential and the DB identity.

**Risk:** Login flow changes — must not break the env-var credential check.
**Verify:** After login, `prisma.user.findUnique({ where: { email: adminEmail } })` returns a row.

#### Step 3 — Store real `userId` UUID in the session

Update the login API route to include the DB user's `id` (UUID) in the iron-session payload instead of the literal string `'admin'`.

Update `AppSession` interface in `src/lib/session.ts`:

```typescript
export interface AppSession {
  userId: string;   // was: 'admin' (literal) — now a real UUID
  username: string;
  loginAt: string;
}
```

**Risk:** Any code that compares `session.userId === 'admin'` will break.
**Verify:** Run `src/lib/__tests__/phase2Contracts.test.ts` — the contract tests assert the old literal still works until this step ships, at which point update them.

#### Step 4 — Pass `userId` to all `prisma.auditLog.create` calls

Update every API route that creates an `AuditLog` to read `session.userId` from the iron-session and pass it as `userId`. Null-safe — unauthenticated / pre-migration rows continue to work.

**Risk:** Missed call sites will leave `userId = null` rows (acceptable, not broken).
**Verify:** After any admin action, `SELECT userId FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 1;` is non-null.

#### Step 5 — Set `Approval.approverId` on approval/rejection

Update the approval API routes to set `approverId = session.userId` when writing the approval decision.

**Risk:** Low. The column is already nullable; existing rows are unaffected.
**Verify:** After approving a task, `SELECT approverId FROM "Approval" WHERE taskId = '<id>';` is non-null.

#### Step 6 — Add CSRF token generation and validation middleware

Add a CSRF middleware layer that:
- Generates a per-session CSRF token on GET requests (Double-Submit Cookie pattern).
- Validates the token on all non-GET, non-safe routes (`POST`, `PUT`, `PATCH`, `DELETE`).
- Exempts `/api/auth/login` (unauthenticated, credentials are the proof).

**Risk:** Any client that does not send the CSRF header will receive HTTP 403. This includes direct `curl` invocations used in testing — update tests to include the header.
**Verify:** `POST /api/tasks` without CSRF header returns 403; with header returns 200/201.

#### Step 7 — Session rotation on privilege change

Rotate the session ID (issue a new cookie) after:
- Successful login
- Any role/privilege escalation (future: when reviewer is promoted to admin)

**Risk:** Clients that cache the old cookie will be logged out — expected behavior.
**Verify:** After login, the `Set-Cookie` header changes on each successful authentication.

---

## Risk Summary

| Step | Breaking? | Rollback |
|------|-----------|----------|
| 1 — Add `role` to `User` | No (default value) | Drop column |
| 2 — Seed admin User row | No (upsert is idempotent) | Remove startup call |
| 3 — Real `userId` in session | YES — breaks `=== 'admin'` checks | Revert `AppSession` type |
| 4 — AuditLog `userId` writes | No (nullable column) | Remove the field from creates |
| 5 — Approval `approverId` | No (nullable column) | Remove the field from creates |
| 6 — CSRF middleware | YES — 403 for clients missing header | Disable middleware |
| 7 — Session rotation | No (transparent to well-behaved clients) | Remove rotation call |

Steps 3 and 6 are the only breaking changes. Both must be gated behind feature-branch PRs with full test coverage before merge to main.

---

## CSRF Approach Detail

Use the **Double-Submit Cookie** pattern (no server-side state required):

1. On every authenticated GET, set a `csrf-token` cookie (random 32-byte hex, `httpOnly: false` so JS can read it).
2. On every non-GET mutation, require the request to include an `x-csrf-token` header whose value matches the cookie.
3. Validate in a Next.js middleware function added to the matcher in `middleware.ts`.

Alternative: Synchronizer Token Pattern (store token in session) — simpler but requires session read on every request.

The Double-Submit pattern is preferred because it avoids a session lookup on every non-GET request.
