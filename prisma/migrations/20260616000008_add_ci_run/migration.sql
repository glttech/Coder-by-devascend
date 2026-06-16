CREATE TABLE "CiRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "prId" TEXT,
  "workflow" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "url" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE INDEX "CiRun_projectId_idx" ON "CiRun"("projectId");
