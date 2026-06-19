// Pure helper functions for change control and postmortem logic — no DB or external deps.

export type InstructionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'blocked';

export interface StatusSummary {
  total: number;
  draft: number;
  pending_approval: number;
  approved: number;
  executing: number;
  completed: number;
  blocked: number;
}

/**
 * Compute status summary counts from an array of instruction status strings.
 */
export function computeStatusSummary(statuses: string[]): StatusSummary {
  const summary: StatusSummary = {
    total: statuses.length,
    draft: 0,
    pending_approval: 0,
    approved: 0,
    executing: 0,
    completed: 0,
    blocked: 0,
  };
  for (const s of statuses) {
    if (s === 'draft') summary.draft++;
    else if (s === 'pending_approval') summary.pending_approval++;
    else if (s === 'approved') summary.approved++;
    else if (s === 'executing') summary.executing++;
    else if (s === 'completed') summary.completed++;
    else if (s === 'blocked') summary.blocked++;
  }
  return summary;
}

/**
 * Priority order for instruction statuses — lower index means higher urgency.
 * Useful for sorting change requests by urgency.
 */
const STATUS_PRIORITY: Record<string, number> = {
  blocked:          0,
  pending_approval: 1,
  executing:        2,
  approved:         3,
  draft:            4,
  completed:        5,
};

export function instructionStatusPriority(status: string): number {
  return STATUS_PRIORITY[status] ?? 99;
}

/**
 * Sort instructions by urgency (highest priority first).
 * When two instructions have the same priority, sort by createdAt descending.
 */
export function sortByStatusPriority<T extends { status: string; createdAt: Date | string }>(
  instructions: T[]
): T[] {
  return [...instructions].sort((a, b) => {
    const pa = instructionStatusPriority(a.status);
    const pb = instructionStatusPriority(b.status);
    if (pa !== pb) return pa - pb;
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA; // newer first for equal priority
  });
}

// ---------------------------------------------------------------------------
// Postmortem helpers
// ---------------------------------------------------------------------------

export interface PostmortemContent {
  hasSummary: boolean;
  hasTimeline: boolean;
  hasRootCause: boolean;
  hasImpact: boolean;
  hasActionItems: boolean;
  isComplete: boolean;
}

/**
 * Assess how much postmortem content has been recorded for an incident.
 */
export function assessPostmortemContent(incident: {
  description?: string | null;
  timeline?: string | null;
  riskCategory?: string | null;
  reviewerDecision?: string | null;
  followUpAction?: string | null;
}): PostmortemContent {
  const hasSummary = Boolean(incident.description?.trim());
  const hasTimeline = (() => {
    try {
      const parsed = JSON.parse(incident.timeline ?? '[]');
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  })();
  const hasRootCause = Boolean(incident.riskCategory?.trim());
  const hasImpact = Boolean(incident.reviewerDecision?.trim());
  const hasActionItems = Boolean(incident.followUpAction?.trim());
  const isComplete = hasSummary && hasTimeline && hasRootCause && hasImpact && hasActionItems;

  return { hasSummary, hasTimeline, hasRootCause, hasImpact, hasActionItems, isComplete };
}

// ---------------------------------------------------------------------------
// Severity badge helpers
// ---------------------------------------------------------------------------

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

/**
 * Returns the display color for a severity level.
 * Falls back to a muted color for unknown values.
 */
export function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity as SeverityLevel] ?? '#6b7280';
}

/**
 * Returns true if the severity level is "high" or "critical".
 */
export function isSeverityHigh(severity: string): boolean {
  return severity === 'high' || severity === 'critical';
}
