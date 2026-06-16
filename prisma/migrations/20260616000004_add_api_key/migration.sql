CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org_default',
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_hashedKey_key" ON "ApiKey"("hashedKey");
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");
