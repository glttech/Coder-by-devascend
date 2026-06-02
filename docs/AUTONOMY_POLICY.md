# Autonomy Policy

## Guiding Principle

The orchestrator operates on a trust gradient. The lower the risk and the closer to local development, the more autonomy is allowed. The closer to production, the more Rahul must be in the loop.

When in doubt: stop and ask. Never guess. Never proceed on ambiguous input.

---

## What the Agent Can Do Without Rahul

These actions require no Rahul approval and can proceed automatically once conditions are met:

| Action | Conditions Required |
|--------|-------------------|
| Generate a structured prompt from task config | Task created and validated |
| Compute risk flags from agent output | Risk analyzer runs automatically |
| Compute missing evidence | Evidence checker runs automatically |
| Compute decision code | Decision engine runs automatically |
| Create Instruction in `draft` status | Any task |
| Transition Instruction `draft → pending_approval` | Any draft instruction |
| Create AuditLog entries | Always, on all writes |
| Import PR diff + CI status from GitHub | Phase 2: after GitHub connection configured |
| Run build + test + typecheck commands locally | environment = 'local' or 'dev' only |
| Record AgentRun + Evaluations | Any task |
| Update OperatorSession step count | Any session update |
| Poll DEV health endpoint | Phase 3: environment = 'local' or 'dev' only |

### Auto-Approve Conditions (Phase 4 only)

Auto-approval (no Rahul click required) is allowed ONLY when ALL of the following are true:

1. `autonomyLevel = 'auto'` on the project
2. `environment` is in `allowedAutoEnvs` (default: local, dev)
3. `riskLevel` ≤ `maxAutoRiskLevel` (default: low)
4. Decision engine returned `CONTINUE`
5. `requireCIGreen = true` → all CI checks passed
6. `requireDevValidated = true` (if set) → DEV health check returned 200
7. No red-line flags triggered (see red lines section)
8. All Instructions for the task are in `completed` or `approved` state
9. No `BLOCKED` or `SENIOR_APPROVAL_REQUIRED` decision in the last 3 operator sessions

If any condition fails → task goes to Rahul review queue.

---

## What Requires Rahul Approval

| Action | Why |
|--------|-----|
| Approve or reject a task | Core governance gate |
| Transition instruction `pending_approval → approved` | Human decision required |
| Transition instruction `approved → executing` | Signals agent can proceed |
| Mark instruction `blocked` | Requires blockedReason + human judgment |
| Merge a GitHub PR | Production-like impact |
| Trigger a staging deployment | Environment risk |
| Trigger a production deployment | Always — no exceptions |
| Run any database migration | Schema risk |
| Override a BLOCKED decision | Explicit human override required |
| Override a SENIOR_APPROVAL_REQUIRED decision | Explicit human override required |
| Change project autonomy policy | Policy configuration is sensitive |
| Add or change red-line rules | Security configuration |
| Configure GitHub App credentials | Credential management |
| Rotate or change any secret | Credential management |

---

## What Is Forbidden (Red Lines)

These actions cannot be performed by the orchestrator under any circumstances, regardless of policy or instruction:

### Absolute Bans
- Execute any command in `environment = 'production'`
- Execute any command in `environment = 'staging'` unless Rahul explicitly enables it per task
- Run `DROP TABLE`, `prisma migrate reset`, or any destructive DDL
- Run `rm -rf` or equivalent destructive filesystem command
- Run `git push --force` on any protected branch
- Print, log, copy, commit, or transmit any secret value (API keys, DB URLs, credentials)
- Read or write `.env`, `.env.local`, `.env.production` files
- Modify any authentication, CORS, CSRF, JWT, or OAuth configuration without CISO flag + senior approval
- Create, modify, or delete GitHub App credentials
- Auto-approve any task where `riskFlags includes 'secrets-exposure'`
- Auto-approve any task where `riskFlags includes 'destructive-command'`
- Auto-approve any task where `riskFlags includes 'database-migration'`
- Bypass the approval state machine (direct DB writes to Approval table are blocked)
- Delete AuditLog records (no DELETE route exists or will exist)

---

## Safe Auto-Merge Rules (Phase 4+)

An agent-created PR may be auto-merged without Rahul's click ONLY when:

