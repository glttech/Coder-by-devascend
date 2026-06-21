-- W-8: Command policy gates
-- Adds CommandPolicy table for storing command allowlists, workdir scopes,
-- and log-scrubbing configuration. Read-only at runtime until W-9+ CLI execution.

CREATE TABLE "CommandPolicy" (
  "id"              TEXT NOT NULL,
  "orgId"           TEXT NOT NULL DEFAULT 'org_default',
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "commandPrefixes" TEXT[] NOT NULL DEFAULT '{}',
  "allowedWorkdirs" TEXT[] NOT NULL DEFAULT '{}',
  "scrubLogs"       BOOLEAN NOT NULL DEFAULT true,
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommandPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommandPolicy_orgId_name_key" ON "CommandPolicy"("orgId", "name");
CREATE INDEX "CommandPolicy_orgId_idx" ON "CommandPolicy"("orgId");
CREATE INDEX "CommandPolicy_enabled_idx" ON "CommandPolicy"("enabled");
