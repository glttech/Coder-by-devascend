CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "agentRunId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "timeline" TEXT,
    "failedCommand" TEXT,
    "failedTest" TEXT,
    "riskCategory" TEXT,
    "reviewerDecision" TEXT,
    "followUpAction" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
