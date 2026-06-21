export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskStatus = string;

export interface SessionStats {
  active: number;
  pending: number;
  completedToday: number;
  failedToday: number;
  totalSessions: number;
}

export interface TaskStats {
  open: number;
  byRisk: { low: number; medium: number; high: number; unknown: number };
  pendingApproval: number;
}

export interface PrStats {
  open: number;
  mergedToday: number;
  ciFailure: number;
}

export interface DashboardStats {
  sessions: SessionStats;
  tasks: TaskStats;
  prs: PrStats;
  repoCount: number;
}

const TERMINAL_TASK_STATUSES = new Set(['completed', 'failed', 'cancelled', 'approved']);
const TERMINAL_SESSION_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function buildSessionStats(
  sessions: { status: string; startedAt: Date | null; completedAt: Date | null }[],
  todayStart: Date,
): SessionStats {
  let active = 0;
  let pending = 0;
  let completedToday = 0;
  let failedToday = 0;

  for (const s of sessions) {
    if (s.status === 'running') active++;
    if (s.status === 'pending') pending++;
    const endTs = s.completedAt ?? s.startedAt;
    if (endTs && endTs >= todayStart) {
      if (s.status === 'completed') completedToday++;
      if (s.status === 'failed') failedToday++;
    }
  }

  return { active, pending, completedToday, failedToday, totalSessions: sessions.length };
}

export function buildTaskStats(
  tasks: { status: string; riskLevel: string; approvalRequired: boolean; approval: { approved: boolean | null } | null }[],
): TaskStats {
  let open = 0;
  let pendingApproval = 0;
  const byRisk = { low: 0, medium: 0, high: 0, unknown: 0 };

  for (const t of tasks) {
    if (!TERMINAL_TASK_STATUSES.has(t.status)) {
      open++;
      const risk = t.riskLevel as keyof typeof byRisk;
      if (risk in byRisk) byRisk[risk]++;
      else byRisk.unknown++;
    }
    if (t.approvalRequired && (!t.approval || t.approval.approved === null)) pendingApproval++;
  }

  return { open, byRisk, pendingApproval };
}

export function buildPrStats(
  prs: { state: string; merged: boolean; ciStatus: string | null; githubMergedAt: Date | null },
  todayStart: Date,
): { open: number; mergedToday: number; ciFailure: number } {
  // Single-PR version for reduce use; see buildPrStatsFromList below
  return {
    open: prs.state === 'open' ? 1 : 0,
    mergedToday: prs.merged && prs.githubMergedAt && prs.githubMergedAt >= todayStart ? 1 : 0,
    ciFailure: prs.ciStatus === 'failure' ? 1 : 0,
  };
}

export function buildPrStatsFromList(
  prs: { state: string; merged: boolean; ciStatus: string | null; githubMergedAt: Date | null }[],
  todayStart: Date,
): PrStats {
  let open = 0;
  let mergedToday = 0;
  let ciFailure = 0;

  for (const pr of prs) {
    if (pr.state === 'open') open++;
    if (pr.merged && pr.githubMergedAt && pr.githubMergedAt >= todayStart) mergedToday++;
    if (pr.ciStatus === 'failure') ciFailure++;
  }

  return { open, mergedToday, ciFailure };
}

export function todayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
