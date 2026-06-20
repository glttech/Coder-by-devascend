# SOC by Devascend — Technical Requirements Document

**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Approved for MVP build  
**Companion:** SOC_MODULE_PRD.md

---

## 1. Database Schema Additions

### 1.1 `SecurityAlert` (new model)

```prisma
model SecurityAlert {
  id                String    @id @default(uuid())
  orgId             String

  // Source
  source            String    // 'wazuh' | 'sentry' | 'manual'
  sourceId          String?   // original ID in source system (for dedup later)
  sourceRef         String?   // URL or reference to original alert

  // Normalized fields
  title             String
  description       String?
  ruleId            String?   // Wazuh rule ID, Sentry issue ID, etc.

  // MITRE
  mitreTactic       String?   // e.g. "Initial Access"
  mitreTechniqueId  String?   // e.g. "T1078"
  mitreTechnique    String?   // e.g. "Valid Accounts"

  // Severity & status
  severity          String    @default("medium")
                              // 'info' | 'low' | 'medium' | 'high' | 'critical'
  status            String    @default("new")
                              // 'new' | 'triaging' | 'escalated' | 'closed'
  triageScore       Float?    // 0.0–1.0 computed by severityScorer

  // Triage
  triageRecommendation  String?   // 'acknowledge' | 'escalate' | 'close'
  triageConfidence      Float?    // 0.0–1.0
  triageReason          String?
  triageBy              String?   // userId who actioned it
  triagedAt             DateTime?

  // Raw payload (for replay/debugging, never rendered as HTML)
  // Max 100 KB serialized. Sensitive keys (password, token, secret, etc.) are
  // automatically redacted before storage by src/lib/soc/rawPayload.ts.
  rawPayload        Json?

  // Relations
  incidentId        String?   // linked Incident (set when escalated to incident)

  // Timestamps
  alertedAt         DateTime  @default(now())  // when the alert fired externally
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // Soft-delete: set by DELETE /api/soc/alerts/[id]; null = active
  archivedAt        DateTime?

  @@index([orgId, status])
  @@index([orgId, severity])
  @@index([orgId, source])
  @@index([createdAt])
}
```

### 1.2 Extend `Incident` (existing model)

Add two nullable fields (non-breaking, default null/`'coder'`) plus indexes:

```prisma
// Add to existing Incident model:
module  String?  @default("coder")  // 'coder' | 'soc'
alertId String?                     // FK to SecurityAlert (SOC only)

@@index([module])
@@index([createdAt])
```

### 1.3 Extend `Task` (existing model)

Add module discriminator (non-breaking) plus index:

```prisma
// Add to existing Task model:
module  String?  @default("coder")  // 'coder' | 'soc'

@@index([module])
```

---

## 2. Migration Plan

### Migration 1: `20260621000001_add_module_discriminator`
```sql
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'coder';

ALTER TABLE "Incident"
  ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'coder',
  ADD COLUMN IF NOT EXISTS "alertId" TEXT;

CREATE INDEX IF NOT EXISTS "Task_module_idx" ON "Task"("module");
CREATE INDEX IF NOT EXISTS "Incident_module_idx" ON "Incident"("module");
CREATE INDEX IF NOT EXISTS "Incident_createdAt_idx" ON "Incident"("createdAt" DESC);
```

### Migration 2: `20260621000002_add_security_alert`
```sql
CREATE TABLE "SecurityAlert" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
  "orgId"                TEXT NOT NULL,
  "source"               TEXT NOT NULL,
  "sourceId"             TEXT,
  "sourceRef"            TEXT,
  "title"                TEXT NOT NULL,
  "description"          TEXT,
  "ruleId"               TEXT,
  "mitreTactic"          TEXT,
  "mitreTechniqueId"     TEXT,
  "mitreTechnique"       TEXT,
  "severity"             TEXT NOT NULL DEFAULT 'medium',
  "status"               TEXT NOT NULL DEFAULT 'new',
  "triageScore"          DOUBLE PRECISION,
  "triageRecommendation" TEXT,
  "triageConfidence"     DOUBLE PRECISION,
  "triageReason"         TEXT,
  "triageBy"             TEXT,
  "triagedAt"            TIMESTAMP(3),
  "rawPayload"           JSONB,
  "incidentId"           TEXT,
  "alertedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_status_idx" ON "SecurityAlert"("orgId", "status");
CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_severity_idx" ON "SecurityAlert"("orgId", "severity");
CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_source_idx" ON "SecurityAlert"("orgId", "source");
CREATE INDEX IF NOT EXISTS "SecurityAlert_createdAt_idx" ON "SecurityAlert"("createdAt" DESC);
```

