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

/**
 * Fire-and-forget audit log writer.
 * Errors are swallowed so governance is never blocked by a storage failure.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch {
    // Intentionally silent — audit failures must not interrupt the main flow.
  }
}
