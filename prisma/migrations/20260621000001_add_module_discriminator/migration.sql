-- Add module discriminator to Task and Incident for Coder/SOC separation.
-- All existing rows default to 'coder'. Non-breaking: both columns are nullable with defaults.

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'coder';

ALTER TABLE "Incident"
  ADD COLUMN IF NOT EXISTS "module" TEXT DEFAULT 'coder',
  ADD COLUMN IF NOT EXISTS "alertId" TEXT;

CREATE INDEX IF NOT EXISTS "Task_module_idx" ON "Task"("module");
CREATE INDEX IF NOT EXISTS "Incident_module_idx" ON "Incident"("module");
CREATE INDEX IF NOT EXISTS "Incident_createdAt_idx" ON "Incident"("createdAt" DESC);
