# Devascend AgentOps Platform — Roadmap

**Version:** 1.0  
**Date:** 2026-06-20  
**Format:** Compressed sellable MVP (10–12 PRs) then post-MVP phases

---

## Compressed MVP Path (10–12 PRs)

These PRs deliver a sellable SOC MVP while keeping Coder stable.
Each PR is small, tested, and CI-gated. Merge order is strict.

---

### PR M-1 — Platform: Module Discriminator

**Title:** `fix: add module discriminator field to Task and Incident`  
**Goal:** Make schema SOC-ready without breaking existing Coder data  
**Files:**
- `prisma/schema.prisma` — add `module String? @default("coder")` to Task, Incident; add `alertId String?` to Incident
- `prisma/migrations/20260621000001_add_module_discriminator/migration.sql`

**Schema impact:** 2 nullable fields on existing tables (non-breaking)  
**UI impact:** None  
**Tests:** Update task/incident validation tests to assert module defaults to 'coder'  
**Risk:** Low  
**Acceptance:** Existing tests pass unchanged; new tasks/incidents default to `module='coder'`

---

### PR M-2 — SOC: SecurityAlert Model + CRUD API

**Title:** `feat(soc): SecurityAlert model and CRUD API`  
**Goal:** Core alert entity and management endpoints  
**Files:**
- `prisma/schema.prisma` — add `SecurityAlert` model
- `prisma/migrations/20260621000002_add_security_alert/migration.sql`
- `src/app/api/soc/alerts/route.ts` — GET (paginated) + POST (create)
- `src/app/api/soc/alerts/[id]/route.ts` — GET detail + PATCH status

**Schema impact:** New `SecurityAlert` table  
**UI impact:** None (API only)  
**Tests:** `src/lib/__tests__/soc/securityAlert.test.ts` — validation, status transitions, pagination  
**Risk:** Low  
**Acceptance:** CRUD works; GET returns paginated results; POST validates severity/source; audit log written on create

---

### PR M-3 — SOC: Alert Normalization + Triage Engine

**Title:** `feat(soc): alert normalization library and deterministic triage engine`  
**Goal:** Core intelligence layer — normalize any alert format, score severity  
**Files:**
- `src/lib/soc/alertNormalizer.ts` — normalizeWazuh(), normalizeManual(), normalizeCsvRow()
- `src/lib/soc/mitre.ts` — MITRE tactic/technique lookup table
- `src/lib/soc/severityScorer.ts` — deterministic scoring (0.0–1.0)
- `src/lib/soc/triageEngine.ts` — triageAlert() wrapping scorer + future LLM hook

**Schema impact:** None  
**UI impact:** None  
**Tests:** `alertNormalizer.test.ts`, `severityScorer.test.ts`, `triageEngine.test.ts`  
**Risk:** Low  
**Acceptance:** Wazuh level 10 → severity 'high'; MITRE tactic present → confidence boost; deterministic only when FEATURE_SOC_AI_TRIAGE=false

---

### PR M-4 — SOC: Manual Alert Import

**Title:** `feat(soc): manual JSON and CSV alert import`  
**Goal:** First real data flow — analysts can upload alerts without Wazuh  
**Files:**
- `src/app/api/soc/alerts/ingest/manual/route.ts` — POST, accepts JSON array or CSV multipart
- `src/lib/soc/csvParser.ts` — CSV → NormalizedAlert[]
- `src/lib/featureFlags.ts` — add `FEATURE_SOC_MODULE` flag

**Schema impact:** None (uses M-2 SecurityAlert table)  
**UI impact:** None (API only — upload form comes in M-7)  
**Tests:** `wazuhIngest.test.ts` (manual path: valid JSON, valid CSV, invalid rows, rate limit)  
**Risk:** Low  
**Acceptance:** POST with JSON array creates N alerts; CSV file creates N alerts; invalid rows return errors array; audit log `soc_alert_ingested_batch` written

---

### PR M-5 — SOC: Wazuh Sample Alert Intake

**Title:** `feat(soc): Wazuh webhook alert intake endpoint`  
**Goal:** Primary integration for pilot customers with Wazuh deployments  
**Files:**
- `src/app/api/soc/alerts/ingest/wazuh/route.ts` — POST with X-Wazuh-Token header auth
- `.env.example` — add `FEATURE_WAZUH_INTAKE=false`

**Schema impact:** None  
**UI impact:** None  
**Tests:** `wazuhIngest.test.ts` — valid payload, invalid payload, missing token, feature flag off returns 501  
**Risk:** Medium (external format parsing)  
**Acceptance:** Valid Wazuh 4.x payload → SecurityAlert with correct severity mapping; feature flag off → 501; invalid token → 401

---

### PR M-6 — SOC: Module Navigation Shell

