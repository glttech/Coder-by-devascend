# Agent Context Index

Quick-start reference for Claude Code sessions in this repository.
Read this file at the start of every session before touching any code.

---

## What This Product Is

**Devascend AgentOps Platform** — two commercial modules on one shared governance foundation:

- **Coder by Devascend** — AI coding-agent governance: policy gates, approval gates, PR control, audit evidence, sandbox replay, developer reporting.
- **SOC by Devascend** — Security operations: alert intake (Wazuh, Sentry, manual), AI triage, incident lifecycle, severity scoring, CEO/CISO reports.

The shared platform provides: RBAC, audit log, approval workflow, evidence layer, webhooks, org/multi-tenancy, rate limiting, reports.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict mode — no `any`) |
| Database | PostgreSQL 15 via Prisma 5 |
| Auth | iron-session v8 (sealed cookie) |
| Test runner | `tsx --test` (Node native, not Jest) |
| CSS | Custom CSS variables (no Tailwind, no component library) |
| CI | GitHub Actions: typecheck → lint → test → build |

---

## Files to Read Before Editing Anything

| What you're changing | Read first |
|---|---|
| Any API route | `src/lib/rbac.ts`, `src/lib/session.ts` |
| Task-related anything | `src/app/api/tasks/route.ts`, `prisma/schema.prisma` → Task model |
| Policy/governance logic | `src/lib/policyGates.ts`, `src/lib/decisionEngine.ts` |
| Approval flow | `src/lib/approvalGuard.ts`, `src/app/api/approvals/route.ts` |
| Incident model | `src/lib/incidents.ts`, `prisma/schema.prisma` → Incident model |
| Audit anything | `src/lib/audit.ts` |
| SOC module | `docs/SOC_MODULE_TRD.md`, `docs/SOC_MODULE_PRD.md` |
| Schema additions | `docs/SOC_MODULE_TRD.md` → Schema section + existing `prisma/schema.prisma` |
| New routes | `src/middleware.ts` (understand public vs protected paths) |
| Navigation | `src/components/SidebarNav.tsx` |

---

## Non-Negotiable Patterns

### Every API route must follow this pattern:
```typescript
export async function GET/POST/PATCH(request: Request) {
  const user = await getCurrentUser();                    // 1. get user
  const auth = requireRole(user, 'admin' | 'reviewer' | 'any'); // 2. check role
  if (!auth.ok) return NextResponse.json({ error: '...' }, { status: auth.status });

  // 3. validate input (on mutations)
  // 4. DB query
  // 5. writeAudit() (on mutations — fire-and-forget)
  // 6. return response
}
```

### Audit logging is mandatory on every mutation:
```typescript
await writeAudit({
  event: 'event_name',          // snake_case, domain_action format
  taskId: task.id,              // include relevant FKs
  userId: currentUser?.userId ?? null,
  details: JSON.stringify({ ... }),
});
```

### Rate limiting on high-traffic POST routes:
```typescript
const ip = getClientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'));
const rl = checkLimit(_buckets, ip, 20);
if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
```

### Tests use Node native test runner (NOT Jest):
```typescript
import { describe, test, it } from 'node:test';
import assert from 'node:assert/strict';
// No expect(), no jest.fn(), no beforeEach — use node:test API
```

### Imports use `.js` extension (even for `.ts` files):
```typescript
import { requireRole } from '../rbac.js';   // ← .js not .ts
```

---

## Roles

| Role | Can do |
|---|---|
| `admin` | Everything: approve, create, delete, configure |
| `reviewer` | Read all, comment, cannot approve or mutate |
| `any` | Any authenticated user (pass 'any' to requireRole) |

Use `requireRole(user, 'admin')` for mutations that change state.
Use `requireRole(user, 'any')` for reads.

---

## Module Discriminator (Critical)

As of Phase 1, `Task.module` and `Incident.module` carry a `String?` field defaulting to `'coder'`.

**Rule:** All Coder features set `module = 'coder'`. All SOC features set `module = 'soc'`. Never query across modules without an explicit `module` filter.

---

## Schema Conventions