### Migration 3: `20260621000003_security_alert_hardening`
```sql
ALTER TABLE "SecurityAlert"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
```

**Rules:**
- All migrations are additive; no existing data is touched
- Run in sequence; never together
- Require Rahul approval before executing on any live database

---

## 3. API Contracts

### 3.1 `GET /api/soc/alerts`

**Auth:** `requireRole(user, 'any')`

**Query params:**
- `limit` — integer, 1–200, default 50
- `cursor` — compound cursor `<createdAt ISO>|<id>` for stable pagination (no duplicates on tied timestamps)
- `status` — filter by status (comma-separated: `new,triaging`)
- `severity` — filter by severity (comma-separated: `high,critical`)
- `source` — filter by source (`wazuh`, `sentry`, `manual`)

**Notes:** Archived alerts (`archivedAt IS NOT NULL`) are always excluded. Order is `createdAt DESC, id DESC`.

**Response:**
```json
{
  "alerts": [ SecurityAlert[] ],
  "nextCursor": "2026-06-20T12:00:00.000Z|<uuid>" | null
}
```

### 3.2 `POST /api/soc/alerts`

**Auth:** `requireRole(user, 'admin')`

**Rate limit:** 20 requests per IP window (`checkLimit(_alertCreateBuckets, ip, 20)`); over-limit → 429 with `Retry-After`.

**Body:**
```json
{
  "source": "manual",
  "title": "Suspicious login from unknown IP",
  "description": "...",
  "severity": "high",
  "mitreTactic": "Initial Access",
  "mitreTechniqueId": "T1078",
  "alertedAt": "2026-06-20T10:00:00.000Z"
}
```

**Validation:**
- `title` required, max 500 chars
- `severity` must be one of: `info`, `low`, `medium`, `high`, `critical`
- `source` must be one of: `wazuh`, `sentry`, `manual`
- `description` optional, max 10,000 chars
- `alertedAt` optional ISO date; defaults to `now()`
- `rawPayload` optional JSON object; max 100 KB serialized; sensitive keys auto-redacted before storage

**Response:** `{ "alert": SecurityAlert }` — HTTP 201

### 3.3 `PATCH /api/soc/alerts/[id]`

**Auth:** `requireRole(user, 'admin')`

**Org scope:** `alert.orgId` must match caller's org (cross-org access returns 404)

**Allowed fields:** `status`, `triageRecommendation`, `incidentId`

**Notes:** Archived alerts return 404.

**Response:** Updated `SecurityAlert`

### 3.3b `DELETE /api/soc/alerts/[id]`

**Auth:** `requireRole(user, 'admin')`

**Behavior:** Soft-delete — sets `archivedAt = now()`. Alert is excluded from all list/get queries. No hard delete in MVP.

**Response:** `{ "alert": SecurityAlert }` (with archivedAt set)

### 3.4 `POST /api/soc/alerts/ingest/manual`

**Auth:** API key scoped to `soc:ingest` OR `requireRole(user, 'admin')`

**Body:** JSON array of alert objects OR multipart form-data (CSV file)

**CSV columns:** `title`, `description`, `severity`, `source`, `ruleId`, `mitreTactic`, `mitreTechniqueId`, `alertedAt`

**Processing:**
1. Parse input (JSON array or CSV)
2. Validate each row
3. Normalize via `alertNormalizer.normalizeManual(row)`
4. Bulk insert (skip duplicates by `sourceId` if provided)
5. Return: `{ inserted: N, skipped: N, errors: [] }`