**Title:** `feat(soc): module switcher and /soc/* page layout`  
**Goal:** Navigation foundation — SOC has its own section, no Coder mixing  
**Files:**
- `src/components/SidebarNav.tsx` — add module switcher, SOC nav section
- `src/components/ModuleSwitcher.tsx` — new component
- `src/app/soc/layout.tsx` — SOC root layout
- `src/app/soc/page.tsx` — redirect to /soc/dashboard

**Schema impact:** None  
**UI impact:** Sidebar gains module switcher; SOC nav items appear  
**Tests:** Manual smoke test (no unit tests for navigation)  
**Risk:** Low  
**Acceptance:** Switching to SOC shows only SOC nav items; /soc/ redirects to /soc/dashboard; Coder nav unchanged when Coder active

---

### PR M-7 — SOC: Alert UI (List, Detail, Import Form, Triage Queue)

**Title:** `feat(soc): alert list, detail, import form, and triage queue pages`  
**Goal:** Core analyst workflow — see alerts, triage them, escalate or close  
**Files:**
- `src/app/soc/dashboard/page.tsx` — KPI counts (open alerts, critical, triaged today)
- `src/app/soc/alerts/page.tsx` — alert list with severity/status/source filters
- `src/app/soc/alerts/import/page.tsx` — upload form (JSON/CSV)
- `src/app/soc/alerts/[id]/page.tsx` — alert detail + triage action buttons
- `src/app/soc/triage/page.tsx` — triage queue (status=new,triaging, sorted by severity)
- `src/components/AlertStatusBadge.tsx` — severity color badge
- `src/components/TriageActions.tsx` — acknowledge / escalate / close buttons

**Schema impact:** None  
**UI impact:** 5 new pages + 2 components  
**Tests:** None (UI pages); API route tests already covered  
**Risk:** Low  
**Acceptance:** Alert list renders with severity badges; triage queue shows only unactioned alerts; analyst can change status from both list and detail; import form accepts CSV/JSON file

---

### PR M-8 — SOC: Incident Management (SOC Lifecycle)

**Title:** `feat(soc): security incident creation and lifecycle management`  
**Goal:** Group alerts into incidents; track investigation through to resolution  
**Files:**
- `src/app/api/soc/incidents/route.ts` — GET (module='soc') + POST (module='soc', alertId link)
- `src/app/api/soc/incidents/[id]/route.ts` — GET detail + PATCH lifecycle
- `src/app/api/soc/incidents/[id]/report/route.ts` — GET HTML evidence report
- `src/app/soc/incidents/page.tsx` — incident list
- `src/app/soc/incidents/new/page.tsx` — create from alert or manual
- `src/app/soc/incidents/[id]/page.tsx` — detail: timeline + evidence notes + linked alerts

**Schema impact:** Uses M-1 `Incident.module='soc'` and `Incident.alertId`  
**UI impact:** 3 new pages  
**Tests:** `src/lib/__tests__/soc/socIncidents.test.ts` — lifecycle transitions, module filter, audit log  
**Risk:** Low  
**Acceptance:** SOC incidents only appear at /soc/incidents (no Coder incident mixing); alert can be linked to incident; status transitions write audit log; evidence notes stored as JSON in timeline field

---

### PR M-9 — SOC: Executive & Incident Reports

**Title:** `feat(soc): CEO/CISO executive report and incident evidence PDF`  
**Goal:** Core deliverable for CISO and managed-service clients  
**Files:**
- `src/lib/soc/reportTemplates.ts` — buildExecutiveReport(), buildIncidentEvidenceReport()
- `src/app/api/soc/reports/executive/route.ts` — GET (date range, aggregated stats)
- `src/app/api/soc/incidents/[id]/report/route.ts` — GET HTML evidence report
- `src/app/api/soc/incidents/[id]/pdf/route.ts` — GET PDF (via HTML-to-PDF)
- `src/app/soc/reports/executive/page.tsx` — executive report UI + PDF download button

**Schema impact:** None  
**UI impact:** 1 new page + PDF export  
**Tests:** `src/lib/__tests__/soc/socReportTemplates.test.ts` — HTML validity, required fields present  
**Risk:** Low  
**Acceptance:** Executive report shows correct totals for date range; incident evidence report includes timeline, linked alerts, audit events; PDF export downloads; share link works

---

### PR M-10 — SOC: Demo Seed Data

**Title:** `feat(soc): SOC demo seed data for sales scenarios`  
**Goal:** Populate realistic demo environment for sales calls  
**Files:**
- `src/lib/demo/socSeed.ts` — create 20 realistic alerts (mixed severity/source/status) + 3 incidents
- `package.json` — add `seed:soc-demo` script

