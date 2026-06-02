# Security Gap Analysis

**Date:** 2026-06-02  
**Reviewed against:** main @ e37b507

---

## Summary

The app has a solid security foundation for a Phase 1 internal tool: input validation, an API key guard, an atomic approval gate, and an immutable audit log. The biggest unresolved gap is browser authentication — the UI is completely unauthenticated in the browser. This is acceptable for local-only use but must be closed before the app is exposed to any network.

---

## Auth Gaps

### H1 — Browser UI Has No Authentication
**Severity:** High  
**Location:** All `src/app/**/page.tsx` routes  
**Finding:** The GOVERNANCE_API_KEY middleware guard applies only to `/api/*` routes. All browser-facing pages (`/`, `/tasks`, `/tasks/new`, `/tasks/[id]`, etc.) are unprotected. Anyone with HTTP access to the server can view and use the full UI.  
**Impact:** A malicious actor on the same network can approve tasks, create fake agent runs, view all project data, and read the full audit log.  
**Fix:** Add Next.js session auth (e.g., iron-session or next-auth with GitHub OAuth). Redirect unauthenticated requests to a login page. Extend middleware matcher to cover all routes, not just `/api/*`.  
**Priority:** Must fix before any network exposure beyond localhost.

### L5 — approverId Never Set
**Severity:** Low  
**Location:** `src/app/api/approvals/route.ts`  
**Finding:** The `Approval.approverId` field exists in the schema but is never populated. All approval records show `approverId: null`.  
**Impact:** Audit trail cannot identify who approved a task. In a single-user setup this is acceptable; it becomes a gap in any multi-user or regulated context.  
**Fix:** Populate `approverId` from the authenticated session once H1 is closed.

### L6 — AuditLog userId Never Populated
**Severity:** Low  
**Location:** All `prisma.auditLog.create()` calls  
**Finding:** `userId` in AuditLog is always null because there is no session to extract it from.  
**Fix:** Same as L5 — populate from session after H1 is closed.

---

## Approval Bypass Risks

### Assessment: Low (after PR #29)

The approval gate was previously vulnerable to a TOCTOU race condition (two concurrent requests could both pass the `findUnique → guard → upsert` check). This was fixed in PR #29 with:
- `create()` using the unique constraint as an atomic serialization point
- `updateMany({ where: { taskId, approved: null } })` as the conditional update
- `count === 0` → 409 (already decided)

Remaining concern: the `checkApprovalAllowed` guard reads task state before the write. A task status change (e.g., concurrent `task.status = 'completed'`) could technically slip between the read and write. This is a low-probability edge case since task status changes are rare and orchestrated. A full fix would require a database-level check constraint or a serialized transaction. Acceptable risk for Phase 1.

---

## Prompt Injection Risks

### M-PI1 — Agent Response Pasted Into Analysis Functions
**Severity:** Medium  
**Location:** `src/app/api/operator-sessions/route.ts`, `src/lib/riskAnalyzer.ts`  
**Finding:** The `agentResponse` field is pasted in by the user and then analyzed by `analyzeRisk()`. A malicious agent (or a prompt-injected agent response) could craft text that manipulates the risk analysis output.  
**Example:** An attacker could include `No destructive commands run. No production touched.` to suppress real risk flags (the negation stripper was added to combat this, but it may not cover all bypass patterns).  
**Mitigation in place:** `stripNegatedClauses()` removes common false-negative patterns.  
**Remaining risk:** Sophisticated negation patterns not covered by the current regex strip.  
**Recommended fix:** Add more aggressive negation stripping patterns and fuzz-test the risk analyzer with adversarial inputs.

### M-PI2 — nextPrompt Contains User-Supplied Content
**Severity:** Medium  
**Location:** `src/lib/nextPromptGenerator.ts`  
**Finding:** The generated next prompt includes `agentResponse` excerpts and `filesMentioned` / `commandsMentioned` arrays. If these contain crafted content, the next prompt could instruct a following agent to take unsafe actions.  
**Fix:** Sanitize/truncate all user-supplied fields before embedding them in generated prompts. Add a max-length cap on any injected snippet.

---

## Secret Exposure Risks

### Assessment: Low (current state)

- No secrets are committed to the repository (confirmed via diff review)
- `langfuse.ts` and `openSweAdapter.ts` are stubs — no real credentials used
- The `secretsExposure` risk flag in the analyzer detects `sk-*`, `pk-*`, `api_key`, `.env` patterns in agent output
- Input to `/api/operator-sessions` is validated for max length (50,000 chars)

### Remaining Risk: M-SE1 — No Diff Scan on AgentRun.filesChanged
**Severity:** Medium  
**Location:** `src/app/api/runs/route.ts`  
**Finding:** `filesChanged` is stored as a free-text field. If an agent includes a secret in its `filesChanged` output, it would be stored in the DB without detection.  
**Fix (Phase 2):** When GitHub PR diff is auto-imported, scan the diff for secret patterns before storing.

