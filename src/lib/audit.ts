/**
 * writeAudit — lightweight helper to persist an audit log entry.
 *
 * All fields except `event` are optional; pass only what is relevant for the
 * operation being recorded.
 */
import prisma from '@/lib/prisma';

export interface AuditEntry {
  event: string;
  details?: string;
  userId?: string;
  taskId?: string;
  agentRunId?: string;
  operatorSessionId?: string;
  instructionId?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch {
    // Audit failures must never break the main flow.
    console.error('[audit] Failed to write audit log', entry);
  }
}