**Schema impact:** None  
**UI impact:** None (data only)  
**Tests:** None (seed scripts are not unit-tested)  
**Risk:** Low  
**Acceptance:** `npm run seed:soc-demo` populates demo data without error; alerts span all severity levels; 1 critical incident with full timeline; executive report shows meaningful numbers

---

### PR M-11 — Platform Cleanup: Fix orgId Hard-Coding

**Title:** `fix: replace org_default hard-coding in webhook delivery`  
**Goal:** Correct multi-tenant isolation for webhook delivery  
**Files:**
- `src/lib/webhookDelivery.ts` — derive orgId from session/task context instead of 'org_default'
- `src/app/api/tasks/route.ts` — pass orgId to triggerWebhooks
- `src/app/api/approvals/route.ts` — pass orgId to triggerWebhooks

**Schema impact:** None  
**UI impact:** None  
**Tests:** Update `webhookDelivery.test.ts`  
**Risk:** Low  
**Acceptance:** Webhooks only fire to the org that owns the task; no 'org_default' string in delivery path

---

### PR M-12 — Docs: Post-MVP State Update

**Title:** `docs: update AGENTOPS_CURRENT_STATE and ROADMAP post-MVP build`  
**Goal:** Keep documentation current for future sessions  
**Files:**
- `docs/AGENTOPS_CURRENT_STATE_AND_EXECUTION_PLAN.md` — update status table
- `docs/ROADMAP_AGENTOPS.md` — mark MVP PRs as completed
- `docs/AGENT_CONTEXT_INDEX.md` — add any new patterns from MVP build

**Schema impact:** None  
**UI impact:** None  
**Tests:** None  
**Risk:** None  
**Acceptance:** Docs reflect actual merged state

---

## MVP Summary

| PR | Title | Risk |
|---|---|---|
| M-1 | Module discriminator (Task + Incident) | Low |
| M-2 | SecurityAlert model + CRUD API | Low |
| M-3 | Alert normalization + triage engine | Low |
| M-4 | Manual JSON/CSV import | Low |
| M-5 | Wazuh sample intake | Medium |
| M-6 | Module navigation shell | Low |
| M-7 | Alert UI (list, detail, triage queue) | Low |
| M-8 | SOC incident management | Low |
| M-9 | Executive + evidence reports | Low |
| M-10 | SOC demo seed data | Low |
| M-11 | Fix org_default hard-coding | Low |
| M-12 | Post-MVP docs update | None |

**Total: 12 PRs. Estimated build time: 5–8 days of Claude Code time after M-1 approval.**

---

## Post-MVP Phases

### Phase A — Alert Intelligence (Post-Pilot)

- `feat(soc): Sentry issue webhook receiver`
- `feat(soc): alert deduplication by fingerprint`
- `feat(soc): alert volume anomaly detection`
- `feat(soc): client-facing security summary report`

### Phase B — AI Triage (After Deterministic Baseline)

- `feat(soc): LLM-powered triage (FEATURE_SOC_AI_TRIAGE, uses AgentRole soc-triage-analyst)`
- `feat(soc): triage reasoning explanation in alert detail`
- `feat(soc): confidence score calibration from analyst feedback`

### Phase C — SLA & Compliance

- `feat(soc): SLA configuration per severity tier`
- `feat(soc): SLA breach detection and dashboard widget`
- `feat(soc): SOC 2 / ISO 27001 evidence pack export`
- `feat(soc): mandatory postmortem gate for critical incidents`

### Phase D — Platform Maturity

- `feat: custom policy rules (per-org, DB-backed)` — extends Coder policy engine
- `feat: per-org module entitlements` — enable/disable Coder or SOC per org
- `feat: API key scopes for SOC (soc:read, soc:write, soc:ingest)`
- `feat: Stripe billing integration` — per-module pricing
- `feat: self-service org onboarding`
- `feat: real LLM execution (FEATURE_AGENT_LLM=true)` — wires Coder module
- `feat: RAG embeddings (FEATURE_RAG_EMBED=true)` — wires evidence RAG
- `feat: pgvector migration` — scales EvidenceChunk beyond 10k rows

### Phase E — Mature Platform

- MCP connectors
- Durable workflows
- GraphRAG
- Enterprise SSO (SAML/OIDC)
- Full API SDK
- Partner integrations

---

## Milestone Dates (Targets)

| Milestone | PRs | Target |
|---|---|---|
| SOC MVP sellable | M-1 through M-10 | ~1 week after M-1 merge |
| Platform cleanup | M-11, M-12 | Same sprint as MVP |
| SOC pilot-ready | Phase A (4 PRs) | 2 weeks post-MVP |
| AI triage beta | Phase B (3 PRs) | 1 month post-MVP |
| SaaS v1 | Phase C + D | 3–4 months post-MVP |
| Mature platform | Phase E | 9–18 months |
