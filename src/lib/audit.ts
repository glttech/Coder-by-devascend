import prisma from './prisma';

export interface AuditEntry {
  event: string;
  details?: string;
  taskId?: string;
  agentRunId?: string;
  operatorSessionId?: string;
  instructionId?: string;
  userId?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({ data: entry });
}
