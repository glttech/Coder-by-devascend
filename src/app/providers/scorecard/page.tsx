import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

function ciPassRate(runs: { testResult: string | null }[]): number {
  if (runs.length === 0) return 0;
  const passing = runs.filter((r) => r.testResult && /pass/i.test(r.testResult)).length;
  return Math.round((passing / runs.length) * 100);
}

function mostCommonRisk(tasks: { riskLevel: string }[]): string {
  if (tasks.length === 0) return 'unknown';
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.riskLevel] = (counts[t.riskLevel] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function successRateBadgeClass(rate: number): string {
  if (rate > 80) return 'badge badge-success';
  if (rate >= 50) return 'badge badge-warning';
  return 'badge badge-sev-high';
}

function riskBadgeClass(risk: string): string {
  if (risk === 'high') return 'badge badge-sev-high';
  if (risk === 'medium') return 'badge badge-warning';
  if (risk === 'low') return 'badge badge-success';
  return 'badge badge-neutral';
}

export default async function ScorecardPage() {
  const providers = await prisma.agentProvider.findMany({
    include: {
      agentRuns: {
        include: { task: { select: { riskLevel: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const unassignedRuns = await prisma.agentRun.findMany({
    where: { providerId: null },
    include: { task: { select: { riskLevel: true } } },
  });

  type ProviderRow = {
    id: string | null;
    name: string;
    type: string;
    enabled: boolean;
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    runningRuns: number;
    successRate: number;
    passRate: number;
    avgRisk: string;
    distinctTasks: number;
  };

  const rows: ProviderRow[] = providers.map((p) => {
    const runs = p.agentRuns;
    const total = runs.length;
    const completed = runs.filter((r) => r.status === 'succeeded' || r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const running = runs.filter((r) => r.status === 'running').length;
    const tasks = runs.map((r) => r.task).filter(Boolean) as { riskLevel: string }[];
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      enabled: p.enabled,
      totalRuns: total,
      completedRuns: completed,
      failedRuns: failed,
      runningRuns: running,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      passRate: ciPassRate(runs),
      avgRisk: mostCommonRisk(tasks),
      distinctTasks: new Set(runs.map((r) => r.taskId)).size,
    };
  });

  if (unassignedRuns.length > 0) {
    const total = unassignedRuns.length;
    const completed = unassignedRuns.filter((r) => r.status === 'succeeded' || r.status === 'completed').length;
    const failed = unassignedRuns.filter((r) => r.status === 'failed').length;
    const tasks = unassignedRuns.map((r) => r.task).filter(Boolean) as { riskLevel: string }[];
    rows.push({
      id: null,
      name: 'Unassigned',
      type: 'unknown',
      enabled: false,
      totalRuns: total,
      completedRuns: completed,
      failedRuns: failed,
      runningRuns: 0,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      passRate: ciPassRate(unassignedRuns),
      avgRisk: mostCommonRisk(tasks),
      distinctTasks: new Set(unassignedRuns.map((r) => r.taskId)).size,
    });
  }

  const totalRuns = rows.reduce((s, r) => s + r.totalRuns, 0);
  const totalCompleted = rows.reduce((s, r) => s + r.completedRuns, 0);
  const overallSuccessRate = totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Agent Reliability Scorecard"
        subtitle={`Per-provider run metrics across ${providers.length} provider${providers.length !== 1 ? 's' : ''}`}
      />

      {/* Summary stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Providers</div>
          <div className="stat-card-value">{providers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Runs</div>
          <div className="stat-card-value">{totalRuns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Overall Success Rate</div>
          <div className="stat-card-value">{overallSuccessRate}%</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No providers yet"
          description="Configure agent providers to start tracking reliability metrics."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Type</th>
                <th>Status</th>
                <th>Total Runs</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Success Rate</th>
                <th>CI Pass Rate</th>
                <th>Avg Risk</th>
                <th>Distinct Tasks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id ?? 'unassigned'}>
                  <td>
                    <span style={{ fontWeight: 500 }}>{row.name}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {row.type}
                    </span>
                  </td>
                  <td>
                    {row.enabled ? (
                      <span className="badge badge-success">enabled</span>
                    ) : (
                      <span className="badge badge-neutral">disabled</span>
                    )}
                  </td>
                  <td>{row.totalRuns}</td>
                  <td>{row.completedRuns}</td>
                  <td>{row.failedRuns}</td>
                  <td>
                    <span className={successRateBadgeClass(row.successRate)}>
                      {row.successRate}%
                    </span>
                  </td>
                  <td>
                    <span className={successRateBadgeClass(row.passRate)}>
                      {row.passRate}%
                    </span>
                  </td>
                  <td>
                    <span className={riskBadgeClass(row.avgRisk)}>{row.avgRisk}</span>
                  </td>
                  <td>{row.distinctTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
        Success rate colour coding: <span className="badge badge-success">&gt;80%</span>{' '}
        <span className="badge badge-warning">50–80%</span>{' '}
        <span className="badge badge-sev-high">&lt;50%</span>
        {' · '}
        <Link href="/api/agent-providers/scorecard" style={{ color: 'var(--blue)', fontSize: 11 }}>
          JSON API
        </Link>
      </div>
    </div>
  );
}
