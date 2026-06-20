# SOC by Devascend — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Approved for MVP build  
**Decisions locked by:** Rahul Swami

---

## 1. Problem Statement

Security operations teams drown in alert noise. Wazuh, Sentry, and manual reports generate dozens to hundreds of alerts daily. Today's tools:
- Require manual copy-paste between alert tool and incident tracker
- Have no AI-assisted severity triage
- Produce no audit trail for compliance
- Cannot generate a clean executive report for the CEO or a client in minutes

**SOC by Devascend** solves this by bringing the same governance-first, evidence-backed approach used in Coder to the security operations vertical.

---

## 2. Target Personas

### Primary: Security Operations Analyst (SOC Analyst)
- Receives alerts from Wazuh (HIDS/NIDS) or Sentry (application errors)
- Needs to triage 20–50 alerts per shift
- Wants AI-assisted severity recommendation, not AI-only decisions
- Must log every action for compliance (SOC 2, ISO 27001)

### Secondary: CISO / Security Lead
- Needs weekly/monthly executive summary
- Wants trend data: how many critical incidents, SLA compliance, top threat categories
- Does not work in the tool daily — reads reports

### Tertiary: Managed Service Client
- External customer of a Devascend-powered MSSP
- Receives whitelabeled security summary report
- Does not log into the platform — receives PDF/link

### Out of scope for MVP
- Red team / penetration testing workflows
- Threat hunting
- SOAR playbook automation

---

## 3. MVP Scope (Sellable MVP — 10-12 PRs)

The sellable MVP must enable a SOC analyst to:

1. **Import alerts** from manual JSON/CSV upload, or Wazuh sample format
2. **See a triage queue** of unactioned alerts with AI-recommended severity
3. **Manage security incidents** (open → investigating → resolved lifecycle)
4. **Capture evidence** as text metadata linked to incidents
5. **Generate a CEO/CISO executive report** for any time period
6. **Navigate SOC separately** from Coder via clean `/soc/*` URL namespace

---

## 4. Alert Sources (MVP Priority Order)

### Priority 1: Manual Import (JSON or CSV)
- UI upload form at `/soc/alerts/import`
- Accepts JSON array of alert objects or CSV with normalized columns
- Flexible field mapping: title, description, severity, source, timestamp, ruleId
- Useful for: demo scenarios, migrating from legacy tools, ad-hoc alert ingestion

### Priority 2: Wazuh Sample Import
- POST endpoint at `/api/soc/alerts/ingest/wazuh`
- Accepts Wazuh alert JSON format (standard Wazuh 4.x webhook payload)
- Normalizes to `SecurityAlert` schema automatically
- Protected by `X-Wazuh-Token` header (API key scoped to `soc:ingest`)
- Gated by `FEATURE_WAZUH_INTAKE=false` env flag (default off)

### Priority 3: Sentry (Post-MVP)
- Sentry issue webhook receiver
- Normalize Sentry issue → `SecurityAlert` with `source: 'sentry'`
- Deferred until after pilot customer feedback

---

## 5. User Stories

### Alert Intake
- **AS** a SOC analyst **I WANT** to upload a CSV/JSON of alerts **SO THAT** I can populate the triage queue without manual entry
- **AS** a SOC analyst **I WANT** Wazuh alerts to appear automatically in my triage queue **SO THAT** I don't miss HIDS events
- **AS** a SOC analyst **I WANT** each alert to show source, severity, MITRE tactic, and timestamp **SO THAT** I can quickly assess priority

### Triage
- **AS** a SOC analyst **I WANT** an AI-recommended severity for each alert **SO THAT** I can triage faster without losing judgment
- **AS** a SOC analyst **I WANT** to acknowledge, escalate, or close an alert from the triage queue **SO THAT** the queue shrinks as I work
- **AS** a CISO **I WANT** to see which alerts were escalated vs closed without action **SO THAT** I can audit the team's judgment

### Incident Management
- **AS** a SOC analyst **I WANT** to create a security incident from one or more alerts **SO THAT** related alerts are grouped for investigation
- **AS** a SOC analyst **I WANT** to track incident status (open → investigating → resolved) **SO THAT** nothing falls through the cracks
- **AS** a CISO **I WANT** critical incidents to have a mandatory postmortem report **SO THAT** we capture lessons learned for compliance

