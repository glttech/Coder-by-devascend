-- PR Memory Index (Feature 1)
-- Adds classification, bug state, review metadata, and sync tracking to GithubPR.
-- Adds PrSyncState model for incremental sync tracking.
-- All GithubPR additions are nullable; no existing data is altered.

-- GithubPR: new classification + linking fields
ALTER TABLE "GithubPR"
  ADD COLUMN IF NOT EXISTS "milestoneId"          TEXT,
  ADD COLUMN IF NOT EXISTS "agentRunId"           TEXT,
  ADD COLUMN IF NOT EXISTS "classification"       TEXT,
  ADD COLUMN IF NOT EXISTS "classificationSource" TEXT,
  ADD COLUMN IF NOT EXISTS "bugState"             TEXT,
  ADD COLUMN IF NOT EXISTS "reviewDecision"       TEXT,
  ADD COLUMN IF NOT EXISTS "commentCount"         INTEGER,
  ADD COLUMN IF NOT EXISTS "syncedAt"             TIMESTAMP(3);

-- Foreign key: GithubPR.milestoneId → Milestone.id (optional)
ALTER TABLE "GithubPR"
  ADD CONSTRAINT "GithubPR_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- Foreign key: GithubPR.agentRunId → AgentRun.id (optional)
ALTER TABLE "GithubPR"
  ADD CONSTRAINT "GithubPR_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- Indexes for memory search queries
CREATE INDEX IF NOT EXISTS "GithubPR_projectId_classification_idx"
  ON "GithubPR"("projectId", "classification");

CREATE INDEX IF NOT EXISTS "GithubPR_projectId_bugState_idx"
  ON "GithubPR"("projectId", "bugState");

CREATE INDEX IF NOT EXISTS "GithubPR_projectId_githubMergedAt_idx"
  ON "GithubPR"("projectId", "githubMergedAt");

-- PrSyncState: one row per project, tracks incremental sync progress
CREATE TABLE IF NOT EXISTS "PrSyncState" (
  "projectId"          TEXT        NOT NULL,
  "lastSyncedAt"       TIMESTAMP(3),
  "lastSyncedPrNumber" INTEGER,
  "totalSynced"        INTEGER     NOT NULL DEFAULT 0,
  "syncStatus"         TEXT        NOT NULL DEFAULT 'idle',
  "errorMessage"       TEXT,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "PrSyncState_pkey" PRIMARY KEY ("projectId")
);
