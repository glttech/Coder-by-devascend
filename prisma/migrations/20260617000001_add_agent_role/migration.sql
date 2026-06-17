-- Add AgentRole table
CREATE TABLE "AgentRole" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org_default',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "allowedTools" TEXT[] NOT NULL DEFAULT '{}',
    "maxRiskLevel" TEXT NOT NULL DEFAULT 'medium',
    "outputFormat" TEXT NOT NULL DEFAULT 'structured_findings',
    "modelPref" TEXT NOT NULL DEFAULT 'claude-opus-4-8',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentRole_orgId_key_key" ON "AgentRole"("orgId", "key");
CREATE INDEX "AgentRole_orgId_idx" ON "AgentRole"("orgId");

-- Add columns to AgentRun (all nullable or have defaults — fully additive)
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "roleKey" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "modelUsed" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "structuredOutput" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "riskScore" DOUBLE PRECISION;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER DEFAULT 0;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER DEFAULT 0;
ALTER TABLE "AgentRun" ADD COLUMN IF NOT EXISTS "cachedTokens" INTEGER DEFAULT 0;
