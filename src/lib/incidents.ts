import prisma from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { type IncidentSeverity, incidentSeverityFromRisk } from '@/lib/incidentHelpers';

export type { IncidentSeverity };
export { incidentSeverityFromRisk };

export type IncidentTrigger = 'ci_failure' | 'reviewer_block' | 'policy_block' | 'run_failure' | 'manual_rollback';

export interface CreateIncidentInput {
  taskId?: string;
  agentRunId?: string;
  title: string;
  description?: string;
  trigger: IncidentTrigger;
  severity?: IncidentSeverity;
  failedCommand?: string;
  failedTest?: string;
  riskCategory?: string;
  reviewerDecision?: string;
  userId?: string | null;
}

export async function createIncident(input: CreateIncidentInput) {
  const incident = await prisma.incident.create({
    data: {
      taskId: input.taskId,
      agentRunId: input.agentRunId,
      title: input.title,
      description: input.description,
      trigger: input.trigger,
      severity: input.severity ?? 'medium',
      riskCategory: input.riskCategory,
      failedCommand: input.failedCommand,
      failedTest: input.failedTest,
      reviewerDecision: input.reviewerDecision,
      timeline: JSON.stringify([{
        timestamp: new Date().toISOString(),
        event: `Incident created: ${input.trigger}`,
        actor: input.userId ?? 'system',
      }]),
    },
  });

  await writeAudit({
    taskId: input.taskId,
    agentRunId: input.agentRunId,
    event: 'incident_created',
    details: JSON.stringify({ incidentId: incident.id, trigger: input.trigger, severity: incident.severity }),
    userId: input.userId ?? null,
  });

  return incident;
}
