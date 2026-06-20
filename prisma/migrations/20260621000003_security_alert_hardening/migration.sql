-- M-2 hardening: add soft-delete support to SecurityAlert.
-- archivedAt is null for active alerts; set on soft-delete (DELETE endpoint).
-- All queries filter archivedAt IS NULL to exclude archived rows.

ALTER TABLE "SecurityAlert"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
