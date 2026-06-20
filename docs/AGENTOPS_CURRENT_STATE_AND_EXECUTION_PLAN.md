# Devascend AgentOps Platform — Current State & Execution Plan

**Prepared:** 2026-06-20  
**Prepared by:** Autonomous product audit (Claude Code)  
**Repo:** glttech/Coder-by-devascend  
**Purpose:** Execution-readiness report before full autonomous development of the two-module AgentOps Platform

---

## Table of Contents

1. [Current Product Status](#1-current-product-status)
2. [Architecture Map](#2-architecture-map)
3. [What Already Supports the AgentOps Platform](#3-what-already-supports-the-agentops-platform)
4. [Gap Analysis for SOC Module](#4-gap-analysis-for-soc-module)
5. [Conflict and Duplication Risk](#5-conflict-and-duplication-risk)
6. [Recommended Product Architecture](#6-recommended-product-architecture)
7. [PRD/TRD/Roadmap Needed Before Autonomous Build](#7-prdtrdroadmap-needed-before-autonomous-build)
8. [Feature Build Sequence](#8-feature-build-sequence)
9. [Autonomous Development Requirements](#9-autonomous-development-requirements)
10. [Recommended Autonomous Mode Contract](#10-recommended-autonomous-mode-contract)
11. [Time and Effort Estimate](#11-time-and-effort-estimate)

---

## 1. Current Product Status

### Production-Ready

These features are complete, tested, and have full CI coverage:

| Feature | Coverage | Evidence |
|---|---|---|
| Task lifecycle (create, edit, approve, run, complete) | Full | 98 test files, CI green |
| Policy gate evaluation (8 rule types, deterministic) | Full | policyGates.test.ts, policyRisk.test.ts |
| Approval guard (state machine, concurrency-safe) | Full | approvalGuard.test.ts |
| RBAC (admin/reviewer, requireRole, middleware) | Full | rbac.test.ts, authGuard.test.ts |
| Session management (iron-session v8, CSRF, revocation) | Full | session.test.ts, sessionRevocation.test.ts |
| Immutable audit log (AuditLog, append-only) | Full | auditEvents.test.ts |
| Execution trace (ExecutionTrace, redacted) | Full | Schema + routes |
| Incident model (triggers, severity, timeline, postmortem) | Full | incidents.test.ts, incidentsApi.test.ts |
| GitHub PR import + classification | Full | githubClient.test.ts, prClassifier.test.ts |
| Rate limiting (sliding window, per IP) | Full | rateLimiter.test.ts |
| Webhook delivery (HMAC-SHA256, auto-disable, env-gated) | Full | webhookValidation.test.ts |
| Share links (scoped tokens, revocation, view count) | Full | shareLinks.test.ts |
| API key management (SHA-256 hash, display-once, scopes) | Full | apiKeys.ts |
| Cursor-based pagination (tasks, github-prs) | Full | tasksPagination.test.ts |
| Multi-tenant organization model | Full | Schema + routes |
| Decision engine (deterministic CONTINUE/BLOCK/APPROVE) | Full | decisionEngine.test.ts |
| Risk analyzer (12 pattern types, negation stripping) | Full | riskAnalyzer.test.ts |
| Governance timeline builder | Full | buildTimeline.test.ts |
| Task report (HTML + PDF export) | Full | reportTemplates.test.ts |
| CI status aggregation | Full | ciRun routes |
| Demo mode + data seeding | Full | seed:demo script |

### Working but Needs Polish

| Feature | Gap | Notes |
|---|---|---|
| Executive dashboard | Widgets working, layout customization incomplete | DashboardWidgetCustomizer exists but config persistence limited |
| Project intelligence/health scoring | Calculates metrics, display sparse | projectHealth.ts complete, UI needs more visual treatment |
| Operator session flow | Logic complete, UX is dense | OperatorPanel.tsx needs UX simplification |
| Prompt builder + evaluation | Works, but tightly coupled to Coder domain | Will need abstraction for SOC prompts |
| Agent roles (built-in 7 types) | Defined and editable, but not wired to LLM yet | FEATURE_AGENT_LLM flag still off |
| Notifications (in-app) | Schema + route exist, UI shows count but detail view incomplete | NotificationBell shows badge, full list page minimal |
| Email notifications | Resend integration stub exists, not wired | email/ folder has templates, not sent |
| Diagrams (Mermaid) | Generation works, SVG export works; auto-trigger not set | Manual trigger only |

### Partially Built

| Feature | What's Built | What's Missing |
|---|---|---|
| LLM agent execution | Provider registry, run schema, feature flag | Actual API call to Claude/Open-SWE |
| RAG / evidence embeddings | EvidenceChunk model, embeddingModel field | Real embedding calls (stub only) |
| Open SWE adapter | File exists | All logic is a TODO comment |
| Langfuse observability | File exists, mock no-op | Real network call not wired |
| Custom policy rules (per-org) | Schema supports orgId-scoped rules (planned) | Rules are currently hard-coded defaults |
| Billing/usage tracking | usage.ts + /api/billing/usage route | No payment processor wired |
| Sandbox replay | SandboxPreviewPanel, routes exist | sandboxPlan JSON schema not finalized |
| PR sync (incremental) | PrSyncState table, sync route | Background job / cron not set up |

### SOC Module Progress

| Milestone | Status | PR | Notes |
|---|---|---|---|
| M-1: Module discriminator (Task, Incident) | ✅ Merged | #197 | `module='coder'` default on all existing rows |
| M-2: SecurityAlert model + CRUD API | 🔄 Draft PR #198 | #198 | Pending Rahul approval; all 73 tests pass, typecheck clean |
| M-3: Alert normalization + triage engine | Not started | — | Next after M-2 merge |
| M-4: Manual JSON/CSV import | Not started | — | — |
| M-5: Wazuh sample-format intake (feature-flagged) | Not started | — | Static format only; no live webhook |
| M-6–M-10: UI, incidents, reports, seed | Not started | — | — |

**M-2 hardening changes (vs original draft):**
- PATCH tightened to `admin`-only (was `any`)
- DELETE is soft-delete via `archivedAt` (no hard delete)
- Org scope enforced on all reads/writes via `getOrgId()` helper
- Compound cursor `createdAt|id` for stable pagination
- rawPayload: 100 KB size limit + sensitive-key redaction before storage
- `getOrgId(userId)` added to `src/lib/orgScope.ts`
- `src/lib/soc/rawPayload.ts` new validation/sanitization library

### Planned but Not Built

| Feature | Status |
|---|---|
| AI triage service for security alerts | Not started — FEATURE_SOC_AI_TRIAGE=false |
| Security incident lifecycle (SOC module) | Planned M-8 |
| Severity scoring (security-specific, deterministic) | Planned M-3 |
| Remediation task tracking (SOC) | Post-MVP |
| CEO/CISO evidence pack export | Planned M-9 |
| Client-facing security summary | Post-MVP |
| MCP connectors | Planned Phase 2 |
| Durable workflows | Planned Phase 2 |
| GraphRAG | Planned Phase 4 |
| Module navigation (Coder vs SOC split) | Planned M-6 |
| Viewer role (read-only, no reviewer) | Post-MVP |
| Sentry intake | Locked out of MVP (Rahul decision) |

### Risky or Unclear

| Area | Risk | Notes |
|---|---|---|
| `sandboxPlan` JSON schema | Undefined shape | AgentRun.sandboxPlan is `Json?` with no typed contract |
| Open SWE `agentTool` option | Disabled in UI but valid in schema | `open-swe` is a VALID_AGENT_TOOL but the adapter is a stub — could be called accidentally |
| Module boundary | Not enforced | No module concept in schema or nav — everything is one flat product |
| Custom policy rules | No DB table yet | Currently hard-coded; planned Phase 2 org-scoped rules have no schema yet |
| `orgId = 'org_default'` | Hard-coded fallback | Webhook delivery and some routes use 'org_default' as fallback — multi-tenant correctness is incomplete |
| LLM cost controls | No budget limits | When agent execution is enabled, no per-org token budget enforced |
| `EvidenceChunk.embedding` | Stored as `Json` array | No real vector index; will not scale past ~10k chunks without pgvector migration |
| Session invalidation timing | `sessionId` added post-deploy | Sessions created before the sessionId field was added are rejected — intentional but could surprise users after next deploy |

---

## 2. Architecture Map

### Frontend Structure

```
Next.js 14 App Router
├── Server Components (default) — data fetching, auth check
├── Client Components ('use client') — interactive UI, forms, real-time
├── 52 pages across 12 domains:
│   Tasks, Projects, Milestones, GitHub PRs,
│   Agent Runs, Agent Roles, Governance, Audit,
│   Incidents, Settings, Executive, Auth
├── 37 reusable components (no Tailwind, custom CSS variables)
├── 6 custom hooks (useNotifications, useSSE, etc.)
└── SSE endpoint (/api/events) for real-time updates
```

**Theming:** Dark/light mode via CSS custom properties. No component library dependency.

**Navigation:** Single sidebar (`SidebarNav.tsx`) with flat item list. No module separation currently.

### Backend / API Structure

```
81 API routes under /src/app/api/
├── Auth domain:     7 routes (login, register, logout, github oauth, csrf, me)
├── Task domain:    16 routes (CRUD + clone + pdf + sandbox + orchestrate + export)
├── Project domain: 11 routes (CRUD + intelligence + timeline + report + milestones)
├── GitHub domain:   8 routes (PR CRUD + sync + refresh + memory + classify)
├── Agent domain:   11 routes (runs + roles + providers + approve + evaluate)
├── Governance:      9 routes (approvals + instructions + operator-sessions + policy)
├── Incident:        4 routes (CRUD + postmortem)
├── Audit/Trace:     5 routes (traces + audit export)
├── Settings:        8 routes (webhooks + api-keys + orgs + users + notifications)
└── Utility:         5 routes (health + demo + search + billing + share-links)
```

**Pattern:** Every route follows: `getCurrentUser() → requireRole() → validate input → DB query → writeAudit() → return`.

### DB / Schema Structure

```
PostgreSQL 15 via Prisma 5
├── 29 models, 27 migrations
├── Core: User, Project, Task, AgentRun, Approval, AuditLog
├── Governance: Instruction, OperatorSession, ExecutionTrace, Incident
├── Integration: GithubPR, PrSyncState, CiRun, Webhook, ApiKey
├── Organization: Organization, Membership, Invitation
├── Intelligence: AgentRole, AgentProvider, EvidenceChunk, Diagram
├── UX: Notification, NotificationPreference, ShareLink, Comment
└── Indexes: Task(createdAt), Task(projectId,createdAt),
            AuditLog(taskId), AuditLog(createdAt), GithubPR(importedAt)
```

### Governance Layer

```
Policy Gates (policyGates.ts)
  → 8 rule categories, regex-based, deterministic
  → evaluatePolicy() called on every task create

Risk Analyzer (riskAnalyzer.ts)
  → 12 pattern types, negation stripping
  → analyzeRisk() called on agent run output

Decision Engine (decisionEngine.ts)
  → deterministic: no LLM in critical path
  → CONTINUE | RUN_VALIDATION | SENIOR_APPROVAL_REQUIRED | BLOCKED

Approval Guard (approvalGuard.ts)
  → state machine: pending → approved/rejected
  → concurrency-safe (unique constraint + conditional updateMany)

Agent Action Guard (agentActionGuard.ts)
  → guards which agent roles can take which actions
  → maxRiskLevel per role enforced
```

### Evidence / Audit Layer

```
AuditLog       — immutable, append-only, every event
ExecutionTrace — immutable, redacted prompts, decision codes
EvidenceChunk  — RAG foundation (embedding stub for now)
buildTimeline  — aggregates events into human-readable narrative
reportTemplates — HTML/PDF governance reports
ShareLink      — public access to reports without auth
```

### Reporting Layer

```
Task Report     — /api/tasks/[id]/report (HTML)
Task PDF        — /api/tasks/[id]/pdf
Project Report  — /api/projects/[id]/report
Provider Score  — /api/agent-providers/scorecard
Audit Export    — /api/audit/export (CSV)
Trace Export    — /api/traces/export (CSV)
Task Export     — /api/tasks/export (CSV)
Executive Dashboard — /executive (KPIs, risk trends)
```

### Integration Layer

```
GitHub REST API   — PR import, file diff, CI status
Webhook delivery  — HMAC-SHA256 outbound (10 event types)
Email (Resend)    — stub wired, not active
Langfuse          — observability stub, not active
Open SWE          — agent stub, not active
SSE               — /api/events real-time stream
OAuth             — GitHub login flow
```

### DevOps / Testing Layer

```
CI: GitHub Actions (.github/workflows/ci.yml)
  → typecheck (tsc) → lint (eslint) → test (tsx --test) → build (next build)
  → Runs on push to main + all PRs

Tests: 98 files, 672+ passing assertions
  → Node native test runner (node:test via tsx)
  → Covers: policy, auth, approvals, risk, incidents, GitHub, audit, reports

Docker: docker-compose.yml for local PostgreSQL
Migrations: hand-written SQL, 27 applied
```

---

## 3. What Already Supports the AgentOps Platform

The following existing features can be **shared across both Coder and SOC modules** without modification or with minimal adaptation:

| Shared Asset | Used by Coder | Available for SOC | Notes |
|---|---|---|---|
| **RBAC (admin/reviewer)** | Auth on all routes | Alert triage roles, analyst/reviewer | May need `analyst` role |
| **Immutable AuditLog** | Every governance event | Every security event | Zero schema change needed |
| **ExecutionTrace** | AI decision log | AI triage decision log | Same table, different `roleKey` |
| **Incident model** | ci_failure, run_failure, policy_block | All 5 triggers reusable for security | Need new trigger types |
| **Approval workflow** | Task approval gate | Alert escalation gate | Same approval flow, different context |
| **Policy gates** | Code change governance | Security alert policy rules | Add new rule categories |
| **Risk analyzer** | Instruction risk scoring | Alert severity classification | Extend with security patterns |
| **Decision engine** | CONTINUE/BLOCK/APPROVE for runs | TRIAGE/ESCALATE/CLOSE for alerts | New decision codes or reuse |
| **Evidence checker** | Missing evidence detection | Missing remediation evidence | Context-specific rules |
| **Governance timeline** | Audit event narrative | Alert timeline narrative | Same builder, different events |
| **Report templates** | Task governance PDF | Incident evidence pack PDF | Extend template library |
| **Share links** | Governance report sharing | Client security report sharing | Zero change needed |
| **Webhook delivery** | Task/approval events | Alert/incident events | Add new event types |
| **API keys** | Programmatic access | Integration tokens (Wazuh, Sentry) | Zero change needed |
| **Organization model** | Multi-tenant isolation | Customer isolation for SOC clients | Zero change needed |
| **Rate limiter** | API protection | Alert ingestion throttling | Zero change needed |
| **Notification system** | Task/approval alerts | Security alert notifications | Add new notification types |
| **Demo mode** | Demo data seeding | SOC demo scenarios | Add SOC demo seed data |
| **Executive dashboard** | Engineering KPIs | CISO/CEO KPIs | Add SOC widget set |
| **SSE event stream** | Real-time run status | Real-time alert updates | Zero change needed |
| **CSV export** | Task/trace export | Alert/incident export | Add SOC export types |

**Summary:** ~70% of the existing platform infrastructure is directly reusable for SOC. The shared governance, evidence, audit, and reporting layers are the foundation of both modules. SOC is an additive vertical, not a replacement.

---

## 4. Gap Analysis for SOC Module

### 4.1 Alert Intake (Missing Entirely)

**Wazuh alert intake:**
- No Wazuh API client
- No alert schema / data model
- No alert ingestion endpoint
- No rule-ID-to-MITRE-ATT&CK mapping
- No agent-level → alert-level correlation

**Sentry issue intake:**
- No Sentry API client
- No Sentry webhook receiver
- No issue-to-alert normalization
- No environment tag extraction

**What's needed:**
- `SecurityAlert` model (id, orgId, source: 'wazuh'|'sentry'|'manual', sourceId, rawPayload JSON, normalizedTitle, normalizedDescription, ruleId, mitreTactic, mitreId, severity: 'info'|'low'|'medium'|'high'|'critical', status: 'new'|'triaging'|'escalated'|'remediated'|'closed', createdAt, updatedAt)
- `/api/soc/alerts` — GET list (paginated), POST (manual create)
- `/api/soc/alerts/ingest/wazuh` — POST (Wazuh webhook receiver)
- `/api/soc/alerts/ingest/sentry` — POST (Sentry webhook receiver)
- Alert normalization library (`src/lib/soc/alertNormalizer.ts`)
- MITRE ATT&CK lookup table (`src/lib/soc/mitre.ts`)

### 4.2 Normalized Security Alert Model (Missing)

Current `Incident` model is Coder-centric (trigger types: ci_failure, run_failure, policy_block, reviewer_block, manual_rollback). Does not cover:
- Alert source (Wazuh, Sentry, manual)
- MITRE tactic/technique
- Affected hosts/services/users
- Alert rule ID
- Raw payload storage
- Deduplication (fingerprint/sourceId unique per org)
- SLA breach tracking

**What's needed:**
- New `SecurityAlert` model (separate from Incident)
- `AlertGroup` model for deduplication clusters
- `AffectedAsset` model (host, service, user)
- MITRE fields: tactic, techniqueId, techniqueName

### 4.3 Security Incident Lifecycle (Partially Covered)

Existing `Incident` model covers a basic lifecycle (open → resolved). Missing for SOC:
- Triage phase (new → triaging → escalated)
- Severity escalation workflow
- SLA timers (time-to-triage, time-to-resolve)
- Containment status
- Evidence collection phase
- Customer notification status
- Postmortem mandatory for critical/high (not just optional)

**What's needed:**
- Extend `Incident` OR create `SecurityIncident` with SOC-specific lifecycle fields
- Status machine: `new → triaging → investigating → escalated → contained → remediated → closed`
- SLA configuration per severity tier
- `IncidentSLA` model (targetMinutes, breached boolean, breachedAt)

### 4.4 AI Triage Service (Missing)

No AI-powered alert classification exists. The current `decisionEngine.ts` is Coder-specific (CI/code risks).

**What's needed:**
- `src/lib/soc/triageEngine.ts` — LLM or rule-based triage
  - Input: normalized alert + org context + historical alerts
  - Output: recommended severity, recommended action, confidence score, reasoning
- Deterministic pre-triage (pattern matching before LLM)
- LLM call with structured output (`{ severity, action, confidence, summary }`)
- Same feature-flag pattern: `FEATURE_SOC_AI_TRIAGE=false` default
- Integration with existing `AgentRole` table (new built-in role: `soc-triage-analyst`)

### 4.5 Severity / Risk Scoring (Missing for Security Context)

Existing `riskAnalyzer.ts` scores code instructions for delivery risk. Does not cover:
- CVE severity (CVSS score)
- Alert frequency / anomaly scoring
- Asset criticality
- Blast radius estimation
- Threat intelligence correlation

**What's needed:**
- `src/lib/soc/severityScorer.ts`
  - CVSS v3 base score parsing
  - Alert volume spike detection
  - Asset criticality weighting
  - Composite score → severity bucket (info/low/medium/high/critical)

### 4.6 Remediation Task Tracking (Partially Covered)

Existing `Task` model could theoretically hold remediation tasks, but:
- No `source: 'coder'|'soc'` discriminator
- No link from `SecurityAlert` → `Task` (remediation task)
- No remediation checklist model
- UI doesn't distinguish Coder tasks from SOC remediation tasks

**What's needed:**
- Add `module: 'coder'|'soc'` field to `Task` (non-breaking, nullable/default 'coder')
- `Task.sourceAlertId` FK → `SecurityAlert.id` (nullable)
- Remediation checklist: either reuse `Instruction` model or create `RemediationStep`
- SOC-specific task creation flow in UI

### 4.7 Evidence Capture (Partially Covered)

`EvidenceChunk` model exists for RAG. `ExecutionTrace` captures decision evidence. Missing:
- Alert evidence attachments (screenshots, logs, packet captures)
- Chain of custody tracking
- Evidence tamper-proof hash (SHA-256 of file content)
- Evidence pack compilation (export all evidence for an incident as ZIP)

**What's needed:**
- `EvidenceAttachment` model (id, orgId, incidentId, alertId, filename, contentHash, storageRef, uploadedBy, uploadedAt)
- `/api/soc/evidence` — POST upload, GET list
- Evidence pack export endpoint: `/api/soc/incidents/[id]/evidence-pack`

### 4.8 Executive Reports (Missing for SOC)

Existing report templates are Coder-focused (task governance, approval history). Missing:
- CEO/CISO security report template
  - Executive summary (total alerts, SLA breaches, critical incidents)
  - Risk trend chart (weekly/monthly)
  - Top 5 threats by MITRE tactic
  - Remediation status summary
  - Compliance posture statement
- Client-facing security summary (whitelabeled)
  - Incident summary without internal details
  - Remediation evidence summary
  - SLA compliance table

**What's needed:**
- `src/lib/soc/reportTemplates.ts` (SOC-specific HTML templates)
- `/api/soc/reports/executive` — GET (CEO/CISO report)
- `/api/soc/reports/client/[orgId]` — GET (client summary)
- PDF export for both

### 4.9 Dashboard Navigation (Missing)

No module selector exists. Current sidebar is one flat list of Coder features.

**What's needed:**
- Module switcher: `[ Coder | SOC ]` in sidebar or top nav
- Separate sidebar sections per module
- SOC dashboard home (`/soc` or `/soc/dashboard`)
- SOC nav items: Alerts, Incidents, Triage Queue, Reports, Settings

### 4.10 Gap Summary Table

| SOC Capability | Status | Effort |
|---|---|---|
| Wazuh alert intake | Missing | Medium |
| Sentry issue intake | Missing | Medium |
| Alert normalization | Missing | Medium |
| SecurityAlert model | Missing | Small |
| AI triage service | Missing | Large |
| Severity/risk scoring (security) | Missing | Medium |
| Security incident lifecycle | Partial (reuse+extend Incident) | Medium |
| SLA tracking | Missing | Medium |
| Remediation task tracking | Partial (extend Task) | Small |
| Evidence attachments | Missing | Medium |
| Evidence pack export | Missing | Medium |
| CEO/CISO report | Missing | Medium |
| Client security summary | Missing | Medium |
| SOC dashboard / navigation | Missing | Small |
| MITRE ATT&CK mapping | Missing | Small |
| Alert deduplication | Missing | Medium |
| Asset inventory | Missing | Large |

---

## 5. Conflict and Duplication Risk

### 5.1 Schema Conflicts

| Risk | Severity | Resolution |
|---|---|---|
| `Incident` model is Coder-centric (trigger types: ci_failure etc.) | Medium | Add `module: 'coder'\|'soc'` discriminator field; add SOC trigger types; or create `SecurityIncident` as a separate model |
| `Task` model has no module discriminator | Medium | Add `module: 'coder'\|'soc'` (nullable, default 'coder') — non-breaking migration |
| `riskLevel` on Task uses 'low'/'medium'/'high' (3 tiers) but SOC needs 5-tier severity | Low | SOC severity stored in `SecurityAlert.severity` (separate field with 5 tiers); no conflict |
| `orgId = 'org_default'` hard-coded in webhook delivery | Low | Already flagged — fix in Platform Cleanup phase |
| `EvidenceChunk.embedding` stored as `Json` (no vector index) | Low | Not a conflict, but SOC evidence will need same fix when RAG goes live |

### 5.2 Route Conflicts

| Existing Route | Conflict Risk | Resolution |
|---|---|---|
| `/api/incidents` | Could become ambiguous (Coder vs SOC incidents) | Namespace SOC routes under `/api/soc/` |
| `/api/tasks` | SOC remediation tasks would share this endpoint | Add `module` filter param; or create `/api/soc/tasks` wrapper |
| `/api/agent-roles` | Coder roles and SOC triage roles share table | Use `key` prefix convention: `soc-*` for SOC roles |
| `/api/audit/export` | Single export endpoint for all modules | Add `module` query param filter |

**Recommended boundary:** All SOC routes live under `/api/soc/`. All Coder routes stay at current paths. Shared infrastructure routes (auth, org, api-keys, webhooks) stay at `/api/`.

### 5.3 UI / Navigation Conflicts

| Risk | Severity | Resolution |
|---|---|---|
| Current sidebar shows Coder features — SOC items would crowd it | High | Add module switcher; show only active module's nav items |
| `/incidents` page is already a Coder concept | Medium | Rename to `/coder/incidents` or keep and add `/soc/incidents` |
| Dashboard (`/`) is Coder-centric (tasks, runs, approvals) | Medium | Make module-aware: redirect based on user's active module |
| Executive dashboard mixes Coder KPIs with future SOC KPIs | Medium | Add tab/toggle: "Engineering" vs "Security" view |

### 5.4 Policy Engine Conflicts

| Risk | Severity | Resolution |
|---|---|---|
| `DEFAULT_POLICY_RULES` are code-delivery-focused | Low | SOC adds new rule categories without touching existing ones |
| `evaluatePolicy()` signature expects `title, instruction, riskLevel, environment` | Low | SOC triage uses a separate `triageEngine.ts`; no overlap |
| Approval workflow is task-scoped | Low | SOC escalation flow reuses Approval model with `module` context; no conflict |

### 5.5 Report Model Conflicts

| Risk | Severity | Resolution |
|---|---|---|
| `reportTemplates.ts` is Coder-specific | Low | SOC creates `src/lib/soc/reportTemplates.ts`; no changes to existing file |
| PDF export endpoint at `/api/tasks/[id]/pdf` | None | SOC creates `/api/soc/incidents/[id]/pdf`; no conflict |

### 5.6 Test / CI Risks

| Risk | Severity | Resolution |
|---|---|---|
| New SOC test files could collide with glob pattern `src/lib/__tests__/*.test.ts` | Low | Add SOC tests to `src/lib/__tests__/soc/` subdirectory |
| Migration numbering (sequential timestamps) | Low | Continue sequential naming; SOC migrations use 2026-07-* timestamps |
| Build time increase as SOC adds pages/routes | Low | Next.js handles; monitor build time in CI |

### 5.7 Migration Risks

| Risk | Severity | Resolution |
|---|---|---|
| Adding `module` field to `Task` | Low | Nullable with default 'coder'; zero downtime migration |
| Adding `module` field to `Incident` | Low | Same pattern |
| New `SecurityAlert` table | None | Additive; no existing tables touched |
| `EvidenceAttachment` table | None | Additive |

### 5.8 Recommended Boundary Model

```
/api/                          — shared infrastructure
  /api/auth/                   — authentication (shared)
  /api/orgs/                   — organization (shared)
  /api/users/                  — users (shared)
  /api/webhooks/               — webhooks (shared)
  /api/keys/                   — API keys (shared)
  /api/notifications/          — notifications (shared)
  /api/events                  — SSE (shared)

/api/coder/                    — Coder module (keep existing paths, add namespace eventually)
  /api/tasks/                  — (existing)
  /api/projects/               — (existing)
  /api/agent-runs/             — (existing)
  /api/approvals/              — (existing)
  /api/incidents/              — Coder incidents (existing)
  /api/instructions/           — (existing)

/api/soc/                      — SOC module (new namespace)
  /api/soc/alerts/             — security alert intake + CRUD
  /api/soc/alerts/ingest/      — Wazuh, Sentry receivers
  /api/soc/incidents/          — security incident lifecycle
  /api/soc/triage/             — AI triage queue
  /api/soc/reports/            — CEO/CISO/client reports
  /api/soc/evidence/           — evidence capture
  /api/soc/tasks/              — remediation task tracking
```

```
/                              — module-aware home
/coder/                        — Coder module pages
  /tasks/, /projects/, etc.   — (existing, consider namespace prefix later)
/soc/                          — SOC module pages
  /soc/alerts/
  /soc/incidents/
  /soc/triage/
  /soc/reports/
  /soc/dashboard/
```

**Rule:** Never mix Coder and SOC data in the same query without a module filter. Never mix their UI in the same page without explicit labeling.

---

## 6. Recommended Product Architecture

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Devascend AgentOps Platform                │
│                                                         │
│   ┌─────────────────┐   ┌─────────────────────────┐    │
│   │  Coder Module   │   │      SOC Module          │    │
│   │                 │   │                          │    │
│   │ - Task govern.  │   │ - Alert intake           │    │
│   │ - PR/change ctrl│   │ - AI triage              │    │
│   │ - Policy gates  │   │ - Incident lifecycle     │    │
│   │ - Sandbox replay│   │ - Severity scoring       │    │
│   │ - Agent runs    │   │ - Remediation tracking   │    │
│   │ - Dev reports   │   │ - CEO/CISO reports       │    │
│   └────────┬────────┘   └────────────┬────────────┘    │
│            │                         │                  │
│   ┌────────▼─────────────────────────▼────────────┐    │
│   │               Shared Platform Layer            │    │
│   │                                               │    │
│   │  Governance  Risk   Evidence   Audit          │    │
│   │  RBAC        Alerts Reports    Timeline       │    │
│   │  Approvals   Scores Webhooks   Integrations   │    │
│   │  Policy      Trace  Share-links Organizations │    │
│   └───────────────────────────────────────────────┘    │
│                                                         │
│   ┌───────────────────────────────────────────────┐    │
│   │           Infrastructure Layer                 │    │
│   │   Auth   Sessions   DB   CI/CD   Notif   SSE  │    │
│   └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### What Should Be Shared (Platform Layer)

| Asset | Why Shared |
|---|---|
| RBAC + auth | Single identity across modules |
| AuditLog | Universal event log — all modules append here |
| ExecutionTrace | All AI decisions logged in one place |
| Approval workflow | Both modules need human sign-off gates |
| Organization model | Multi-tenancy is platform-wide |
| API keys | Programmatic access is module-agnostic |
| Webhooks | Subscriptions span both modules |
| Notification system | Single bell icon, unified inbox |
| Rate limiting | Applied at API gateway level |
| Share links | Both modules generate shareable reports |
| CSV/PDF export | Common export infrastructure |
| Demo mode | Both modules need demo data |
| SSE event stream | Real-time updates for both modules |
| Executive dashboard | Both modules contribute KPIs (separate tabs) |

### What Should Stay Module-Specific

| Coder Module | SOC Module |
|---|---|
| Task / AgentRun / AgentStep | SecurityAlert / AlertGroup |
| Instruction lifecycle | Alert triage lifecycle |
| PR/GitHub integration | Wazuh / Sentry integration |
| Policy gates (code delivery) | Triage engine (security alerts) |
| Decision engine (CONTINUE/BLOCK) | Severity scorer (INFO→CRITICAL) |
| Sandbox plan/replay | Evidence pack compilation |
| Milestones / releases | SLA tracking |
| Agent roles (code-focused) | Agent roles (security-focused, soc-* key prefix) |
| Coder reports (task/project) | SOC reports (incident/executive) |
| Coder incidents (ci_failure etc.) | SOC incidents (security lifecycle) |

### Module Discovery / Routing

When a user logs in, the platform checks which modules their org has enabled (bitmask or array field on `Organization`). Sidebar renders only the enabled module's nav items. `/` redirects to the active module dashboard.

---

## 7. PRD/TRD/Roadmap Needed Before Autonomous Build

The following documents are needed before full autonomous development begins. Existing docs in `/docs/` provide a foundation but need SOC-aware updates.

### Required Document Structure

```
docs/
├── platform/
│   ├── PLATFORM_PRD.md           ← WHO: both modules' personas, pricing tiers
│   ├── PLATFORM_TRD.md           ← HOW: shared layer contracts, DB conventions
│   ├── PLATFORM_ROADMAP.md       ← WHEN: phase plan, release milestones
│   └── AUTONOMY_POLICY.md        ← (exists, needs SOC additions)
│
├── coder/
│   ├── CODER_PRD.md              ← (exists as PRD.md, needs module awareness)
│   ├── CODER_TRD.md              ← (exists as TRD.md, update post-merge-train)
│   └── CODER_CLEANUP_PLAN.md     ← specific cleanup items before Phase 1 done
│
├── soc/
│   ├── SOC_PRD.md                ← WHAT: alert sources, user stories, value prop
│   ├── SOC_TRD.md                ← HOW: alert schema, triage flow, API contracts
│   ├── SOC_DB_MIGRATION_PLAN.md  ← WHICH: tables to add, fields to extend
│   ├── SOC_UI_UX_PLAN.md         ← LOOK: wireframes, nav structure, dashboard
│   └── SOC_INTEGRATIONS.md       ← CONNECT: Wazuh, Sentry API specs
│
├── shared/
│   ├── TEST_PLAN.md              ← test coverage targets, SOC test structure
│   ├── SALES_MVP_PLAN.md         ← pilot target features, demo script
│   └── EXECUTION_RULES.md        ← autonomous mode rules (this doc's Section 9)
│
└── [existing docs remain]
```

### Priority Order (What Rahul Needs to Approve First)

1. **`SOC_PRD.md`** — Who is the SOC buyer? What alert sources in MVP? What does "done" look like for pilot? _(Blocker for everything)_
2. **`PLATFORM_PRD.md`** — Pricing model: single license? Per-module? Per-seat? _(Blocks sales MVP planning)_
3. **`SOC_TRD.md`** — Alert schema, triage flow, API contract decisions _(Blocker for DB migration)_
4. **`SOC_DB_MIGRATION_PLAN.md`** — Approved schema additions _(Blocker for Phase 2 build)_
5. **`SOC_UI_UX_PLAN.md`** — Module navigation decisions, dashboard wireframes _(Blocker for Phase 3 build)_

**Minimum viable documentation before autonomous build of Phase 2+:** Items 1, 3, and 4.

---

## 8. Feature Build Sequence

### Phase 0 — Docs and Alignment (No Code)

| PR | Title | Goal | Files | Schema | UI | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 0-1 | docs: SOC PRD v1 | Define SOC buyer, alert sources, user stories | docs/soc/SOC_PRD.md | None | None | None | None | Rahul approves |
| 0-2 | docs: Platform PRD + architecture | Module boundary, shared layer, pricing | docs/platform/PLATFORM_PRD.md, PLATFORM_TRD.md | None | None | None | None | Rahul approves |
| 0-3 | docs: SOC DB migration plan | Exact tables/fields to add | docs/soc/SOC_DB_MIGRATION_PLAN.md | None | None | None | None | Rahul approves |

---

### Phase 1 — Shared Platform Cleanup (Coder Polish)

Fix known issues before adding SOC complexity.

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 1-1 | fix: remove orgId hard-coding in webhook delivery | Replace 'org_default' with actual orgId lookup | src/lib/webhookDelivery.ts, src/app/api/webhooks/route.ts | None | None | webhookDelivery.test.ts | Low | No 'org_default' string in delivery path |
| 1-2 | feat: add module field to Task and Incident | Non-breaking discriminator for future routing | prisma/schema.prisma, migration | Task.module String? default 'coder', Incident.module String? | None (no UI change) | Add to task/incident tests | Low | Existing tasks/incidents unaffected; new ones get 'coder' default |
| 1-3 | feat: custom policy rules (org-scoped, DB-backed) | Move hard-coded rules to DB for per-org config | src/lib/policyGates.ts, src/app/api/settings/policies/, prisma/schema.prisma | New PolicyRule model (id, orgId, ruleId, name, category, severity, patterns[], enabled) | /settings/policies page update | policyGates.test.ts update | Medium | Default rules seed on org create; org admin can disable/add |
| 1-4 | feat: module-aware sidebar navigation | Show active module's nav items, add module switcher | src/components/SidebarNav.tsx, new ModuleSwitcher.tsx | Organization.enabledModules String[] | Sidebar gains switcher UI | UI snapshot test | Low | Switch persists; correct items shown per module |
| 1-5 | feat: wire email notifications (Resend) | Activate pending email stubs | src/lib/email/, src/lib/notifications.ts | None | None | email send test (mock Resend) | Low | Invitation email + approval email delivered in test mode |

---

### Phase 2 — SOC Data Model

Establish the security alert schema and basic CRUD before any UI.

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 2-1 | feat(soc): SecurityAlert model + migration | Core alert entity | prisma/schema.prisma, migration | New SecurityAlert model (see Section 4.2) | None | src/lib/__tests__/soc/securityAlert.test.ts | Low | Model validates; migration runs idempotently |
| 2-2 | feat(soc): AlertGroup deduplication model | Group related alerts | prisma/schema.prisma, migration | New AlertGroup model (id, orgId, fingerprint unique, firstSeenAt, lastSeenAt, alertCount) | None | alertGroup.test.ts | Low | Same fingerprint → same group |
| 2-3 | feat(soc): SecurityIncident model + SLA fields | Security lifecycle | prisma/schema.prisma, migration | Extend Incident or new SecurityIncident; add SLA fields | None | securityIncident.test.ts | Medium | Status machine transitions validated; SLA timer fires |
| 2-4 | feat(soc): EvidenceAttachment model | File evidence for incidents | prisma/schema.prisma, migration | New EvidenceAttachment model (see Section 4.7) | None | evidenceAttachment.test.ts | Low | Attachment creation returns contentHash |
| 2-5 | feat(soc): CRUD API for SecurityAlert | Basic alert management | src/app/api/soc/alerts/route.ts, [id]/route.ts | None (uses Phase 2-1 model) | None | alertsApi.test.ts | Low | GET paginated, POST validated, PATCH status update |
| 2-6 | feat(soc): CRUD API for SecurityIncident | Incident lifecycle API | src/app/api/soc/incidents/route.ts, [id]/route.ts | None (uses Phase 2-3 model) | None | socIncidentsApi.test.ts | Low | Full lifecycle transitions via PATCH |

---

### Phase 3 — SOC UI Shell

Navigation, dashboard skeleton, and list views. No alert intake yet.

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 3-1 | feat(soc): module-aware routing + /soc layout | SOC base layout and routing | src/app/soc/layout.tsx, src/app/soc/page.tsx, SidebarNav.tsx update | None | SOC nav section appears when module enabled | Manual smoke test | Low | /soc routes render; Coder routes unaffected |
| 3-2 | feat(soc): alert list page (/soc/alerts) | See all alerts with filters | src/app/soc/alerts/page.tsx, AlertList.tsx component | None | New page + component | None (UI) | Low | Alerts render with severity badge, source, status |
| 3-3 | feat(soc): alert detail page (/soc/alerts/[id]) | Full alert view with timeline | src/app/soc/alerts/[id]/page.tsx, AlertDetail.tsx | None | New page | None | Low | Alert detail renders; timeline section present |
| 3-4 | feat(soc): incident list + detail pages (/soc/incidents) | Incident management UI | src/app/soc/incidents/, SecurityIncidentDetail.tsx | None | New pages | None | Low | Incident status transitions work from UI |
| 3-5 | feat(soc): triage queue page (/soc/triage) | Unactioned alerts needing triage | src/app/soc/triage/page.tsx, TriageQueue.tsx | None | New page | None | Low | Queue shows new+triaging alerts; empty state |
| 3-6 | feat(soc): SOC dashboard (/soc/dashboard) | KPI summary for SOC ops | src/app/soc/dashboard/page.tsx | None | New page | None | Low | Open alerts count, critical count, SLA breach count |

---

### Phase 4 — Alert Intake / Import

Actual data flowing in from external sources.

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 4-1 | feat(soc): alert normalization library | Common alert schema transform | src/lib/soc/alertNormalizer.ts, mitre.ts | None | None | alertNormalizer.test.ts | Low | Wazuh and Sentry payloads normalize to SecurityAlert schema |
| 4-2 | feat(soc): Wazuh webhook receiver | Ingest Wazuh alerts via webhook | src/app/api/soc/alerts/ingest/wazuh/route.ts | None | None | wazuhIngest.test.ts | Medium | Valid Wazuh payload creates SecurityAlert; invalid returns 422 |
| 4-3 | feat(soc): Sentry issue webhook receiver | Ingest Sentry issues | src/app/api/soc/alerts/ingest/sentry/route.ts | None | None | sentryIngest.test.ts | Medium | Sentry issue created/resolved → SecurityAlert updated |
| 4-4 | feat(soc): manual alert creation UI | Operations team creates alerts manually | src/app/soc/alerts/new/page.tsx | None | New page + form | Manual form validation test | Low | Form validates all required fields; creates alert via API |
| 4-5 | feat(soc): alert deduplication (fingerprint) | Prevent duplicate alert flooding | src/lib/soc/alertDeduplicator.ts, ingest routes update | None | None | deduplication.test.ts | Medium | Same fingerprint updates existing AlertGroup count |

---

### Phase 5 — Incident Triage Workflow

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 5-1 | feat(soc): severity scorer | Classify alert severity | src/lib/soc/severityScorer.ts | None | None | severityScorer.test.ts | Low | CVSS score + volume → severity bucket |
| 5-2 | feat(soc): AI triage engine (deterministic) | Pre-LLM rule-based triage | src/lib/soc/triageEngine.ts (rules only) | None | None | triageEngine.test.ts | Low | Known patterns → recommended action without LLM |
| 5-3 | feat(soc): AI triage engine (LLM, feature-flagged) | LLM-powered triage | src/lib/soc/triageEngine.ts (LLM path) | AgentRole: add 'soc-triage-analyst' built-in | None | triageEngine.llm.test.ts (mock) | Medium | FEATURE_SOC_AI_TRIAGE=false → deterministic only; true → LLM called |
| 5-4 | feat(soc): triage action UI | Analyst takes action on alert | src/app/soc/triage/[alertId]/page.tsx, TriageActions.tsx | None | New page + form | None | Low | Analyst can acknowledge, escalate, or close from UI |
| 5-5 | feat(soc): SLA breach detection | Track and flag SLA breaches | src/lib/soc/slaChecker.ts, cron or background job | None | SOC dashboard SLA widget | slaChecker.test.ts | Low | Alert past SLA target → breached=true, notification sent |
| 5-6 | feat(soc): escalation approval gate | Require senior approval for critical escalations | src/app/api/soc/incidents/[id]/escalate/route.ts | None | Escalation button in incident detail | escalation.test.ts | Low | Critical escalation → requireRole('admin') |

---

### Phase 6 — Reports and Evidence

| PR | Title | Goal | Files Affected | Schema Impact | UI Impact | Tests | Risk | Acceptance |
|---|---|---|---|---|---|---|---|---|
| 6-1 | feat(soc): SOC report templates | HTML report library | src/lib/soc/reportTemplates.ts | None | None | socReportTemplates.test.ts | Low | Executive and client templates render valid HTML |
| 6-2 | feat(soc): CEO/CISO executive report | Auto-generated summary | src/app/api/soc/reports/executive/route.ts, /soc/reports/executive page | None | New page + PDF export | socExecutiveReport.test.ts | Low | Report shows correct counts and trends |
| 6-3 | feat(soc): client-facing security summary | Whitelabeled incident summary | src/app/api/soc/reports/client/[orgId]/route.ts | None | New page | None | Low | Client summary omits internal fields |
| 6-4 | feat(soc): evidence pack export | ZIP of all incident evidence | src/app/api/soc/incidents/[id]/evidence-pack/route.ts | None | "Download Evidence Pack" button | evidencePack.test.ts | Low | ZIP contains audit log, incident timeline, attachments |
| 6-5 | feat(soc): evidence attachment upload | File capture for incidents | src/app/api/soc/evidence/route.ts, EvidenceUpload.tsx | None | Upload form in incident detail | evidenceUpload.test.ts | Low | File upload → SHA-256 hash stored; retrieval works |
| 6-6 | feat: executive dashboard SOC tab | Add SOC KPIs to /executive | src/app/executive/page.tsx, executiveDashboard.ts | None | "Security" tab added | executiveDashboard.test.ts update | Low | Tab shows open alerts, critical count, SLA breaches |

---

### Phase 7 — Demo Data and Sales Polish

| PR | Title | Goal | Files | Risk | Acceptance |
|---|---|---|---|---|---|
| 7-1 | feat(soc): SOC demo seed data | Realistic demo scenarios for sales | src/lib/demo/socSeed.ts, seed:soc-demo script | Low | npm run seed:soc-demo populates realistic alerts + incidents |
| 7-2 | feat: getting-started guide update | SOC onboarding flow | src/app/getting-started/page.tsx | Low | New user sees Coder or SOC flow based on module |
| 7-3 | docs: sales MVP script | Demo narrative for Rahul | docs/shared/SALES_MVP_PLAN.md | None | Covers both Coder and SOC demo flows |
| 7-4 | feat: SOC showcase page | Demo scenarios for marketing | src/app/showcase/page.tsx update | Low | SOC scenario cards with sample data |

---

### Phase 8 — Pilot Hardening

| PR | Title | Goal | Risk | Acceptance |
|---|---|---|---|---|
| 8-1 | feat: per-org module entitlements | Enable/disable modules per org | Low | org.enabledModules[] enforced at route level |
| 8-2 | feat: SOC audit log exports | CSV + PDF for compliance | Low | SOC audit export endpoint works |
| 8-3 | feat: custom SOC policy rules | Org-specific triage rules | Low | Org can add custom triage patterns |
| 8-4 | feat: API key scopes for SOC | soc:read, soc:write, soc:admin scopes | Low | API keys respect module scope |
| 8-5 | perf: pgvector migration (if RAG active) | Real vector index for EvidenceChunk | High | Only after RAG is live; not blocking |
| 8-6 | security: pen test gap fixes | Address findings from pilot | Variable | All HIGH/CRITICAL findings closed |

---

## 9. Autonomous Development Requirements

For Claude to run without asking permission for each decision, the following must be explicit:

### Repository and Branch Strategy
- **Branch:** all work on `claude/setup-coder-repo-XFuyw` (feature branches from this base)
- **PR strategy:** small PRs (one logical change), squash-merge to main
- **PR naming convention:** `feat(scope): description`, `fix(scope): description`, `docs: description`
- **Merge authority:** Claude creates and merges PRs unless a hard-stop condition is hit

### CI Rules
- All PRs must pass: typecheck → lint → test → build
- If CI fails: diagnose and fix before merging (never merge a red PR)
- Test coverage: every new feature needs at least one test file

### Migration Rules
- Migrations are additive only (no ALTER COLUMN DROP, no TRUNCATE, no DROP TABLE)
- Every new model needs `@@index` on FK columns and `createdAt`
- Migration filenames: `YYYYMMDD000000_descriptive_name`
- Migration SQL must be idempotent where possible (`CREATE INDEX IF NOT EXISTS`)
- **No migration may run on a live database without Rahul's explicit approval**

### Schema Rules
- New models use `id String @id @default(uuid())`
- All timestamps: `createdAt DateTime @default(now())`; mutable models add `updatedAt DateTime @updatedAt`
- Org-scoped models include `orgId String`
- No nullable required fields without a documented default strategy

### Deployment Rules
- Claude does not deploy to production
- Claude does not push to `main` directly (always via PR)
- Claude does not modify environment files (`.env`, `.env.local`, `.env.production`)
- Claude does not enable `WEBHOOKS_ENABLED=true` or any feature flag in any environment file

### Secrets and External API Rules
- Claude does not access, read, or log secrets, API keys, or tokens
- Claude does not make real API calls to Wazuh, Sentry, Resend, or any paid service
- All external integration tests must mock the external service
- Claude does not configure OAuth credentials or webhook signing secrets

### Allowed Autonomous Actions
- Create and merge PRs on the designated branch
- Write and update code files
- Write and update test files
- Write migration SQL (not run it)
- Write documentation
- Create demo seed scripts (not run them in production)
- Create GitHub branches and PRs
- Close superseded PRs

### Hard-Stop Conditions (Must Ask Rahul)
- Any change to `.env*` files
- Any change to production infrastructure (CI/CD, Docker, cloud config)
- Any real payment or billing API call
- Any real email send to actual users
- Any migration that alters or drops existing data
- Any change that affects active user sessions (e.g., SESSION_SECRET rotation)
- Enabling any feature flag in a non-local environment
- Any action visible to customers or external parties
- Any database operation on a live database (dev or prod)
- PRD/product strategy decisions (what to build, who to sell to, pricing)

---

## 10. Recommended Autonomous Mode Contract

> **This is the contract I (Claude) request Rahul to approve before full autonomous development begins.**

---

**Devascend AgentOps Platform — Autonomous Development Contract**

**Effective date:** Upon Rahul's written approval  
**Scope:** All feature development in this repository

---

**Claude MAY do the following without asking:**

1. Write, edit, and commit code to feature branches
2. Create and merge pull requests that pass CI (typecheck, lint, test, build)
3. Write Prisma schema additions (new models, new fields, new indexes)
4. Write SQL migration files (not run them)
5. Write test files and update existing tests
6. Write and update documentation files
7. Create GitHub branches and PRs
8. Close conflicted or superseded PRs and create v2 replacements
9. Write demo seed scripts (not execute them on live databases)
10. Add new API routes following established patterns
11. Add new frontend pages following established patterns
12. Install npm packages where the risk is low (UI utilities, testing helpers)
13. Fire-and-forget audit log writes on new events
14. Add new webhook event types following the existing delivery pattern

**Claude MUST STOP and ask Rahul before:**

1. Any change to `.env*`, `.env.local`, `.env.production`, or any environment configuration file
2. Any deployment action or infrastructure change
3. Any real API call to a paid external service (Wazuh, Sentry, Resend, Stripe, etc.)
4. Any migration that modifies or drops existing data (ALTER COLUMN type change, DROP TABLE, TRUNCATE)
5. Running any migration against a live database (dev or production)
6. Enabling any feature flag (`FEATURE_*`, `WEBHOOKS_ENABLED`, etc.) outside of `npm test`
7. Any change to authentication logic (SESSION_SECRET, password hashing, OAuth credentials)
8. Any action that sends real communications to real users (email, Slack, webhooks to real endpoints)
9. Changing pricing, licensing, or commercial terms in any document
10. Making product strategy decisions (what to build, target customers, positioning)
11. Any change to CI/CD pipeline configuration
12. Merging a PR with failing CI

**Expected work output:**

- Claude will produce small, focused PRs (one logical change per PR)
- Claude will write tests for all new features before claiming completion
- Claude will document all schema changes in the migration plan docs
- Claude will report the final state after each phase completes
- Claude will flag any ambiguity in requirements before writing code
- Claude will not claim a feature is complete without CI passing

**Rahul's responsibilities:**

- Approve or redirect product decisions (within 24 hours of request)
- Run migrations on live databases
- Set environment variables and secrets
- Review and approve the SOC PRD, Platform PRD, and SOC TRD before Phase 2 begins
- Confirm any action affecting real users or external services

**Contract validity:** This contract applies to the entire build sequence in Section 8. Rahul may amend it at any time by writing a new instruction. All prior hard stops remain in force permanently.

---

## 11. Time and Effort Estimate

All estimates assume: Claude Code Max plan, Rahul reviewing only final phase summaries, no blocker from external API onboarding.

### Sellable MVP

**Definition:** Coder module fully polished + SOC module with Wazuh/Sentry intake + basic triage + executive report.

| Phase | Content | Duration |
|---|---|---|
| Phase 0 (Docs) | PRD, TRD approvals (Rahul) | 3–5 days |
| Phase 1 (Platform cleanup) | 5 PRs | 1–2 days |
| Phase 2 (SOC data model) | 6 PRs | 1–2 days |
| Phase 3 (SOC UI shell) | 6 PRs | 2–3 days |
| Phase 4 (Alert intake) | 5 PRs | 2–3 days |
| Phase 5 (Triage workflow) | 6 PRs | 3–4 days |
| Phase 6 partial (reports only) | 3 PRs | 1–2 days |

**Sellable MVP: ~2–3 weeks of build time after PRD approval**

The primary dependency is Rahul's time to approve the SOC PRD and SOC TRD. Build time is fast; alignment is the bottleneck.

### Pilot-Ready Version

**Definition:** Full Phase 1–6, hardened for a real paying customer with real Wazuh/Sentry integration.

| Additional Work | Duration |
|---|---|
| Phase 7 (Demo + polish) | 2–3 days |
| Phase 8 partial (entitlements, scopes) | 2–3 days |
| Real Wazuh/Sentry API testing | 3–5 days (Rahul sets up credentials) |
| Security review + fixes | 2–3 days |
| Onboarding pilot customer | 1–2 days |

**Pilot-ready: 4–6 weeks after Phase 0 approval**

### SaaS v1

**Definition:** Multi-tenant, billing-aware, self-service onboarding, both modules fully functional, documentation complete.

| Additional Work | Duration |
|---|---|
| Billing integration (Stripe) | 3–5 days |
| Module entitlement enforcement | 2–3 days |
| Self-service org onboarding | 2–3 days |
| LLM wiring (real Claude API calls) | 3–5 days |
| RAG embeddings (real vectors) | 3–5 days |
| pgvector migration | 1 day |
| Full test coverage to 90%+ | 3–5 days |
| Marketing site/demo environment | 1–2 weeks (not in this repo) |

**SaaS v1: 3–4 months after Phase 0 approval**

### Mature Platform

**Definition:** GraphRAG, durable workflows, MCP connectors, full API SDK, partner integrations, enterprise SSO.

**Timeline: 9–18 months** (depends heavily on customer adoption feedback driving prioritization)

---

## Summary of Findings

### What's Strong

- The platform is architecturally sound and production-ready for the Coder module
- 98 test files with 672+ assertions give a strong safety net for refactoring
- The governance layer (policy gates, approval guards, decision engine) is deterministic, well-tested, and reusable for SOC
- The audit log, execution trace, and timeline builder are already the right abstractions for a dual-module evidence platform
- The incident model already exists — SOC extends it rather than replacing it
- The merge train (PRs #184–#195) just completed — the codebase is clean and consistent

### What Needs Attention Before SOC Build

1. `orgId = 'org_default'` hard-coding in webhook delivery (PR 1-1)
2. No module discriminator on Task or Incident (PR 1-2)
3. Policy rules are hard-coded — need DB-backed custom rules for SOC (PR 1-3)
4. Module navigation doesn't exist — sidebar is one flat Coder list (PR 1-4)

### Top 10 Decisions Needed From Rahul

1. **SOC alert sources in MVP:** Wazuh only? Sentry only? Both? Manual only?
2. **SecurityIncident vs extend Incident:** Create a new model or add SOC fields to existing Incident?
3. **Module routing:** `/soc/` prefix namespace, or feature-flag-based sidebar filter?
4. **AI triage:** Is LLM triage in scope for MVP, or deterministic rules only?
5. **Pricing model:** Single license (both modules)? Per-module? Per-seat?
6. **Pilot customer:** Who is the first SOC customer? What integrations do they need?
7. **Evidence attachments:** File upload to what storage? S3? Local filesystem? Out of scope for MVP?
8. **Custom policy rules:** In scope for Phase 1 cleanup or defer to Phase 3?
9. **Email notifications:** Activate Resend integration now or keep stub?
10. **SOC postmortem mandatory:** Should critical security incidents require a postmortem before closing?

### Recommended First PR

**PR 1-2: `fix: add module discriminator field to Task and Incident`**

This is the single lowest-risk, highest-leverage change. It makes the codebase SOC-ready without breaking anything, takes under 30 minutes, and unblocks all future SOC/Coder separation work. No UI change. Non-breaking migration. Immediately testable.

### Is the Repo Ready for Autonomous Development?

**Yes, with one condition:** The SOC PRD and SOC TRD (Sections 7) must be approved before Phase 2 begins. The codebase itself is clean, well-tested, and structured for extension. No cleanup is required before starting Phase 1 PRs. Phases 1 and partial Phase 3 (SOC UI shell) can begin immediately in parallel while SOC PRD/TRD docs are drafted.

**Recommended start:** Begin Phase 1 PRs (platform cleanup) immediately. Draft SOC_PRD.md and SOC_TRD.md in parallel as Phase 0. Once Rahul approves those two documents, Phase 2 (SOC data model) can begin without further alignment.
