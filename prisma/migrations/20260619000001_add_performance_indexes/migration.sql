-- Performance indexes for pagination and evidence timeline queries.
-- All CREATE INDEX use IF NOT EXISTS — safe to run on a DB that already has them.

-- Task: createdAt index for DESC sort on the task list page (take: 200)
CREATE INDEX IF NOT EXISTS "Task_createdAt_idx"
  ON "Task"("createdAt" DESC);

-- Task: composite index for cursor-based pagination filtered by project
CREATE INDEX IF NOT EXISTS "Task_projectId_createdAt_idx"
  ON "Task"("projectId", "createdAt" DESC);

-- AuditLog: taskId index for evidence timeline lookups (all events for a task)
CREATE INDEX IF NOT EXISTS "AuditLog_taskId_idx"
  ON "AuditLog"("taskId");

-- AuditLog: createdAt index for time-ordered audit queries
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"
  ON "AuditLog"("createdAt" DESC);

-- GithubPR: importedAt index for cursor-based pagination on the PR list API
CREATE INDEX IF NOT EXISTS "GithubPR_importedAt_idx"
  ON "GithubPR"("importedAt" DESC);
