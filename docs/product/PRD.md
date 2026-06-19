# Product Requirements Document — AI Dev Orchestrator (Coder by DevAscend)

**Version:** 1.0  
**Date:** 2026-06-18  
**Branch:** feature/phase3-pr-intelligence  
**Status:** Living document — reflects what is built as of PR #175

---

## 1. Overview

Coder by DevAscend is a self-hosted AI engineering control room for solo engineers and small teams. It sits between AI coding agents (Claude Code, OpenClaw, Codex) and a team's production codebase, enforcing structured workflow, risk gating, evidence capture, and decision routing. No AI-generated change is blindly applied; every change has an audit trail.

The system is currently used by one primary operator (Rahul) and is not a multi-tenant SaaS product. It governs AI-assisted changes across multiple GitHub repositories from a single installation.

---

## 2. Problem Statement

Small engineering teams using AI coding tools produce code faster than any governance process can track. The resulting problems:

| Problem | Impact |
|---------|--------|
| No record of what the agent did or why it was accepted | Zero auditability — cannot reconstruct decisions |
| Risk in agent output is manually re-read each time | Inconsistent, reviewer-dependent risk detection |
| Approval gates are forgotten or skipped | Unsafe changes merged to production |
| No structured view of PR history across multiple repos | Blind spots in delivery pipeline |
| CI status, PR classification, and task management live in separate tools | Context-switching overhead, missed connections |
| No timeline connecting PRs to incidents or governance events | Cannot investigate what changed before an incident |

---

## 3. Target Users

**Primary:** Rahul — sole operator in the current phase. One engineer governing AI-assisted development across multiple personal and client repositories.

**Secondary (future):** Small teams of 2–10 engineers at startups or SMBs who use AI coding tools daily and have no formal review process for AI-generated output.

**Not the target (current phase):** Enterprise teams with dedicated security/compliance infrastructure, or teams not using AI coding tools at all.

---

## 4. Core Features

Status key: **Built** = implemented and tested | **Partial** = schema/API exists, UI limited | **Planned** = not started

### 4.1 Task & Agent Run Management

| Feature | Status | Notes |
|---------|--------|-------|
| Create tasks with risk level, environment, agent tool, approval flag | Built | 5 preset templates |
| Structured 8-section prompt generator | Built | Per environment, with STOP conditions |
| Agent run recording (paste-in) | Built | 8-point heuristic evaluation |
| Operator session: risk analysis, evidence check, decision engine | Built | 7 risk flags, 5 evidence types, 5 decision codes |
| Instruction lifecycle state machine | Built | 6 states, SHA256 optimistic concurrency |
| Atomic approval gate | Built | Concurrent-safe, AuditLog on every decision |
| Policy gate evaluation per task | Built | `evaluatePolicy` wired on task page |
| AI Change Control Pack (evidence API + page per task) | Built | Evidence collection endpoint per task |
| Sandbox Replay (sandboxPlan, approve/reject, preview mode) | Built | `FEATURE_SANDBOX_MODE=false` by default |
| Task export as PDF | Built | `/api/tasks/[id]/pdf` |
| Task clone | Built | `/api/tasks/[id]/clone` |
| Bulk task operations | Built | `/api/tasks/bulk` |
| Task comments | Built | `/api/tasks/[id]/comments` |

### 4.2 GitHub PR Intelligence

| Feature | Status | Notes |
|---------|--------|-------|
| PR import by URL or owner/repo/number | Built | `POST /api/github-prs` |
| Incremental PR sync | Built | `POST /api/github-prs/sync`, `fullSync` flag supported |
| Full PR history import button | Built | `FullSyncButton` component |
| PR classification (deterministic, no LLM) | Built | 10 types, high/medium/low confidence |
| Bug state detection | Built | 4 states derived from title/labels/files |
| PR memory search | Built | `GET /api/github-prs/memory` |
| PR timeline grouped by week/day/milestone | Built | `/api/projects/[id]/governance-timeline` (API + page) |
| Repository Intelligence page | Being built | API done (`/api/projects/[id]/intelligence`), UI in progress |
| Governance Timeline page | Being built | API done, UI in progress this sprint |
| Task linking to PRs | Partial | Manual PATCH only — no auto-link |
| Agent run linking to PRs | Partial | Manual PATCH only — no auto-link |
| LLM-powered PR summaries | Planned | Gated behind `FEATURE_REPO_MEMORY_LLM=false` |
| GitHub webhooks (incoming push events) | Planned | Not started |
| Real-time PR sync via websocket/SSE | Planned | Not started |

### 4.3 Incident Management

| Feature | Status | Notes |
|---------|--------|-------|
| Incident model | Built | Prisma model in schema |
| Incidents API (full CRUD) | Built | Route group `/api/incidents` |
| Incidents page + nav link | Built | Accessible from main navigation |

### 4.4 Agent Scorecard & Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| Agent Scorecard page + API | Built | Provider-level scorecard |
| Client Report Templates | Built | Task and project report APIs |
| Execution trace (append-only) | Built | `ExecutionTrace` table, no update/delete endpoints |

### 4.5 Platform, Auth & Observability

| Feature | Status | Notes |
|---------|--------|-------|
| GitHub OAuth + iron-session auth | Built | Callback at `/api/auth/github/callback` |
| Role-based access control | Built | `requireRole` guard |
| API keys with SHA-256 hashing | Built | `/api/keys` CRUD |
| HMAC-signed outgoing webhooks | Built | `/api/webhooks` |
| SSE real-time events | Built | `/api/events` |
| Immutable audit log with CSV export | Built | Append-only, no update/delete |
| Share links for governance reports | Built | `/api/share-links` |
| Mermaid diagram generation + SVG export | Built | `/api/diagrams` |
| Project Health Dashboard | Built | Embedded in project page |
| Multi-org support | Partial | Schema and org API exist; UI limited |
| CI Dashboard | Partial | Route exists (`/ci`), UI partial |
| Notification preferences | Built | `/api/notifications/preferences` |
| Billing / usage tracking | Partial | Schema + usage API; no payment gateway |

---

## 5. Non-Goals

The following are explicitly out of scope for the current phase:

- GitLab integration (GitHub only)
- Slack or email notifications
- S3/MinIO object storage
- Razorpay or any payment gateway wiring
- GitHub webhooks for incoming push events
- Auto-dispatch to AI agents (all agent runs are manual paste-in)
- Production deployment automation
- Multi-tenant SaaS onboarding

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| PR import + classify time (single PR) | < 5 seconds |
| Full history sync for 200 PRs | Completes without timeout |
| All governance events visible in timeline | PRs, agent runs, and incidents covered |
| Test suite green on every PR | 100% |
| Zero broken pages after deploy | Verified by smoke test |
| No secrets committed to repository | Enforced by diff review |
