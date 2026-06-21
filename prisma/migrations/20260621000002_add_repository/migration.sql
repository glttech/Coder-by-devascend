-- CreateTable Repository
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org_default',
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "private" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable RepositoryPR
CREATE TABLE "RepositoryPR" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "taskId" TEXT,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "author" TEXT,
    "sourceBranch" TEXT,
    "baseBranch" TEXT,
    "state" TEXT NOT NULL,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "mergeSha" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filesChangedCount" INTEGER,
    "ciStatus" TEXT,
    "prUrl" TEXT,
    "githubCreatedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "githubMergedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepositoryPR_pkey" PRIMARY KEY ("id")
);

-- Add repoId to CliSession
ALTER TABLE "CliSession" ADD COLUMN "repoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Repository_orgId_owner_repo_key" ON "Repository"("orgId", "owner", "repo");
CREATE INDEX "Repository_orgId_idx" ON "Repository"("orgId");
CREATE UNIQUE INDEX "RepositoryPR_repoId_prNumber_key" ON "RepositoryPR"("repoId", "prNumber");
CREATE INDEX "RepositoryPR_repoId_idx" ON "RepositoryPR"("repoId");
CREATE INDEX "RepositoryPR_taskId_idx" ON "RepositoryPR"("taskId");
CREATE INDEX "RepositoryPR_state_idx" ON "RepositoryPR"("state");
CREATE INDEX "CliSession_repoId_idx" ON "CliSession"("repoId");

-- AddForeignKey
ALTER TABLE "RepositoryPR" ADD CONSTRAINT "RepositoryPR_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepositoryPR" ADD CONSTRAINT "RepositoryPR_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CliSession" ADD CONSTRAINT "CliSession_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;
