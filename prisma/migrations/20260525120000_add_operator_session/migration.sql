-- CreateTable
CREATE TABLE "OperatorSession" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "operatorInput" TEXT,
    "generatedPrompt" TEXT,
    "agentTool" TEXT,
    "agentResponse" TEXT,
    "filesMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commandsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationOutput" TEXT,
    "reviewerNotes" TEXT,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedAction" TEXT,
    "seniorApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "decisionReason" TEXT,
    "nextPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "operatorSessionId" TEXT;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_operatorSessionId_fkey" FOREIGN KEY ("operatorSessionId") REFERENCES "OperatorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