**Rate limit:** 100 requests/hour per IP (bulk ingest)

### 3.5 `POST /api/soc/alerts/ingest/wazuh`

**Auth:** `X-Wazuh-Token` header (API key with `soc:ingest` scope)

**Gated by:** `process.env.FEATURE_WAZUH_INTAKE !== 'true'` → return 503 Service Unavailable

**Important:** MVP scope is static sample-format parsing only. No live Wazuh connection, no new runtime env vars, no DEV deployment. Enabling the flag requires separate approval from Rahul.

**Body:** Standard Wazuh 4.x webhook alert payload:
```json
{
  "id": "1640000000.12345",
  "timestamp": "2026-06-20T10:00:00.000Z",
  "rule": {
    "id": "5402",
    "description": "User missed the password more than 3 times",
    "level": 10,
    "mitre": { "tactic": ["Credential Access"], "id": ["T1110"] }
  },
  "agent": { "id": "001", "name": "web-server-01" },
  "data": { "srcip": "192.168.1.100" },
  "full_log": "..."
}
```

**Normalization:** `alertNormalizer.normalizeWazuh(payload)` → `SecurityAlert`

**Wazuh level → severity mapping:**
- 0–3 → `info`
- 4–6 → `low`
- 7–9 → `medium`
- 10–12 → `high`
- 13–15 → `critical`

### 3.6 SOC Incident APIs

**`GET /api/soc/incidents`** — same as `/api/incidents` but filtered to `module='soc'`

**`POST /api/soc/incidents`** — same as `/api/incidents` but sets `module='soc'`; additionally accepts `alertId` to link the triggering alert

**`PATCH /api/soc/incidents/[id]`** — update lifecycle status, resolution notes, followUpAction

**`GET /api/soc/incidents/[id]/report`** — generate HTML evidence report

**`GET /api/soc/incidents/[id]/pdf`** — PDF download of evidence report

### 3.7 `GET /api/soc/reports/executive`

**Auth:** `requireRole(user, 'any')`

**Query params:**
- `from` — ISO date (default: 30 days ago)
- `to` — ISO date (default: now)

**Response:**
```json
{
  "period": { "from": "...", "to": "..." },
  "alertTotals": { "total": 142, "info": 20, "low": 50, "medium": 40, "high": 25, "critical": 7 },
  "incidentTotals": { "total": 12, "open": 3, "resolved": 9 },
  "slaSummary": { "withinSla": 10, "breached": 2 },
  "topMitreTactics": [ { "tactic": "Initial Access", "count": 18 }, ... ],
  "topSources": [ { "source": "wazuh", "count": 98 }, ... ],
  "severityTrend": [ { "date": "2026-06-14", "critical": 1, "high": 3, ... }, ... ]
}
```

---

## 4. Library Contracts

### 4.1 `src/lib/soc/alertNormalizer.ts`

```typescript
export interface NormalizedAlert {
  orgId: string;
  source: 'wazuh' | 'sentry' | 'manual';
  sourceId?: string;
  sourceRef?: string;
  title: string;
  description?: string;
  ruleId?: string;
  mitreTactic?: string;
  mitreTechniqueId?: string;
  mitreTechnique?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  rawPayload?: unknown;
  alertedAt?: Date;
}

export function normalizeWazuh(payload: unknown, orgId: string): NormalizedAlert;
export function normalizeSentry(payload: unknown, orgId: string): NormalizedAlert;  // post-MVP
export function normalizeManual(row: Record<string, string>, orgId: string): NormalizedAlert;
export function normalizeCsvRow(row: Record<string, string>, orgId: string): NormalizedAlert;
```

**Design rules:**
- Never throws — returns a `NormalizedAlert` with best-effort field population
- Unknown severity values → `'low'`
- Missing title → `'Untitled Alert'`
- All strings are trimmed and sanitized (no HTML)

### 4.2 `src/lib/soc/severityScorer.ts`

