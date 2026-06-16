CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org_default',
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Diagram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Diagram_orgId_idx" ON "Diagram"("orgId");
CREATE INDEX "Diagram_entityType_entityId_idx" ON "Diagram"("entityType", "entityId");
