-- Migration: add GitHub tracking fields to Project and create GithubPR model
-- Generated: 2026-06-03
-- DO NOT EXECUTE LIVE without review and backup. Run via: prisma migrate deploy

-- Add GitHub fields to existing Project table (all nullable/have defaults — non-breaking)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "repoOwner" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "repoName" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "defaultBranch" TEXT NOT NULL DEFAULT 'main';

-- Create GithubPR table for imported PR evidence
CREATE TABLE IF NOT EXISTS "GithubPR" (
  "id"                TEXT NOT NULL,
  "projectId"         TEXT NOT NULL,
  "taskId"            TEXT,
  "prNumber"          INTEGER NOT NULL,
  "title"             TEXT NOT NULL,
  "body"              TEXT,
  "author"            TEXT,
  "sourceBranch"      TEXT,
  "baseBranch"        TEXT,
  "state"             TEXT NOT NULL,
  "merged"            BOOLEAN NOT NULL DEFAULT false,
  "mergeSha"          TEXT,
  "labels"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "filesChangedCount" INTEGER,
  "filesChanged"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ciStatus"          TEXT,
  "prUrl"             TEXT,
  "githubCreatedAt"   TIMESTAMP(3),
  "githubUpdatedAt"   TIMESTAMP(3),
  "githubMergedAt"    TIMESTAMP(3),
  "importedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GithubPR_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GithubPR_projectId_prNumber_key" UNIQUE ("projectId", "prNumber")
);

-- Foreign key: GithubPR -> Project
ALTER TABLE "GithubPR"
  ADD CONSTRAINT "GithubPR_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
