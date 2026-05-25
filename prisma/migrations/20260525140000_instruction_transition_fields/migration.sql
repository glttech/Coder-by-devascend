-- AlterTable: add optional fields to support blocked/completed transitions.
-- Additive only — no existing columns removed or made NOT NULL.
ALTER TABLE "Instruction" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "Instruction" ADD COLUMN "completedNotes" TEXT;
