# Auth / User Identity Design

**Document status:** DRAFT — design only, no code changes.  
**Author:** Autonomous architecture team  
**Date:** 2026-06-05  
**Scope:** Internal single-admin auth for AI Dev Orchestrator / Coder by DevAscend

---

## 1. Current State (Audit Findings)

### What exists

| Layer | Current state |
|---|---|
| Middleware | Optional shared `GOVERNANCE_API_KEY` header check + IP rate limiting. No user identity. |
| API routes | Zero auth checks on all 14 route files. Any caller can create tasks, approve instructions, import PRs. |
| UI pages | No login/logout pages. No session indicator. Sidebar footer shows "v0.1.0 · Internal". |
| User model | `User` model exists in Prisma with `id`, `email`, `name`, `approvals`, `auditLogs`. **Never populated.** |
| Approval model | `Approval.approverId` → User FK. Always NULL. Instruction `approvedBy` is a plain string from request body — never validated. |
| Audit logs | 16 event types logged. `AuditLog.userId` always NULL. No actor identity in any event. |
| Session/auth packages | None. `next-auth`, `iron-session`, `jsonwebtoken`, `bcrypt`, `lucia`, `clerk` — all absent. |
| Env vars | `GOVERNANCE_API_KEY` (optional shared key), `GITHUB_TOKEN` (server-side read-only). No auth secret, no session key. |

### Critical gaps

1. **No authentication.** Any HTTP client that passes the governance key can read and mutate everything.
2. **No user identity.** Approvals, task creation, instruction transitions — none record who did them.
3. **`approvedBy` is client-supplied and unvalidated.** The instruction PATCH endpoint accepts whatever string the client sends.
4. **All audit logs are anonymous.** Forensics and compliance are currently impossible.
5. **No route protection.** `/instructions/pending`, `/tasks/new`, `/audit` are open to anyone on the network.

---

## 2. Design Principles

1. **Simplest possible for internal single-user first.** Rahul is the only user. No multi-user RBAC yet.
2. **No new auth dependencies if avoidable.** Prefer libraries with strong Next.js 14 App Router support and minimal footprint.
3. **No schema migration for Phase 1.** Admin identity stored in env, not DB. Schema migration is Phase 2.
4. **Env-gated.** If `ADMIN_PASSWORD_HASH` is not set, the app continues to work without auth (escape hatch for local dev). When set, auth is enforced.
5. **HTTP-only cookie session.** Never expose session token to JavaScript. SameSite=Lax.
6. **Behavior-preserving.** Auth wraps existing functionality; no feature logic changes.
7. **Audit identity from session.** All existing audit log `details` JSON gets `actor` added automatically — no DB schema change needed for Phase 1.

---

## 3. Proposed Auth Model — Phase 1 (Rahul/Admin)

### 3.1 Credential storage

Admin credentials stored as environment variables — **not in the database**:

```
ADMIN_USERNAME=rahul
ADMIN_PASSWORD_HASH=<bcrypt hash of actual password, cost factor 12>
SESSION_SECRET=<random 32+ byte hex string — never commit>
SESSION_MAX_AGE_HOURS=8
```

`ADMIN_PASSWORD_HASH` is generated once offline with `bcryptjs` and stored in the server environment. The plaintext password is never stored anywhere.

`SESSION_SECRET` encrypts the session cookie. Rotating this secret invalidates all existing sessions (intentional for key rotation).

### 3.2 Session mechanism