| Convention | Rule |
|---|---|
| Primary key | `id String @id @default(uuid())` |
| Timestamps | `createdAt DateTime @default(now())`; mutable models add `updatedAt DateTime @updatedAt` |
| Org scope | `orgId String` on all tenant-scoped models |
| Indexes | FK columns + `createdAt` always indexed |
| Migrations | Additive only; idempotent SQL where possible; never DROP TABLE or ALTER COLUMN type |
| Module scope | `module String? @default("coder")` on models shared between Coder and SOC |

---

## Route Namespacing

| Namespace | Owner |
|---|---|
| `/api/auth/` | Shared platform |
| `/api/orgs/`, `/api/users/`, `/api/keys/`, `/api/webhooks/`, `/api/notifications/` | Shared platform |
| `/api/tasks/`, `/api/projects/`, `/api/agent-runs/`, `/api/approvals/`, `/api/incidents/`, `/api/instructions/` | Coder module |
| `/api/soc/alerts/`, `/api/soc/incidents/`, `/api/soc/triage/`, `/api/soc/reports/`, `/api/soc/evidence/` | SOC module |

**Rule:** Never put SOC logic in Coder routes or vice versa. When in doubt, add to the module namespace.

---

## Hard Stops (Never Do Without Rahul's Approval)

1. Edit `.env*` files
2. Run migrations on any live database
3. Enable any `FEATURE_*` or `WEBHOOKS_ENABLED` env flag outside tests
4. Make real API calls to Wazuh, Sentry, Resend, Stripe, or any paid service
5. Send real emails or webhooks to real endpoints
6. Modify CI/CD pipeline config
7. Merge a PR with failing CI
8. Change SESSION_SECRET or any auth credential
9. Deploy to production
10. ALTER or DROP any existing DB column/table

---

## Key Feature Flags

| Flag | Default | Controls |
|---|---|---|
| `FEATURE_AGENT_LLM` | `false` | Real LLM calls in agent runs |
| `FEATURE_RAG_EMBED` | `false` | Real embedding API calls |
| `WEBHOOKS_ENABLED` | `false` | Outbound webhook delivery |
| `FEATURE_SOC_AI_TRIAGE` | `false` | LLM-powered alert triage (planned) |

All flags checked via `src/lib/featureFlags.ts`. Never flip to `true` in any `.env` file without explicit approval.

---

## Testing Convention

- **Test directory:** `src/lib/__tests__/` (Coder), `src/lib/__tests__/soc/` (SOC)
- **Naming:** `featureName.test.ts`
- **Run all tests:** `npm test`
- **New feature = new test file** — no exceptions
- **No DB in unit tests** — mock Prisma if needed; pure logic tests preferred
- **CI must be green before merge**

---

## PR Convention

| Field | Convention |
|---|---|
| Branch | `feat/short-description` from `claude/setup-coder-repo-XFuyw` |
| Title | `feat(scope): description` or `fix(scope): description` or `docs: description` |
| Size | One logical change per PR |
| Merge | Squash merge only |
| CI | Must be green before merging |

---

## Quick Reference: Where Things Live

| Question | Answer |
|---|---|
| "How do I check if the user is an admin?" | `const auth = requireRole(user, 'admin'); if (!auth.ok) return 401/403` |
| "How do I log an audit event?" | `await writeAudit({ event: 'x', taskId, userId, details: JSON.stringify({}) })` |
| "How do I add a new SOC route?" | Create under `src/app/api/soc/`, add test under `src/lib/__tests__/soc/` |
| "What does the Task schema look like?" | `prisma/schema.prisma` → `model Task` |
| "Where is the policy evaluation?" | `src/lib/policyGates.ts` → `evaluatePolicy()` |
| "Where are agent run decisions made?" | `src/lib/decisionEngine.ts` → `makeDecision()` |
| "How do I add a webhook event?" | `src/lib/webhookDelivery.ts` → add to `WebhookEvent` union + call `triggerWebhooks()` |
| "How do I add a navigation item?" | `src/components/SidebarNav.tsx` |
| "What env vars exist?" | `.env.example` |
| "What PRs have been merged?" | `docs/AGENTOPS_CURRENT_STATE_AND_EXECUTION_PLAN.md` → merge train section |

---

*Updated: 2026-06-20. Keep this file current whenever architectural patterns change.*