```typescript
export interface SeverityScore {
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  score: number;      // 0.0–1.0
  confidence: number; // 0.0–1.0
  reason: string;     // human-readable explanation
  recommendation: 'acknowledge' | 'escalate' | 'close';
}

export function scoreAlert(alert: NormalizedAlert): SeverityScore;
```

**Scoring factors (deterministic, no LLM):**
1. Wazuh rule level (0–15) → base score
2. MITRE tactic present → +0.1
3. Title keyword matching (known critical patterns) → ±0.2
4. Source weight: wazuh=1.0, sentry=0.8, manual=0.9
5. Final score → severity bucket thresholds:
   - 0.0–0.2 → `info`
   - 0.2–0.4 → `low`
   - 0.4–0.6 → `medium`
   - 0.6–0.8 → `high`
   - 0.8–1.0 → `critical`

**Recommendation logic:**
- `critical` or `high` + MITRE tactic present → `escalate`
- `medium` → `acknowledge`
- `low` or `info` → `close`

### 4.3 `src/lib/soc/triageEngine.ts`

```typescript
export interface TriageResult {
  score: SeverityScore;
  suggestedIncidentTitle?: string;  // if escalation recommended
  evidencePoints: string[];          // bullet points for analyst
}

export async function triageAlert(alert: NormalizedAlert): Promise<TriageResult>;
```

**MVP:** Calls `scoreAlert()` only (deterministic). `FEATURE_SOC_AI_TRIAGE=false` → no LLM.

**Future (post-MVP):** When `FEATURE_SOC_AI_TRIAGE=true`, calls Claude API with structured output for richer triage reasoning. Uses `AgentRole` with `key: 'soc-triage-analyst'`.

### 4.4 `src/lib/soc/reportTemplates.ts`

```typescript
export function buildExecutiveReport(data: ExecutiveReportData): string;  // HTML
export function buildClientSummary(data: ClientSummaryData): string;       // HTML
export function buildIncidentEvidenceReport(incident: Incident, alerts: SecurityAlert[], auditLogs: AuditLog[]): string;  // HTML
```

**Design rules:**
- Self-contained HTML (inline CSS, no external resources)
- Print-friendly (same pattern as existing `src/lib/reportTemplates.ts`)
- Color-coded severity: red=critical, orange=high, yellow=medium, green=low, grey=info

---

## 5. Frontend Routes

```
/soc/                           → redirect to /soc/dashboard
/soc/dashboard                  → KPI overview (open alerts, critical count, top tactics)
/soc/alerts                     → alert list with filters (severity, status, source)
/soc/alerts/import              → manual JSON/CSV upload form
/soc/alerts/[id]                → alert detail + triage actions + incident link
/soc/triage                     → triage queue (new + triaging alerts)
/soc/incidents                  → security incident list
/soc/incidents/new              → create incident (manual or from alert)
/soc/incidents/[id]             → incident detail + timeline + evidence notes
/soc/incidents/[id]/report      → HTML evidence report
/soc/reports/executive          → CEO/CISO executive report + PDF export
```

---

## 6. Sidebar Navigation

SOC section appears in `SidebarNav.tsx` when `module === 'soc'` is active:

```
── SOC
   ├── Dashboard
   ├── Alert Queue
   ├── Triage
   ├── Incidents
   └── Reports
      ├── Executive
      └── Client Summary
```

Module switcher appears at the top of the sidebar:
```
[ Coder ▼ ]   ← dropdown: Coder | SOC
```

User's active module stored in `localStorage` (client-side preference, not server state).

---

## 7. Audit Events (SOC)

