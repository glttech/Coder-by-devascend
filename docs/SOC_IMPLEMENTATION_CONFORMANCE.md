# SOC Implementation Conformance Report

**Version:** 1.0
**Date:** 2026-06-20
**Scope:** Cross-check of merged PR #197 (M-1) and draft PR #198 (M-2) against `SOC_MODULE_PRD.md` and `SOC_MODULE_TRD.md`.
**Status:** Documentation gate — mainline SOC merges are blocked until every divergence below is either resolved or explicitly accepted.

This report is produced by reading the actual implementation artifacts (Prisma schema, migration SQL, route handlers, `.env.example`, `featureFlags.ts`, test files) and comparing them field-by-field against the locked PRD/TRD contracts.

---

## 1. Method

| Source of truth | Artifact read |
|---|---|
| Schema | `prisma/schema.prisma` → `Task`, `Incident`, `SecurityAlert` |
| Migrations | `20260621000001_add_module_discriminator`, `20260621000002_add_security_alert`, `20260621000003_security_alert_hardening` |
| API | `src/app/api/soc/alerts/route.ts`, `src/app/api/soc/alerts/[id]/route.ts` |
| Libraries | `src/lib/orgScope.ts`, `src/lib/soc/rawPayload.ts` |
| Config | `.env.example`, `src/lib/featureFlags.ts` |
| Tests | `src/lib/__tests__/soc/securityAlert.test.ts` (73 tests), `moduleDiscriminator.test.ts` (15 tests) |
| Contracts | `docs/SOC_MODULE_PRD.md`, `docs/SOC_MODULE_TRD.md` |

---

## 2. Conformance — what matches

These items are implemented exactly as the TRD/PRD specify:

| Area | Contract | Implementation | Match |
|---|---|---|---|
| Module discriminator | `Task.module`, `Incident.module` String? default 'coder' | Present in schema + migration 1 | ✅ |
| Incident alert link | `Incident.alertId String?` | Present | ✅ |
| SecurityAlert model | All fields in TRD §1.1 | All present in schema | ✅ |
| Soft-delete | `archivedAt` excludes archived rows | migration 3 + filters in both routes | ✅ |
| GET auth | `requireRole('any')` | `requireRole(user, 'any')` | ✅ |
| POST auth | `requireRole('admin')` | `requireRole(user, 'admin')` | ✅ |
| PATCH auth | `requireRole('admin')` (post-hardening) | `requireRole(user, 'admin')` | ✅ |
| DELETE auth | `requireRole('admin')`, soft-delete only | `requireRole(user, 'admin')`, sets `archivedAt` | ✅ |
| Org scope | every query filtered by `orgId` from session | `getOrgId(user?.userId)` on all reads/writes; cross-org → 404 | ✅ |
| Pagination | compound cursor, bounded limit | `createdAt DESC, id DESC`; cursor `createdAt|id`; limit 1–200 default 50 | ✅ |
| rawPayload safety | size cap + sensitive-key redaction | 100 KB guard + recursive redaction before store | ✅ |
| Validation | title ≤500, severity enum, source enum, description ≤10k, alertedAt ISO | all enforced, 422 on failure | ✅ |
| Audit on create | `soc_alert_created` | emitted | ✅ |
| Audit on triage | `soc_alert_triaged` | emitted | ✅ |
| Tests | ≥1 validation test per route | 73 SOC tests + 15 module tests, all green | ✅ |

---

## 3. Divergences

Seven divergences were found. None are data-destructive. Severity key: **High** = could mislead a builder or ship wrong behavior; **Medium** = doc inaccuracy that will cause confusion; **Low** = cosmetic.

### D-1 — `severity` default not documented (TRD lags code) — Medium

- **Code:** `severity String @default("medium")` (schema) and `"severity" TEXT NOT NULL DEFAULT 'medium'` (migration 2).
- **Doc:** TRD §1.1 shows `severity String // 'info'...` and TRD §2 migration SQL shows `"severity" TEXT NOT NULL,` — both omit the default.
- **Decision:** Code is correct (PRD intent: POST without severity → 'medium'). **Fix the doc.**
- **Resolution:** TRD §1.1 + §2 updated to show `@default("medium")` / `DEFAULT 'medium'`. ✅ applied.

### D-2 — M-1 indexes not documented (TRD lags code) — Medium

- **Code:** migration 1 creates `Task_module_idx`, `Incident_module_idx`, `Incident_createdAt_idx`; schema has `@@index([module])` on both models.
- **Doc:** TRD §1.2/§1.3 and §2 migration-1 SQL omit all three indexes.
- **Decision:** Code is correct (indexes are required by the autonomy schema rules). **Fix the doc.**
- **Resolution:** TRD migration-1 SQL + schema notes updated to include the indexes. ✅ applied.

### D-3 — POST rate limit not documented (TRD lags code) — Low

- **Code:** `POST /api/soc/alerts` enforces `checkLimit(_alertCreateBuckets, ip, 20)` (20 requests per IP window).
- **Doc:** TRD §3.2 does not mention a rate limit (only §3.4 manual ingest mentions 100/hr).
- **Decision:** Code is correct. **Fix the doc.**
- **Resolution:** TRD §3.2 updated with the 20 req/IP limit. ✅ applied.