### L-SE2 — webhookSecret (Phase 2) Must Never Be Logged
**Severity:** Low (not yet implemented)  
**Note:** When GitHub webhooks are added, the `webhookSecret` must never appear in AuditLog details, request logs, or error messages. It should be stored encrypted in the DB and only used for HMAC comparison.

---

## Audit Log Gaps

### Current Gaps

| Gap | Impact |
|-----|--------|
| No userId on any AuditLog entry | Cannot attribute actions to a person |
| No approverId on Approval | Cannot prove who approved |
| AuditLog.details is a raw JSON string | Hard to query specific fields |
| No AuditLog for task creation | Task creation is not audited |
| No AuditLog for AgentRun creation | Agent runs are not audited |
| No AuditLog for project creation/update | Project config changes not tracked |
| No tamper detection on AuditLog | Log could be modified directly in DB |

### Recommended Fixes
1. Add AuditLog on task creation (low effort, high value)
2. Add AuditLog on AgentRun creation (low effort)
3. Add structured JSON fields to AuditLog.details (medium effort — query improvement)
4. After auth is added (H1): populate userId on all events

---

## Rate Limiting Gaps

### M2 — No Rate Limiting on Any Endpoint
**Severity:** Medium  
**Location:** All `src/app/api/**/route.ts`  
**Finding:** There are no rate limits on any API endpoint. The following endpoints are particularly sensitive:
- `POST /api/operator-sessions` — triggers risk analysis; in Phase 4, will trigger real LLM calls
- `POST /api/runs` — stores potentially large agentResponse payloads (up to 50,000 chars)
- `POST /api/approvals` — approval decisions should not be spammable

**Risk now:** Low (internal tool, no public network exposure expected)  
**Risk in Phase 4:** High (automated agent dispatch without rate limits = unbounded LLM cost)  
**Fix:** Add per-IP or per-user rate limiting using Next.js middleware + in-memory or Redis counter.

---

## Agent Execution Risks (Phase 4+)

### H-AE1 — Prompt Injection via Task Instruction
**Severity:** High (Phase 4 risk)  
**Finding:** In Phase 4, the task `instruction` field is embedded in the generated prompt and sent to a real AI agent. A crafted instruction could override the safety constraints in the prompt.  
**Fix:** Add instruction sanitization before prompt embedding. Enforce max length (already done: 50,000 chars). Consider a pre-execution review step for any instruction that contains prompt-like patterns ("ignore previous instructions", "you are now", etc.).

### H-AE2 — deployCommand Injection
**Severity:** High (Phase 3 risk)  
**Finding:** `deployCommand` in ProjectConfig is a string that will be executed via shell. If this field is user-editable through the UI, a malicious value could execute arbitrary commands.  
**Fix:** Do not allow deployCommand to be set via API. Set it only via admin config or environment variable. Alternatively, restrict to a whitelist of allowed commands.

---

## GitHub Access Risks (Phase 2+)

### M-GA1 — GitHub Token Scope Creep
**Severity:** Medium  
**Finding:** If the GitHub App token is granted write scopes (PRs, issues, branches), a compromised orchestrator could merge PRs or create/delete branches without Rahul's knowledge.  
**Fix:** Use read-only scopes in Phase 2 (`contents:read`, `pull_requests:read`, `checks:read`). Only add write scopes in Phase 5 after the auth gap (H1) is closed.

### M-GA2 — Webhook Signature Not Yet Verified
**Severity:** Medium (Phase 2 risk)  
**Finding:** Webhook receiver does not yet exist. When implemented, it must verify the GitHub HMAC-SHA256 signature on every incoming request. Without this, anyone can POST fake CI/PR events to the orchestrator.  
**Fix:** Implement signature verification on `POST /api/webhooks/github` before processing any event.

---

## Recommended Fix Order

| Priority | ID | Fix | Effort |
|----------|----|-----|--------|
| 1 | H1 | Browser authentication (next-auth or iron-session) | Large |
| 2 | M2 | Rate limiting on mutation endpoints | Small |
| 3 | M-PI1 | Expand negation-stripping patterns, fuzz-test risk analyzer | Medium |
| 4 | M-GA2 | Webhook HMAC verification (implement before Phase 2 webhooks) | Small |
| 5 | M-PI2 | Sanitize user-supplied content before embedding in nextPrompt | Small |
| 6 | L5/L6 | Populate approverId + AuditLog userId after auth is added | Small |
| 7 | M-GA1 | Enforce read-only GitHub token scopes | Small |
| 8 | M-SE1 | Scan PR diff for secret patterns on import | Medium |
| 9 | H-AE2 | Restrict deployCommand to admin-only config | Small |
| 10 | H-AE1 | Instruction sanitization before agent dispatch | Medium |

Items 1–5 should be addressed before any network exposure beyond localhost. Items 6–10 are pre-requisites for Phase 3–4.