**Library:** [`iron-session`](https://github.com/vvo/iron-session) v8 (works with Next.js 14 App Router, no server-side session store needed, encrypts session data in an HTTP-only cookie).

**Session data shape:**

```typescript
interface AppSession {
  userId: 'admin';          // Phase 1: always 'admin'; Phase 2: DB User.id
  username: string;         // e.g. 'rahul'
  loginAt: string;          // ISO timestamp
}
```

**Cookie config:**

```typescript
{
  cookieName: '__session',
  password: process.env.SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: (SESSION_MAX_AGE_HOURS * 3600) - 60,  // leave 60s buffer
  },
}
```

### 3.3 Route protection

Extend the middleware matcher from `/api/:path*` to all routes:

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

**Middleware decision tree:**

```
Request comes in
│
├─ Path is /login or /api/auth/*  → allow (public, no auth check)
│
├─ Path starts with /api/
│   ├─ No valid session cookie  → 401 JSON { error: 'Authentication required' }
│   ├─ GOVERNANCE_API_KEY check (existing)
│   ├─ Rate limit check (existing)
│   └─ next()
│
└─ All other paths (pages)
    ├─ No valid session cookie  → redirect to /login?next=<encoded path>
    └─ next()
```

**Key rule:** `/login` and `/api/auth/*` are always public. Everything else requires a session.

### 3.4 Login flow

1. Browser requests any protected page → middleware redirects to `/login?next=/tasks`
2. User submits username + password form → POST `/api/auth/login`
3. Server: `bcrypt.compare(password, ADMIN_PASSWORD_HASH)` — if match, create session and redirect to `next` (validated to be same-origin)
4. Browser receives session cookie; all subsequent requests carry it automatically

**`/api/auth/login`** POST:
- Input: `{ username: string; password: string }`
- Validates username matches `ADMIN_USERNAME`
- Validates password via bcrypt against `ADMIN_PASSWORD_HASH`
- On success: set session cookie, return `{ ok: true }`
- On failure: 401, `{ error: 'Invalid credentials' }` — same message for wrong username or wrong password (no enumeration)
- Rate limit: 5 attempts / 15 min per IP (independent from existing rate limiter)

**`/api/auth/logout`** POST:
- Destroys session cookie
- Returns `{ ok: true }`
- Redirects browser to `/login`

**`/api/auth/me`** GET:
- Returns `{ username, loginAt }` from session (no password hash, no secret)
- Used by layout to display "Logged in as rahul" + logout button

### 3.5 Logout and session expiry

- **Explicit logout:** POST `/api/auth/logout` — clears cookie, redirects to `/login`
- **Idle/absolute expiry:** `SESSION_MAX_AGE_HOURS` (default 8). `iron-session` enforces this server-side via cookie `maxAge`. After expiry the cookie is invalid and middleware redirects to login.
- **Secret rotation:** Changing `SESSION_SECRET` immediately invalidates all sessions (all users must re-login). No token blacklist needed for single-user.

### 3.6 Audit identity

Phase 1: No DB schema change. Inject `actor` into every audit log `details` JSON string.

Create a server-side helper `getAuditActor(req)` that reads the session and returns `{ actor: 'rahul' }` (or `'unknown'` if somehow called without session). Every `prisma.auditLog.create()` call merges this into `details`:

```typescript
details: JSON.stringify({
  ...existingDetails,
  actor: getAuditActor(request),
})
```

This is a pure additive change — existing `details` JSON parsing is unaffected.

Phase 2 (later): Populate `AuditLog.userId` from a DB User row created on first login or by seed. Requires a Prisma migration (see §6).

### 3.7 `approvedBy` fix

With auth in place, the instruction PATCH endpoint should **ignore** the client-supplied `approvedBy` field and derive it from the session instead:

```typescript
// Before (current — client-supplied, unvalidated):
approvedBy: body.approvedBy,

// After (from session):
approvedBy: session.username,
```

This is a behavior change but a correctness fix — the field was always wrong before.

---

## 4. New Files Required

```
src/
├── lib/
│   ├── session.ts              # iron-session config, AppSession type, getSession/requireSession helpers
│   └── authHelpers.ts          # getAuditActor(), loginRateLimit store
├── app/
│   ├── login/
│   │   └── page.tsx            # Login form (client component)
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts    # POST: validate credentials, set session
│           ├── logout/
│           │   └── route.ts    # POST: destroy session
│           └── me/
│               └── route.ts    # GET: return current session info
```

---

## 5. Files That Must Change

### 5.1 `src/middleware.ts`

- Expand `matcher` to cover all routes, not just `/api/*`
- Add session validation check at the top of the handler
- Add `/login` and `/api/auth/*` to the public allowlist
- Page requests without session → redirect to `/login?next=<path>`
- API requests without session → 401 JSON

### 5.2 `src/app/layout.tsx`

- Add a `<UserBar>` server component that calls `/api/auth/me` (or reads session directly via server-side helper)
- Display "Rahul" / current username in sidebar footer
- Replace "v0.1.0 · Internal" footer with user chip + logout button

### 5.3 `src/components/SidebarNav.tsx`

- Add logout button at bottom (POST to `/api/auth/logout`)
- Show currently logged-in user name

### 5.4 All 14 `src/app/api/*/route.ts` files

- Import and call `requireSession(request)` at the top of each handler
- Extract `actor` from session for audit log `details`
- In `/api/instructions/[id]/route.ts`: override `approvedBy` from session, not request body

### 5.5 `.env.example`

- Add: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `SESSION_MAX_AGE_HOURS`
- Document how to generate `ADMIN_PASSWORD_HASH` (one-liner using bcryptjs)

### 5.6 `package.json`

New dependencies:
- `iron-session` ^8 — session management
- `bcryptjs` ^2 — password hashing (pure JS, no native build step)
- `@types/bcryptjs` (devDependency)

---

## 6. Prisma / Schema Impact

### Phase 1: NO schema migration required

The `User` model already exists in the schema. We simply don't use it in Phase 1 — admin identity lives in env vars. No new models, no new columns, no migration.

### Phase 2 (future — requires Rahul approval before implementation)

When multi-user support or stronger audit trails are needed:

**Migration: seed admin User row**

```prisma
// No new model needed — User already exists:
// model User { id, email, name, approvals, auditLogs }

// Need to add: password hash field, last login, role
model User {
  // ... existing fields ...
  passwordHash  String?           // bcrypt hash — nullable for OAuth users
  role          String   @default("admin")   // "admin" | "viewer" (future)
  lastLoginAt   DateTime?
}
```

**Migration: AuditLog change** — `userId` already exists as nullable FK. Populating it just requires passing the session user's DB id.

**Migration: Session table (optional)** — `iron-session` is stateless (no DB session store). If server-side session revocation is required (e.g. "force logout all"), add a `Session` model. Not needed for Phase 1.

---

## 7. Test Plan

### New tests needed

| Test file | What to cover |
|---|---|
| `src/lib/__tests__/session.test.ts` | `getSession` returns null without cookie; returns session data with valid cookie; rejects tampered cookie |
| `src/lib/__tests__/authHelpers.test.ts` | `getAuditActor` returns username from session; returns 'unknown' without session; `loginRateLimit` blocks after 5 attempts |
| `src/app/api/auth/login/__tests__/route.test.ts` | 200 on valid credentials; 401 on wrong password (same message as wrong username); 401 on missing fields |
| `src/app/api/auth/logout/__tests__/route.test.ts` | Clears session cookie |
| `src/middleware.test.ts` (update) | Page request without session → redirect; API request without session → 401; `/login` always allowed; `/api/auth/*` always allowed |

### Existing tests to update

- `src/lib/__tests__/githubPRRefresh.test.ts` — mock session in handler tests
- Any test that calls API route handlers directly will need a mock session injected

### Key test invariant

All tests that currently exercise API routes without auth must either:
1. Pass through a mock session object, OR
2. Be updated to assert that unauthenticated requests correctly return 401

---

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `SESSION_SECRET` accidentally committed to git | Critical | Add to `.gitignore` check; document in `.env.example` only; never default to a weak value |
| `ADMIN_PASSWORD_HASH` not set — app breaks for operators | Medium | Env-gate: if `ADMIN_PASSWORD_HASH` is unset, middleware skips auth check entirely (local dev escape hatch). Document clearly. |
| Logout CSRF attack (POST logout forged from another site) | Low | `SameSite=Lax` blocks cross-site POSTs. For additional protection: require `Origin` header validation on logout. |
| `next` redirect parameter open redirect | Medium | Validate `next` parameter is same-origin before using. Reject any value starting with `//` or containing `://`. |
| Session fixation | Low | `iron-session` generates a new encrypted token on every login. No server-side session ID to fixate. |
| bcrypt timing on login | Low | `bcryptjs.compare` is constant-time by design. |
| Existing governance key weakened | None | Governance key check is kept and runs after session check. Both layers remain active. |
| Phase 1 admin has no DB User row — `Approval.approverId` stays null | Low/Acceptable | Known limitation for Phase 1. Documented. Phase 2 adds DB user seed. |
| Tests break after auth added to API routes | Medium | All existing route handler tests must be updated to inject mock sessions. Plan for test-update PR alongside or immediately after auth PR. |

### Rollback plan

Auth is env-gated: if `ADMIN_PASSWORD_HASH` is removed from the server environment, the middleware auth check is bypassed and the app returns to its current unauthenticated state. No DB migration means no schema rollback needed. Rollback = remove three env vars from the server.

---

## 9. Recommended PR Sequence

### PR A — `feat(auth): iron-session scaffold + admin login` *(autonomous-eligible after Rahul approves design)*

**Scope:** New files only + env.example update  
- Add `iron-session`, `bcryptjs`, `@types/bcryptjs` to `package.json`
- `src/lib/session.ts` — session types, getSession, requireSession
- `src/lib/authHelpers.ts` — getAuditActor, login rate limit
- `src/app/login/page.tsx` — login form
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `.env.example` — document new vars
- Tests for new files

**Does NOT yet change middleware or existing routes.** Auth exists but is not enforced.  
**Risk:** Low — additive only.

---

### PR B — `feat(auth): enforce session in middleware + inject actor in audit logs` *(autonomous-eligible)*

**Scope:** Middleware + all 14 API route files  
- Expand middleware matcher; add session check; public allowlist for `/login`, `/api/auth/*`
- Add `requireSession` call to top of each API handler
- Add `actor` to every audit log `details` JSON
- Fix `approvedBy` in instruction PATCH to come from session
- Update existing route handler tests to inject mock session

**Risk:** Medium — first PR that enforces auth. Must be tested with `ADMIN_PASSWORD_HASH` set in test env.

---

### PR C — `feat(auth): user indicator in sidebar layout` *(autonomous-eligible)*

**Scope:** UI only  
- Update `src/app/layout.tsx` to show logged-in user
- Update `src/components/SidebarNav.tsx` with logout button

**Risk:** Low — UI only, no logic.

---

### PR D (Phase 2, future) — `feat(auth): DB user seed + populate AuditLog.userId` *(requires Rahul approval)*

**Scope:** Schema migration  
- Add `passwordHash`, `role`, `lastLoginAt` to `User` model
- Prisma migration
- Seed admin User row on first login
- Populate `AuditLog.userId` from session

**Risk:** Medium — first DB migration touching User model.

---

## 10. What Requires Rahul Approval Before Implementation

| Decision | Why Rahul must decide |
|---|---|
| **Approve this design document** | All subsequent auth PRs are blocked on this |
| **Confirm `ADMIN_USERNAME` value** | Must match what Rahul will use to log in |
| **Set `ADMIN_PASSWORD_HASH` in server env** | Only Rahul should generate and set the password hash — never the autonomous agent |
| **Set `SESSION_SECRET` in server env** | Secret generation and deployment is a security operation |
| **Confirm `SESSION_MAX_AGE_HOURS`** | 8h default — adjust to Rahul's working preference |
| **Phase 2 approval** (PR D above) | DB schema migration and multi-user model require explicit sign-off |
| **Any future RBAC or second user** | Scope expansion beyond single-admin requires design review |

---

## 11. What Can Be Autonomous (After Rahul Approves Design)

Once this document is approved and env vars are set by Rahul in the server environment, the following can proceed without further approval:

- ✅ Implement PR A (new auth files, no enforcement yet)
- ✅ Implement PR B (middleware + audit actor injection)
- ✅ Implement PR C (UI user indicator)
- ✅ Update all tests for auth
- ✅ Update `.env.example` (documentation only — not `.env`)
- ✅ Write bcrypt hash generation instructions (not generate the actual password)
- ❌ **Cannot:** Set or read actual secrets/env values
- ❌ **Cannot:** Deploy to DEV/prod
- ❌ **Cannot:** Implement Phase 2 schema migration without separate approval
- ❌ **Cannot:** Add second user or role system

---

## 12. Open Questions for Rahul

1. **Password generation:** Should the autonomous agent generate a suggested password and output its bcrypt hash (hash only, never plaintext), or do you prefer to generate and hash the password yourself?
2. **Session duration:** 8 hours default — is this suitable, or do you want longer (e.g. 24h for a persistent dev workstation) or shorter?
3. **Escape hatch:** Should the app remain accessible without auth when `ADMIN_PASSWORD_HASH` is unset (local dev convenience), or should missing env vars cause a startup error?
4. **Login UI:** Minimal styled form matching the existing design system, or placeholder only for now?
5. **Governance key + session:** Currently the governance key gates all API calls. With user sessions, should the governance key be retired (it's redundant), kept as a machine-to-machine key alongside browser sessions, or made optional-but-separate?

---

## Appendix A: bcrypt Hash Generation (for Rahul)

To generate `ADMIN_PASSWORD_HASH` without the autonomous agent seeing the password:

```bash
# Run this locally on your machine — never in the repo environment
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('YOUR_CHOSEN_PASSWORD', 12).then(h => console.log(h));
"
```

Copy the output (starts with `$2b$12$...`) into your server `.env` as `ADMIN_PASSWORD_HASH`. Discard the plaintext password from your terminal history.

---

## Appendix B: Package Footprint

| Package | Size | Purpose |
|---|---|---|
| `iron-session` | ~15 kB | Stateless encrypted session cookie |
| `bcryptjs` | ~30 kB | Password hashing (pure JS, no native build) |
| `@types/bcryptjs` | dev only | TypeScript types |

No new native dependencies. No database session table. No third-party auth service.

---

*This document is design-only. No code has been changed. Implementation begins after Rahul approves the design and sets the required env vars on the target server.*
