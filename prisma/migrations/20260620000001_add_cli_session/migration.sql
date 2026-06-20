-- W-2: CliSession — tracks individual Claude Code CLI executions.
-- Additive only. Safe to run multiple times (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS "CliSession" (
  "id"          TEXT         NOT NULL,
  "taskId"      TEXT,
  "command"     TEXT         NOT NULL,
  "workingDir"  TEXT         NOT NULL DEFAULT '',
  "status"      TEXT         NOT NULL DEFAULT 'pending',
  "exitCode"    INTEGER,
  "logLines"    JSONB,
  "startedAt"   TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CliSession_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CliSession"
    ADD CONSTRAINT "CliSession_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CliSession_taskId_idx"    ON "CliSession"("taskId");
CREATE INDEX IF NOT EXISTS "CliSession_status_idx"    ON "CliSession"("status");
CREATE INDEX IF NOT EXISTS "CliSession_createdAt_idx" ON "CliSession"("createdAt");
