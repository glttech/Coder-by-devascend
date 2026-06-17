-- ExecutionTrace: immutable append-only governance trace
-- Hard rule: no UPDATE or DELETE on this table — append-only by convention
CREATE TABLE "ExecutionTrace" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'org_default',
    "taskId" TEXT,
    "agentRunId" TEXT,
    "roleKey" TEXT,
    "promptSent" TEXT,
    "modelUsed" TEXT,
    "toolCallsSummary" TEXT,
    "evidenceRefs" TEXT,
    "riskScore" DOUBLE PRECISION,
    "riskFlags" TEXT,
    "decisionCode" TEXT,
    "approvalState" TEXT,
    "finalOutput" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionTrace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExecutionTrace_orgId_taskId_idx" ON "ExecutionTrace"("orgId", "taskId");
CREATE INDEX "ExecutionTrace_agentRunId_idx" ON "ExecutionTrace"("agentRunId");