| Event | Trigger | Status |
|---|---|---|
| `soc_alert_created` | New SecurityAlert created (any source) | ✅ emitted (M-2) |
| `soc_alert_triaged` | Alert status / triage / incidentId changed via PATCH | ✅ emitted (M-2) |
| `soc_alert_archived` | Alert soft-deleted via DELETE (`archivedAt` set) | ✅ emitted (M-2) |
| `soc_alert_escalated` | Alert linked to a security incident | ⏳ planned (M-8) — **not yet emitted**; M-2 PATCH currently logs `soc_alert_triaged` even when `incidentId` is set |
| `soc_incident_created` | Security incident opened | ⏳ planned (M-8) |
| `soc_incident_status_changed` | Status transition | ⏳ planned (M-8) |
| `soc_incident_resolved` | Incident closed | ⏳ planned (M-8) |
| `soc_report_generated` | Executive or client report generated | ⏳ planned (M-9) |
| `soc_alert_ingested_batch` | Bulk import (N alerts) | ⏳ planned (M-4) |

All events use existing `writeAudit()` — same table, same pattern, `event` field prefixed with `soc_`.

---

## 8. Feature Flags

| Flag | Default | Controls | Present? |
|---|---|---|---|
| `FEATURE_WAZUH_INTAKE` | `false` | Enable `/api/soc/alerts/ingest/wazuh` endpoint | ❌ **added in M-5** |
| `FEATURE_SENTRY_INTAKE` | `false` | Enable `/api/soc/alerts/ingest/sentry` endpoint (post-MVP) | ❌ post-MVP |
| `FEATURE_SOC_AI_TRIAGE` | `false` | Enable LLM-powered triage (post-MVP) | ❌ post-MVP |

> **Conformance note (D-5):** As of M-2, **none** of these SOC flags exist. `.env.example`
> currently defines only `FEATURE_BILLING`, `FEATURE_AGENT_LLM`, `FEATURE_RAG_EMBED`, and
> `src/lib/featureFlags.ts` defines no SOC flags. `FEATURE_WAZUH_INTAKE` must be **created in
> M-5** by adding it to both `.env.example` and `src/lib/featureFlags.ts` (extend the
> `FeatureFlags` interface + `getFeatureFlags()`). Until then, no SOC endpoint is flag-gated.

All checked via `src/lib/featureFlags.ts`. Adding new flags requires updating that file and `.env.example`.

---

## 9. Testing Requirements

| Test file | Coverage |
|---|---|
| `src/lib/__tests__/soc/alertNormalizer.test.ts` | Wazuh payload normalization, CSV parsing, edge cases |
| `src/lib/__tests__/soc/severityScorer.test.ts` | All severity tiers, recommendation logic, edge cases |
| `src/lib/__tests__/soc/triageEngine.test.ts` | Triage result shape, deterministic scoring, feature flag gating |
| `src/lib/__tests__/soc/securityAlert.test.ts` | Alert CRUD validation, status transitions |
| `src/lib/__tests__/soc/socIncidents.test.ts` | SOC incident lifecycle, module discriminator |
| `src/lib/__tests__/soc/socReportTemplates.test.ts` | HTML report generation, required fields |
| `src/lib/__tests__/soc/wazuhIngest.test.ts` | Wazuh endpoint: valid payload, invalid payload, feature flag off |

**Coverage target:** All SOC lib functions have ≥1 unit test. All SOC API routes have ≥1 validation test.

---

## 10. Security Requirements

- All `/api/soc/*` routes require auth (no public endpoints except shared reports with share-link tokens)
- Wazuh ingest endpoint validates `X-Wazuh-Token` via API key lookup (hashed, constant-time compare)
- `rawPayload` field is stored as-is (no HTML sanitization) — never rendered directly to UI; always JSON-encoded
- `SecurityAlert` data is org-scoped: every query must filter by `orgId` derived from session
- Module boundary enforced: `/api/soc/*` routes never query `Task` or Coder-module `Incident` records without explicit `module` filter

---

## 11. Out of Scope (Confirmed)

- LLM/AI triage in MVP (deterministic only)
- File attachment upload (no S3 in MVP; evidence is text metadata)
- Real email notifications (Resend stub stays)
- Alert deduplication by fingerprint (post-pilot)
- Asset inventory
- SLA breach notifications (SLA fields in DB but no notification trigger)
- Sentry intake (post-pilot)
- Wazuh live API polling (webhook-only in MVP)