### Evidence & Audit
- **AS** a SOC analyst **I WANT** to add evidence notes to an incident (IOCs, commands run, findings) **SO THAT** the investigation record is complete
- **AS** a compliance auditor **I WANT** an immutable audit trail of every action taken on an alert or incident **SO THAT** we can prove chain of custody
- **AS** a SOC analyst **I WANT** to export an incident's full evidence as a PDF **SO THAT** I can share it with stakeholders

### Reporting
- **AS** a CISO **I WANT** a one-click executive report showing: total alerts, severity breakdown, SLA compliance, top MITRE tactics **SO THAT** I can present to the board in minutes
- **AS** a managed service operator **I WANT** to generate a client-facing security summary **SO THAT** my customers know what happened and what was fixed

---

## 6. MVP Feature List

| # | Feature | Priority | Phase |
|---|---|---|---|
| 1 | SecurityAlert model + CRUD API | P0 | 2 |
| 2 | Manual JSON/CSV alert import | P0 | 4 |
| 3 | Wazuh sample alert intake | P0 | 4 |
| 4 | Alert normalization (Wazuh → SecurityAlert) | P0 | 4 |
| 5 | MITRE ATT&CK field mapping (basic) | P1 | 4 |
| 6 | Deterministic triage engine (severity scoring) | P0 | 5 |
| 7 | Triage queue UI (`/soc/triage`) | P0 | 3 |
| 8 | Alert list + detail pages | P0 | 3 |
| 9 | Incident lifecycle (extend Incident model with `module='soc'`) | P0 | 2 |
| 10 | Incident detail page with evidence notes | P0 | 3 |
| 11 | CEO/CISO executive report (HTML + PDF) | P0 | 6 |
| 12 | Client security summary report | P1 | 6 |
| 13 | SOC module navigation (`/soc/*` namespace) | P0 | 3 |
| 14 | SOC executive dashboard (`/soc/dashboard`) | P1 | 3 |
| 15 | Module discriminator on Task + Incident | P0 | 1 |
| 16 | SOC demo seed data | P1 | 7 |

**Out of scope for MVP:**
- AI triage via paid LLM (deterministic scoring only)
- Sentry intake (post-pilot)
- File attachment upload (S3/storage)
- SLA breach notifications
- Wazuh live streaming (webhook only, sample format)
- Asset inventory
- Alert deduplication (post-pilot)

---

## 7. Decisions Locked

| Decision | Value |
|---|---|
| Alert sources in MVP | Manual JSON/CSV first; Wazuh sample second; Sentry deferred |
| Data model | Add `module` discriminator to existing `Incident`; create dedicated `SecurityAlert` model; no separate `SecurityIncident` model |
| URL routing | Clean `/soc/*` namespace (pages) + `/api/soc/*` (routes) |
| AI triage | Deterministic rules only in MVP; no paid LLM API activation |
| Evidence storage | DB-stored text metadata only; no file upload to S3 in MVP |
| Email notifications | Keep Resend stub only; no real emails sent |
| Postmortem | Include template/report workflow; not live notification trigger |
| Pricing direction | Per-module SaaS + managed-service pilot package |

---

## 8. Non-Goals

- This is NOT a SIEM replacement (no log aggregation, no raw log storage)
- This is NOT a SOAR (no automated remediation playbooks)
- This is NOT a threat intelligence platform (no IOC feeds, no threat hunting)
- This does NOT replace Wazuh, Sentry, or any monitoring tool — it governs their alerts

---

## 9. Success Metrics (Pilot)

| Metric | Target |
|---|---|
| Time to triage one alert (with AI assist) | < 2 minutes |
| Time to generate CEO/CISO report | < 30 seconds |
| Audit completeness | 100% of actions logged |
| Pilot customer NPS | > 7 |
| Alert false positive rate flagged | Visible in dashboard |

---

## 10. Acceptance Criteria for Sellable MVP

1. A SOC analyst can upload a CSV of 50 alerts and see them in the triage queue within 10 seconds
2. Each alert shows: source, normalized severity, MITRE tactic (if available), timestamp, status
3. Analyst can change alert status (new → triaging → closed) from both queue and detail view
4. Analyst can create a security incident from one or more alerts
5. Incident has: title, severity, status, timeline, linked alerts, evidence notes
6. CISO can download a PDF executive report showing totals and severity breakdown
7. Every status change is logged in the immutable audit trail
8. `/soc/*` routes are completely separate from Coder routes — no cross-module data leakage
9. CI passes: typecheck, lint, all tests green
10. Demo seed populates 20 realistic alerts and 3 incidents for sales demos
