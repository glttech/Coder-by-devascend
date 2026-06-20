# Product Roadmap — Coder by DevAscend

**Last updated:** 2026-06-19  
**Current branch:** main (all Phase 3 PRs #176–#183 merged; security/quality PRs #184–#192 open)

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| [x] | Built and tested |
| [~] | Partial — schema/API exists, UI limited |
| [ ] | Planned — not started |
| [!] | Being built now (active sprint) |

---

## Phase 1 — Useful Manual Orchestrator
**Status: COMPLETE (commit e37b507, PR #29)**

[x] Task intake with risk/env/agent config, 5 presets  
[x] Structured 8-section prompt generator with environment guards  
[x] Agent run recording with 8-point heuristic evaluation  
[x] Risk analyzer (7 flags, negation-stripping)  
[x] Evidence checker (5 evidence types)  
[x] Decision engine (5 decision codes)  
[x] Next-prompt generator  
[x] Instruction lifecycle state machine (6 states)  
[x] SHA256 stateVersion for optimistic concurrency  
[x] Approval gate (atomic, concurrent-safe)  
[x] GOVERNANCE_API_KEY middleware guard  
[x] Input length validation  
[x] Full AuditLog on all transitions  
[x] Dashboard with governance health  
[x] Pending approvals queue  
[x] Evidence report per task  
[x] 124 passing tests  

---

## Phase 2 — GitHub-Aware Orchestrator
**Status: SUBSTANTIALLY COMPLETE (PRs #29 through #168)**

### Built
[x] Project registry with GitHub metadata (repoOwner, repoName, branch, PAT)  
[x] GitHub REST API client (`src/lib/githubClient.ts`)  
[x] PR import by URL or owner/repo/number  
[x] Incremental PR sync with delta detection  
[x] Full PR history import (`FullSyncButton` + `fullSync` flag)  
[x] Deterministic PR classification (10 types, no LLM)  
[x] Bug state detection (4 states from title/labels/files)  
[x] PR memory search  
[x] PR timeline grouped by week/day/milestone  
[x] Policy gate evaluation per task (`evaluatePolicy`)  
[x] AI Change Control Pack (evidence API + page per task)  
[x] Sandbox Replay (sandboxPlan, approve/reject, preview mode)  
[x] Incident model, API, page, and nav  
[x] Agent Scorecard (provider scorecard page + API)  
[x] Client Report Templates (task and project report APIs)  
[x] GitHub OAuth + iron-session auth  
[x] Role-based access control  
[x] API keys with SHA-256 hashing  
[x] HMAC-signed outgoing webhooks  
[x] SSE real-time events  
[x] Execution trace (append-only)  
[x] Mermaid diagram generation + SVG export  
[x] Multi-agent orchestration framework (7 built-in governance roles)  
[x] LLM integration behind `FEATURE_AGENT_LLM=false`  
[x] Audit log export (CSV)  
[x] Share links for governance reports  
[x] Task clone, bulk ops, comments, PDF export  
[x] Notification preferences  

### Partial
[~] Task linking to PRs (manual PATCH only — auto-link deferred to Phase 4)  
[x] Agent run linking to PRs — auto-link with scored discovery (PR #185)  
[~] Multi-org support (schema and API exist, UI limited)  
[~] CI Dashboard (route + schema exist, UI partial)  
[~] Billing / usage tracking (schema + usage API; no payment gateway)  

### Not started in Phase 2
[ ] GitHub webhooks for incoming push events — moved to Phase 3  
[ ] Real-time sync via websocket/SSE for PR updates  
[ ] LLM-powered PR summaries (gated behind `FEATURE_REPO_MEMORY_LLM=false`)  

---

## Phase 3 — PR Intelligence & Governance Visualization
**Status: COMPLETE (PRs #176–#183, merged 2026-06-19, 1328+ tests passing)**

### Built and merged
[x] Repository Intelligence API (`GET /api/projects/[id]/intelligence`)  
[x] Governance Timeline API (`GET /api/projects/[id]/governance-timeline`)  
[x] `FullSyncButton` component for full PR history import  
[x] Sync progress polling endpoint (`GET /api/github-prs/sync-status`)  
[x] FullSyncButton live progress bar (polls PrSyncState every 2 seconds)  
[x] Agent role-scoped dashboard views (AGENT / SENIOR / ADMIN)  
[x] Policy risk dashboard (`/projects/[id]/policy`)  
[x] Risk rule reference UI (browsable rule descriptions)  
[x] Sandbox replay comparison and what-if analysis panel  
[x] Incident postmortem view (`/incidents/[id]/postmortem`)  
[x] Change control dashboard (`/projects/[id]/change-control`)  
[x] Executive dashboard (`/executive` — ADMIN/SENIOR only)  
[x] System status page (`/status`)  
[x] Admin settings page (`/admin/settings`)  
[x] Onboarding page (`/onboarding`)  
[x] Demo showcase page (`/demo`)  
[x] Rate limiting on 4 mutation endpoints (feat/rate-limit-mutations)  
[x] Product documentation (ARCHITECTURE.md, DECISIONS.md, KNOWN_LIMITATIONS.md, EXECUTION_LOG.md)  

### Phase 3 deferred items (status as of 2026-06-19)
[x] Auto-link agent runs to PRs — SHA match + time proximity + branch keyword scoring (PR #185)  
[x] Outbound HMAC-signed webhook delivery — 10 event types, auto-disable on failure (PR #191)  
[ ] Auto-link PRs to tasks by branch name match (carry to Phase 4)  
[ ] LLM-powered PR summaries (`FEATURE_REPO_MEMORY_LLM=true`) (carry to Phase 4)  
[ ] GitHub webhooks (incoming push/PR events) — HMAC-verified receiver (carry to Phase 4)  
[ ] Real-time PR sync (SSE push on webhook receipt) (carry to Phase 4)  
[ ] CI Dashboard — complete the UI (carry to Phase 4)  
[ ] Multi-org UI — complete member management (carry to Phase 4)

---

## Phase 4 — Semi-Autonomous Sub-Agent Workflow
**Status: NEXT — NOT STARTED**
**Estimated start:** Q3 2026 (Phase 3 is now stable on main)

[ ] Autonomy policy engine — per-project auto-approve rules  
[ ] Sub-agent role dispatch (CTO / CISO / QA / DevOps / Docs)  
[ ] Exception queue — surface only BLOCKED + SENIOR_APPROVAL tasks  
[ ] Real agent dispatch via Claude Code CLI or API  
[ ] Full Langfuse trace logging (currently console stub)  
[ ] Rate limiting on all read endpoints (mutation endpoints done in Phase 3)  
[ ] Background job system for PR sync (removes HTTP blocking limitation)  
[ ] Database connection pooling (PgBouncer or Prisma Accelerate)  

**Estimated timeline:** 6–8 weeks. High risk items (real agent dispatch, autonomy policy) require careful testing before enabling.

---

## Phase 5 — Production-Grade Governance
**Status: NOT STARTED**
**Estimated start:** Q4 2026 (do not start before Phase 4 is stable)

[ ] Production deployment gate (full evidence chain required)  
[ ] Database migration gate (separate approval workflow)  
[ ] Secret rotation detection in PR diffs  
[ ] Physical AuditLog immutability (PostgreSQL row-level security)  
[ ] Rate limiting on all endpoints  
[ ] Multi-org isolation enforcement at database level  
[ ] Staging environment support  

**Estimated timeline:** 8–12 weeks. Most items are security-critical and require independent review before shipping.

---

## Permanently Out of Scope

- GitLab integration (no plans)  
- Public multi-tenant SaaS (not the product)  
- Mobile app  
- Automated production deployments  

---

## Dependency Map

```
Phase 1 (done)
  └── Phase 2 (substantially done)
        └── Phase 3 (active) ─── auto-link ─── Phase 4 (webhooks needed)
              └── Phase 4 (semi-autonomous) ─── Phase 5 (prod gate)
```

Phase 5 production gating requires Phase 3 intelligence + Phase 4 autonomy to be stable first.
