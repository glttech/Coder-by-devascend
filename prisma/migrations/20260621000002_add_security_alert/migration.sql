-- Add SecurityAlert table for SOC module alert intake and triage.
-- This is the core entity for Wazuh/Sentry/manual alert ingestion.

CREATE TABLE IF NOT EXISTS "SecurityAlert" (
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
  "incidentId"           TEXT,
  "rawPayload"           JSONB,
  "alertedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_status_idx"   ON "SecurityAlert"("orgId", "status");
CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_severity_idx" ON "SecurityAlert"("orgId", "severity");
CREATE INDEX IF NOT EXISTS "SecurityAlert_orgId_source_idx"   ON "SecurityAlert"("orgId", "source");
CREATE INDEX IF NOT EXISTS "SecurityAlert_createdAt_idx"      ON "SecurityAlert"("createdAt" DESC);
