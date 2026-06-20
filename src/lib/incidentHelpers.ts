// Pure helper functions for incidents — no DB or external dependencies.

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Map a task risk level string to an incident severity level.
 */
export function incidentSeverityFromRisk(riskLevel: string): IncidentSeverity {
  if (riskLevel === 'high') return 'high';
  if (riskLevel === 'medium') return 'medium';
  return 'low';
}
