-- AlterTable: add stateVersion as nullable TEXT.
-- Additive only — existing rows get NULL until next update/backfill.
ALTER TABLE "Instruction" ADD COLUMN "stateVersion" TEXT;
