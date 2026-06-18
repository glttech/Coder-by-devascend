-- External Feature Radar (PR 115)
-- Adds FeatureIdea model for tracking market ideas and decisions.

CREATE TABLE IF NOT EXISTS "FeatureIdea" (
  "id"              TEXT         NOT NULL,
  "orgId"           TEXT         NOT NULL DEFAULT 'org_default',
  "sourceUrl"       TEXT,
  "vendor"          TEXT,
  "sourceType"      TEXT         NOT NULL DEFAULT 'manual',
  "title"           TEXT         NOT NULL,
  "description"     TEXT,
  "problemSolved"   TEXT,
  "relevance"       TEXT         NOT NULL DEFAULT 'medium',
  "riskLevel"       TEXT         NOT NULL DEFAULT 'medium',
  "decision"        TEXT         NOT NULL DEFAULT 'under_review',
  "decisionNote"    TEXT,
  "decisionBy"      TEXT,
  "decisionAt"      TIMESTAMP(3),
  "taskId"          TEXT,
  "milestoneId"     TEXT,
  "coderHasFeature" BOOLEAN      NOT NULL DEFAULT false,
  "coderNotes"      TEXT,
  "createdBy"       TEXT         NOT NULL DEFAULT 'system',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "FeatureIdea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeatureIdea_orgId_decision_idx"
  ON "FeatureIdea"("orgId", "decision");

CREATE INDEX IF NOT EXISTS "FeatureIdea_orgId_relevance_idx"
  ON "FeatureIdea"("orgId", "relevance");

CREATE INDEX IF NOT EXISTS "FeatureIdea_vendor_idx"
  ON "FeatureIdea"("vendor");
