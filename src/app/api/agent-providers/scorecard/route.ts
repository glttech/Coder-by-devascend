import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export function ciPassRate(runs: { testResult: string | null }[]): number {
  if (runs.length === 0) return 0;
  const passing = runs.filter((r) => r.testResult && /pass/i.test(r.testResult)).length;
  return Math.round((passing / runs.length) * 100);
}

export function mostCommonRisk(tasks: { riskLevel: string }[]): string {
  if (tasks.length === 0) return 'unknown';
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.riskLevel] = (counts[t.riskLevel] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export async function GET(_request: Request) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return NextResponse.json(
      { error: roleCheck.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: roleCheck.status },
    );
  }

  const providers = await prisma.agentProvider.findMany({
    include: {
      agentRuns: {
        include: { task: { select: { riskLevel: true } } },
      },
    },
  });

  const unassignedRuns = await prisma.agentRun.findMany({
    where: { providerId: null },
    include: { task: { select: { riskLevel: true } } },
  });

  type ProviderMetric = {
    providerId: string | null;
    providerName: string;
    providerType: string;
    enabled: boolean;
    metrics: {
      totalRuns: number;
      completedRuns: number;
      failedRuns: number;
      runningRuns: number;
      successRate: number;
      ciPassRate: number;
      blockedRate: number;
      avgRiskLevel: string;
      distinctTasks: number;
    };
  };

  const providerMetrics: ProviderMetric[] = providers.map((p) => {
    const runs = p.agentRuns;
    const total = runs.length;
    const completed = runs.filter((r) => r.status === 'succeeded' || r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const running = runs.filter((r) => r.status === 'running').length;
    const tasks = runs.map((r) => r.task).filter(Boolean) as { riskLevel: string }[];
    const distinctTaskIds = new Set(runs.map((r) => r.taskId)).size;

    return {
      providerId: p.id,
      providerName: p.name,
      providerType: p.type,
      enabled: p.enabled,
      metrics: {
        totalRuns: total,
        completedRuns: completed,
        failedRuns: failed,
        runningRuns: running,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        ciPassRate: ciPassRate(runs),
        blockedRate: total > 0 ? Math.round((failed / total) * 100) : 0,
        avgRiskLevel: mostCommonRisk(tasks),
        distinctTasks: distinctTaskIds,
      },
    };
  });

  // Unassigned runs as a synthetic entry
  if (unassignedRuns.length > 0) {
    const total = unassignedRuns.length;
    const completed = unassignedRuns.filter((r) => r.status === 'succeeded' || r.status === 'completed').length;
    const failed = unassignedRuns.filter((r) => r.status === 'failed').length;
    const tasks = unassignedRuns.map((r) => r.task).filter(Boolean) as { riskLevel: string }[];
    providerMetrics.push({
      providerId: null,
      providerName: 'Unassigned',
      providerType: 'unknown',
      enabled: false,
      metrics: {
        totalRuns: total,
        completedRuns: completed,
        failedRuns: failed,
        runningRuns: 0,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        ciPassRate: ciPassRate(unassignedRuns),
        blockedRate: total > 0 ? Math.round((failed / total) * 100) : 0,
        avgRiskLevel: mostCommonRisk(tasks),
        distinctTasks: new Set(unassignedRuns.map((r) => r.taskId)).size,
      },
    });
  }

  const totalRuns = providerMetrics.reduce((s, p) => s + p.metrics.totalRuns, 0);
  const totalCompleted = providerMetrics.reduce((s, p) => s + p.metrics.completedRuns, 0);

  return NextResponse.json({
    providers: providerMetrics,
    summary: {
      totalProviders: providers.length,
      totalRuns,
      overallSuccessRate: totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  });
}
