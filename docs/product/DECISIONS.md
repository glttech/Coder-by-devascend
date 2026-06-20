# Architecture Decision Records — Coder by DevAscend

**Last updated:** 2026-06-19

Architecture Decision Records (ADRs) document significant technical choices, the alternatives considered, and the trade-offs accepted. These records exist so future contributors understand not just what was built but why.

---

## ADR-001: No LLM for PR Classification

**Status:** Accepted  
**Date:** 2026-06-03  

### Context

PR classification (categorising a pull request as `feature`, `bugfix`, `refactor`, etc.) is a core input to the governance timeline and repository intelligence features. Two approaches were viable: a deterministic rule engine or an LLM call.

### Decision

Use a **deterministic rule engine** (`src/lib/prClassifier.ts`). Rules inspect PR title patterns, label names, and changed file path prefixes to assign one of 10 types and a bug state.

### Reasons

- **Predictability:** The same PR always produces the same classification. Debugging is straightforward.
- **Zero API cost:** No LLM token spend per classification event. Large full-history syncs (hundreds of PRs) remain free.
- **Testability:** Rules can be unit-tested with fixed inputs. An LLM classifier would require snapshot testing or mock responses.
- **Speed:** Classification is synchronous and sub-millisecond. LLM latency would block the sync loop.

### Trade-offs Accepted

- No semantic understanding. A PR titled "polish the onboarding experience" is classified as `chore` by keyword, not understood as a `feature`. Misclassifications are possible.
- Rule maintenance burden: as new naming conventions emerge, rules need updating.

### Future Path

LLM-assisted re-classification can be added as an optional enrichment step (`FEATURE_REPO_MEMORY_LLM=true`) without changing the core pipeline.

---

## ADR-002: node:test Over Jest

**Status:** Accepted  
**Date:** 2026-05-21  

### Context

The project needed a test runner from day one. Jest is the most widely used JavaScript test framework, but it carries significant toolchain weight (Babel transform, module mocking infrastructure, large dependency tree).

### Decision

Use the **native Node.js test runner** (`node:test`). All test files use `import { describe, it } from 'node:test'` and `import assert from 'node:assert'`.

### Reasons

- **No extra dependencies:** `node:test` ships with Node.js 18+. Zero packages to install, zero version conflicts.
- **Fast startup:** No transform step, no loader overhead. The test suite starts in milliseconds.
- **Alignment with modern Node.js:** The native runner is actively maintained by the Node.js core team.
- **Simplicity:** For a project where tests are pure function tests and API integration tests, Jest's additional features (auto-mocking, snapshot testing) are not needed.

### Trade-offs Accepted

- Less ecosystem tooling (no built-in coverage UI, fewer community plugins).
- Some Jest-familiar patterns (`jest.fn()`, `jest.mock()`) are not available — manual stubs are used instead.
- Coverage reporting requires the `--experimental-test-coverage` flag.

### Consequence

All contributors must use `import { describe, it } from 'node:test'`. Jest patterns must not be introduced.

---

## ADR-003: iron-session Over JWT

**Status:** Accepted  
**Date:** 2026-05-21  

### Context

GitHub OAuth produces an access token. The application needs to remember the authenticated user across requests. Two standard patterns: stateless JWT tokens stored in localStorage/cookies, or server-side sessions with an encrypted cookie identifier.

### Decision

Use **iron-session** with an encrypted, HttpOnly, SameSite=Lax cookie. The session payload contains the user's database ID. No token is exposed to browser JavaScript.

### Reasons

- **Immediate logout:** Server-side session destruction works instantly. A JWT token, once issued, remains valid until expiry — there is no standard revocation mechanism for stateless JWTs without adding a blocklist (which reintroduces server state anyway).
- **No XSS attack surface:** HttpOnly cookies are inaccessible to JavaScript. A XSS payload cannot exfiltrate the session identifier.
- **Simplicity:** iron-session encrypts the cookie payload using AES-GCM. No key rotation ceremony, no JWKS endpoint, no token refresh flow.
- **Right fit for scope:** This is a team tool, not a public API that needs delegated token access. Server-side sessions are appropriate.

### Trade-offs Accepted

- Sessions require a shared secret (`SESSION_SECRET` env var). If the secret rotates, all existing sessions are invalidated.
- Horizontal scaling requires session secret consistency across instances (not a concern at current scale, but noted).
- API programmatic access uses separate SHA-256 API keys, not session cookies.

---

## ADR-004: No Background Job System

**Status:** Accepted (with documented limitation)  
**Date:** 2026-06-03  

### Context

Full PR history import (`fullSync: true`) fetches every PR from GitHub for a repository. For a repository with hundreds or thousands of PRs, this can take 10–60 seconds. Running this synchronously inside an HTTP request risks server timeout and blocks the request thread.

### Decision

Accept the synchronous model for Phase 3. Full sync **blocks the HTTP request**. The client polls `GET /api/github-prs/sync-status` to track progress via the `PrSyncState` record, which is updated incrementally as PRs are imported.

### Reasons

- **Phase 3 scope:** Introducing a background job system (BullMQ, pg-boss, or similar) is a significant infrastructure addition. It adds operational complexity (queue persistence, worker process management, failure handling) that is out of scope for Phase 3.
- **Polling is sufficient:** The `PrSyncState` record provides enough progress signal for the UI to show a live progress indicator without a persistent connection.
- **Practical limit:** Most project repositories have fewer than 500 PRs. Synchronous sync completes within acceptable time for this range.

### Mitigation