### D-4 — Audit event set mismatch (TRD lags code) — Medium

- **Code emits:** `soc_alert_created`, `soc_alert_triaged`, `soc_alert_archived`.
- **TRD §7 lists:** `soc_alert_created`, `soc_alert_triaged`, `soc_alert_escalated`, plus incident/report events. It does **not** list `soc_alert_archived`, and it lists `soc_alert_escalated` which is **never emitted** (PATCH emits `soc_alert_triaged` even when `incidentId` is set).
- **Decision:** `soc_alert_archived` is correct and must be documented. `soc_alert_escalated` is a planned M-8 event, not yet wired. **Fix the doc.**
- **Resolution:** TRD §7 updated: `soc_alert_archived` added; `soc_alert_escalated` marked "planned (M-8) — not yet emitted." ✅ applied.

### D-5 — Feature flag claimed present but absent (ROADMAP false claim) — High

- **Doc:** ROADMAP M-5 states the flag is "already in `.env.example` (`FEATURE_WAZUH_INTAKE=false`)." TRD §8 lists `FEATURE_WAZUH_INTAKE`, `FEATURE_SENTRY_INTAKE`, `FEATURE_SOC_AI_TRIAGE` as "checked via `src/lib/featureFlags.ts`."
- **Reality:** `.env.example` contains only `FEATURE_BILLING`, `FEATURE_AGENT_LLM`, `FEATURE_RAG_EMBED`. `featureFlags.ts` defines none of the three SOC flags. **The SOC flags do not exist anywhere in code or config.**
- **Decision:** This is the most material divergence: a builder reading the roadmap would assume the flag exists and ship an endpoint that silently never gates. The flags must be **created in M-5**, not assumed. **Fix the docs** to reflect that the flags are introduced by M-5.
- **Resolution:** ROADMAP M-5 corrected to make "add `FEATURE_WAZUH_INTAKE` to `.env.example` and `featureFlags.ts`" an explicit M-5 deliverable. TRD §8 annotated "added in M-5; not present at M-2." ✅ applied. No code change at M-2 (flags belong to M-5).

### D-6 — AGENTOPS gap-analysis describes a superseded model (internal doc conflict) — Low

- **Doc:** `AGENTOPS_CURRENT_STATE_AND_EXECUTION_PLAN.md` §4.1 (Gap Analysis) proposes `status: 'new'|'triaging'|'escalated'|'remediated'|'closed'` (5 values) and field names `normalizedTitle / normalizedDescription / mitreId`.
- **Locked model (TRD + code):** `status: 'new'|'triaging'|'escalated'|'closed'` (4 values); fields `title / description / mitreTechniqueId`.
- **Decision:** §4 is pre-decision analysis written before the model was locked. It is historical, not authoritative. **Annotate, do not rewrite.**
- **Resolution:** A note added to AGENTOPS §4.1 marking it superseded by the TRD. ✅ applied.

### D-7 — Wazuh "automatic" vs "no live webhook" (PRD vs ROADMAP wording) — Low

- **PRD §5 user story:** "I WANT Wazuh alerts to appear automatically in my triage queue."
- **ROADMAP M-5:** "static sample-format parsing only… no live webhook, no external connectivity."
- **Reconciliation:** Both are true at different layers. MVP code delivers a **receiving endpoint** that accepts a Wazuh-format POST body, flag-gated. Making alerts arrive "automatically" requires the customer to configure their Wazuh integrator to POST to that endpoint — a **deployment step**, outside MVP code scope, requiring separate approval (no env/DEV changes in MVP).
- **Resolution:** PRD §4 Priority 2 annotated to separate "endpoint (in MVP)" from "customer-side Wazuh integrator config (deployment step, separate approval)." ✅ applied.

---

## 4. Divergence summary

| ID | Severity | Direction | Resolution | Code change needed? |
|---|---|---|---|---|
| D-1 | Medium | doc lags code | doc updated | No |
| D-2 | Medium | doc lags code | doc updated | No |
| D-3 | Low | doc lags code | doc updated | No |
| D-4 | Medium | doc lags code | doc updated | No |
| D-5 | High | doc overclaims | doc corrected; flags deferred to M-5 | No (at M-2) |
| D-6 | Low | internal conflict | annotated as superseded | No |
| D-7 | Low | wording | annotated | No |

**Net:** zero code changes are required to bring PR #197 and PR #198 into conformance — every divergence is a documentation correction. The implementation is **ahead of** the docs in three places (severity default, indexes, rate limit, archive audit event) and the docs **overclaimed** in one place (feature flag presence). After the applied resolutions, docs and code are consistent.

---

## 5. Gate status

- [x] All required planning docs exist and are complete (see the **SOC Doc Index** in `AGENT_CONTEXT_INDEX.md`).
- [x] Implementation cross-checked against PRD/TRD (this report).
- [x] Divergences from PR #197 / #198 identified (§3).
- [x] All divergences resolved in-doc (§3 resolutions).
- [x] Architecture + data-flow diagrams produced (`SOC_ARCHITECTURE.md`).
- [x] Roadmap and feature map updated.

**Conclusion:** Documentation is now complete and consistent with the M-1/M-2 implementation. The documentation gate condition for proceeding is satisfied. Mainline merge of PR #198 remains subject to Rahul's explicit approval (separate from this gate).
