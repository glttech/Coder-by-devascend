import prisma from '@/lib/prisma';

export interface UsageMetrics {
  tasksCreated: number;
  agentRunsTotal: number;
  agentRunsThisMonth: number;
  instructionsTotal: number;
  projectsTotal: number;
  apiKeysActive: number;
}

// orgId is reserved for future multi-tenant support; currently unused as the
// schema has a single implicit organisation.
export async function getUsageMetrics(_orgId: string = 'org_default'): Promise<UsageMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    tasksCreated,
    agentRunsTotal,
    agentRunsThisMonth,
    instructionsTotal,
    projectsTotal,
  ] = await Promise.all([
    prisma.task.count(),
    prisma.agentRun.count(),
    prisma.agentRun.count({ where: { startedAt: { gte: monthStart } } }),
    prisma.instruction.count(),
    prisma.project.count(),
  ]);

  // apiKeysActive is optional — ApiKey table may not exist
  let apiKeysActive = 0;
  try {
    apiKeysActive = await (prisma as any).apiKey?.count({ where: { revokedAt: null } }) ?? 0;
  } catch { /* table may not exist */ }

  return { tasksCreated, agentRunsTotal, agentRunsThisMonth, instructionsTotal, projectsTotal, apiKeysActive };
}

export const PLAN_LIMITS = {
  free: { tasks: 50, runsPerMonth: 100, projects: 3, apiKeys: 2 },
  pro: { tasks: 500, runsPerMonth: 1000, projects: 20, apiKeys: 10 },
  enterprise: { tasks: Infinity, runsPerMonth: Infinity, projects: Infinity, apiKeys: Infinity },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