1. All CI check_runs pass (no failures, no pending)
2. No failing evaluations on the AgentRun (all 8 heuristic checks pass)
3. Decision engine returned CONTINUE on the latest OperatorSession
4. Risk flags are empty
5. `environment` is `local` or `dev`
6. `riskLevel` is `low`
7. No files matching these patterns were modified:
   - `*.env*`, `.env*`
   - `prisma/migrations/*`
   - `*middleware*`
   - `*auth*`, `*oauth*`, `*jwt*`, `*session*`
   - `docker-compose*`, `Dockerfile*`, `.github/workflows/*`
   - `package.json`, `package-lock.json` (if deps changed)
8. `autoMergeEnabled = true` on the project config
9. Task has an Approval record with `approved = true`

If any condition fails → PR stays as draft, queued for Rahul review.

---

## Safe DEV Deploy Rules (Phase 3+)

A DEV deployment may be triggered automatically after task approval ONLY when:

1. `environment = 'local'` or `environment = 'dev'`
2. `deployCommand` is defined on ProjectConfig
3. Task has `Approval.approved = true`
4. No BLOCKED decision in the task's OperatorSessions
5. Build command exited 0
6. Test command exited 0

After deployment:
- Health endpoint polled (max `healthTimeoutSeconds`)
- Docker logs captured (last 100 lines) and stored in AgentRun.testResult
- If health check fails → AuditLog entry, task flagged for Rahul review, NO further automation

---

## Production Stop Rules

The orchestrator must STOP and require explicit Rahul action whenever:

| Trigger | Required Action |
|---------|----------------|
| `environment = 'production'` on any task | Rahul must explicitly approve AND confirm in separate step |
| `riskFlags includes 'production-environment'` in agent output | BLOCKED — Rahul must review before any next step |
| Health check returns non-200 for DEV | Stop automation, notify Rahul |
| Any CI check fails on a task targeting staging/production | Stop, require Rahul review |
| Any migration detected in agent output | Stop, separate migration approval required |
| Secret detected in diff | BLOCKED unconditionally, notify Rahul with file path (never value) |
| `GOVERNANCE_API_KEY` is present and request is unauthenticated | 401, logged to AuditLog |

---

## Secret Handling Rules

These rules apply to the orchestrator itself, to all agents it dispatches, and to all humans using it:

1. Never print secret values in any log, UI, response body, or AuditLog detail
2. Never include secret values in commit messages, PR bodies, or GitHub comments
3. Never include secret values in test fixtures, mock data, or seed scripts
4. Check only whether a required env var is set (non-empty check), never its value
5. If a secret appears in a git diff → STOP immediately, report the FILE PATH ONLY (never the value), do not push, do not create PR
6. Secrets are read from environment variables at runtime only
7. Secret rotation is always a manual Rahul operation — the orchestrator never rotates secrets
8. `webhookSecret` for GitHub webhook validation is encrypted at rest — never returned by any API

---

## Database / Migration Rules

Database schema changes are categorized separately from code changes and require elevated scrutiny:

| Action | Policy |
|--------|--------|
| `prisma migrate dev` | FORBIDDEN in automation — always manual |
| `prisma migrate reset` | FORBIDDEN unconditionally |
| `prisma db push` | FORBIDDEN in automation — always manual |
| `ALTER TABLE` in any agent output | Triggers `database-migration` risk flag → BLOCKED |
| New model added to schema.prisma | Requires manual review, migration must be reviewed separately |
| Field renamed or removed | Requires Rahul review + manual migration |
| Index added to existing table | Requires review (locking risk on large tables) |
| Seed data changes | Low risk, but must not run against production |

---

## Agent Execution Autonomy Matrix

| Scenario | Risk | Auto? | Notes |
|----------|------|-------|-------|
| Generate/copy prompt | None | Yes | Always safe |
| Record manual agent response | None | Yes | Paste-in only |
| Compute risk flags | None | Yes | Read-only heuristic |
| Create draft instruction | Low | Yes | No execution |
| Import PR evidence from GitHub | Low | Yes | Read-only API |
| Run tests locally | Low | Yes (dev only) | Build validation only |
| Auto-approve low-risk DEV task | Low | Yes (if policy=auto) | All conditions must pass |
| Approve instruction (pending → approved) | Medium | No | Rahul click required |
| Run DEV deploy command | Medium | Yes (dev only) | Phase 3, health check required |
| Merge GitHub PR | Medium | No (Phase 4 only) | All auto-merge conditions required |
| Run any staging operation | High | No | Rahul must explicitly enable per task |
| Any production operation | Critical | Never | Hard block |
| Database migration | Critical | Never | Hard block |
| Secret modification | Critical | Never | Hard block |
