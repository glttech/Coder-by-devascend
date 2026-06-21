-- W-6: Claude Session Intelligence
-- Adds intelligence fields to CliSession and links RepositoryPR to CliSession.
-- All changes are additive (nullable columns / default arrays / new FK).

-- CliSession intelligence fields
ALTER TABLE "CliSession"
  ADD COLUMN "summary"       TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "filesChanged"  TEXT[] NOT NULL DEFAULT '{}';

-- RepositoryPR → CliSession FK (nullable, additive)
ALTER TABLE "RepositoryPR"
  ADD COLUMN "cliSessionId" TEXT;

ALTER TABLE "RepositoryPR"
  ADD CONSTRAINT "RepositoryPR_cliSessionId_fkey"
  FOREIGN KEY ("cliSessionId")
  REFERENCES "CliSession"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "RepositoryPR_cliSessionId_idx" ON "RepositoryPR"("cliSessionId");