- The `FullSyncButton` component polls `GET /api/github-prs/sync-status` every 2 seconds and renders a live progress bar.
- The sync endpoint sets a generous server timeout.
- Users are warned in the UI that full sync may take time for large repositories.

### Future Path

Phase 4 will introduce a background job system. The sync logic is already isolated in a service function and can be moved to a worker with minimal refactoring.

---

## ADR-005: Squash Merge Policy

**Status:** Accepted  
**Date:** 2026-05-21  

### Context

The team uses feature branches and pull requests for all changes. Git history policy (merge commits vs. squash vs. rebase) affects auditability, bisect efficiency, and branch hygiene.

### Decision

**All PRs are squash-merged to main.** Each feature becomes one atomic commit on the main branch. The PR branch is deleted after merge.

### Reasons

- **Clean linear history:** `git log` on main is a concise record of features and fixes. Merge commits and intermediate WIP commits from the feature branch do not appear.
- **Atomic units:** Each commit on main is a complete, tested feature. `git bisect` operates on meaningful boundaries.
- **Simplicity:** No rebase discipline required of contributors. Squash merge is applied at merge time regardless of branch commit history.

### Trade-offs Accepted

- Individual commits within a PR branch are not preserved in main history. For detailed change archaeology, the PR itself (and its commits) must be consulted.
- Squash commit messages must be written carefully — they are the permanent record.

### Convention

Squash commit messages follow: `<type>(<scope>): <summary>` where type is one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

---

## ADR-006: No Schema Changes in PRs 177–183

**Status:** Accepted  
**Date:** 2026-06-19  

### Context

Phase 3 features (sync progress polling, agent role-scoped views, policy risk dashboard, sandbox replay comparison, incident postmortem, executive dashboard, onboarding) were delivered across PRs #177–#183 in a single intensive build period.

### Decision

**No new Prisma migrations were created** for PRs #177–#183. All features were implemented by querying existing schema fields in new combinations, adding UI pages, and extending API route logic.

### Reasons

- **Zero-downtime deployability:** Every PR is safe to deploy without a database migration step. There is no migration/code synchronisation risk.
- **Velocity:** Schema changes require migration review, potential downtime coordination, and rollback planning. Avoiding them allowed faster iteration.
- **Schema completeness:** The existing schema already contained all necessary fields. Creative querying (JOINs, aggregations, field reuse) was sufficient.

### Trade-offs Accepted

- Some fields are used in ways that were not their original intent. This is documented in code comments.
- Future features that genuinely require new fields will need migrations, and the accumulated "query creativity" may make those migrations slightly more complex to design cleanly.

---

## ADR-007: Server Components as Default

**Status:** Accepted  
**Date:** 2026-05-21  

### Context

Next.js 14 App Router introduces React Server Components (RSC) as the default. The alternative is to mark every component `'use client'` and revert to the Next.js 12 pages-router pattern of client-side data fetching.

### Decision

**Server components are the default.** Data-fetching pages and layout components are server components. Client components (`'use client'`) are used only where browser APIs or interactivity (event handlers, state, effects) are required.

### Reasons

- **Smaller JS bundle:** Server components produce zero client-side JavaScript. Pages that are primarily read-only (audit log, PR list, task detail) ship no component JS to the browser.
- **No loading waterfalls:** Data is fetched at render time on the server. The browser receives complete HTML, not a skeleton that triggers fetch requests.
- **Simpler auth:** Server components can read the iron-session cookie directly. Client components would need an additional API call to learn the current user.
- **Framework alignment:** Using RSC as intended avoids fighting the framework and keeps the codebase idiomatic for Next.js 14.

### Trade-offs Accepted

- Server components cannot use React hooks (`useState`, `useEffect`). Interactivity requires extracting a `'use client'` island component.
- Data fetched in server components is not cached by default unless explicitly using Next.js `fetch` cache options. Some pages re-fetch on every request — acceptable for a governance tool where stale data is a risk.
- Debugging server component errors requires reading server logs rather than browser devtools.

### Convention

File naming does not distinguish server/client components. The `'use client'` directive at the top of a file is the sole indicator that a component runs in the browser.

---

## ADR-008: Immutable AuditLog

**Status:** Accepted  
**Date:** 2026-05-21  

### Context

The governance model requires a trustworthy audit trail: every significant action (task creation, approval, state transition, policy evaluation) must be recorded and must not be modified or deleted after the fact.

### Decision

The `AuditLog` table is **INSERT-only by convention**. No application code performs `UPDATE` or `DELETE` on `AuditLog` rows. The `src/lib/audit.ts` module exposes only an `insertAuditLog()` function — no update or delete helpers exist.

### Reasons

- **Compliance suitability:** An append-only log satisfies the basic requirement of most audit frameworks (SOC 2, ISO 27001) for tamper-evident records.
- **Simplicity:** Enforcing immutability at the application layer is straightforward. No PostgreSQL row-level security configuration is required.
- **Developer clarity:** Having only one write operation (`INSERT`) eliminates any ambiguity about whether audit records can be corrected or retracted.

### Trade-offs Accepted

- **Convention, not enforcement:** There is no database-level constraint preventing an `UPDATE` or `DELETE` by a user with direct database access or by a future code path that bypasses `src/lib/audit.ts`. This is a known limitation documented in KNOWN_LIMITATIONS.md.
- Erroneous audit entries cannot be corrected. A compensating entry must be added instead.

### Future Path

Phase 5 includes PostgreSQL Row-Level Security (RLS) to enforce immutability at the database layer, removing reliance on application-layer convention.
