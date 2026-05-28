import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let totalTasks = 0;
  let byStatus: Record<string, number> = {};
  let recentRuns: { id: string; taskId: string; status: string; startedAt: Date }[] = [];
  let pendingApprovals = 0;
  let failedEvaluations = 0;
  let pendingInstructions = 0;
  let blockedInstructions = 0;
  let staleInstructions = 0;
  let sessionsNeedingAction = 0;

  try {
    totalTasks = await prisma.task.count();
    const tasks = await prisma.task.findMany({ include: { agentRuns: { include: { evaluations: true } }, approval: true } });
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.approvalRequired && (!t.approval || t.approval.approved === null)) pendingApprovals++;
      for (const run of t.agentRuns) {
        for (const ev of run.evaluations) { if (!ev.passed) failedEvaluations++; }
        recentRuns.push({ id: run.id, taskId: t.id, status: run.status, startedAt: run.startedAt });
      }
    }
    recentRuns.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    recentRuns = recentRuns.slice(0, 5);

    [pendingInstructions, blockedInstructions] = await Promise.all([
      prisma.instruction.count({ where: { status: 'pending_approval' } }),
      prisma.instruction.count({ where: { status: 'blocked' } }),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    staleInstructions = await prisma.instruction.count({
      where: { status: { in: ['approved', 'executing'] }, updatedAt: { lt: sevenDaysAgo } },
    });

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    sessionsNeedingAction = await prisma.operatorSession.count({
      where: {
        createdAt: { gte: twoDaysAgo },
        AND: [{ recommendedAction: { not: null } }, { recommendedAction: { not: 'CONTINUE' } }],
      },
    });
  } catch (err) {
    console.warn('Database not ready', err);
  }

  const healthWarning = pendingInstructions > 0 || blockedInstructions > 0 || staleInstructions > 0 || sessionsNeedingAction > 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Governance overview for AI-assisted development"
      />

      {/* Overview stats */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Overview</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-card-label">Total Tasks</div>
            <div className="stat-card-value">{totalTasks}</div>
          </div>
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} className="stat-card">
              <div className="stat-card-label">{status.replace(/_/g, ' ')}</div>
              <div className="stat-card-value">{count}</div>
            </div>
          ))}
          <div className="stat-card">
            <div className="stat-card-label">Pending Approvals</div>
            <div className="stat-card-value" style={{ color: pendingApprovals > 0 ? 'var(--amber)' : 'var(--text)' }}>
              {pendingApprovals}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Failed Evaluations</div>
            <div className="stat-card-value" style={{ color: failedEvaluations > 0 ? 'var(--red)' : 'var(--text)' }}>
              {failedEvaluations}
            </div>
          </div>
        </div>
      </div>

      {/* Governance Health */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Governance Health</span>
          <span className={`badge ${healthWarning ? 'badge-warning' : 'badge-success'}`}>
            {healthWarning ? 'Needs attention' : 'All clear'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthCard
            label="Pending Approvals"
            value={pendingInstructions}
            href="/instructions/pending"
            warn={pendingInstructions > 0}
            warnColor="var(--amber)"
            warnBorder="#fde68a"
          />
          <HealthCard
            label="Blocked Instructions"
            value={blockedInstructions}
            href="/tasks"
            warn={blockedInstructions > 0}
            warnColor="var(--red)"
            warnBorder="#fca5a5"
          />
          <HealthCard
            label="Stale (7d+)"
            value={staleInstructions}
            href="/tasks"
            warn={staleInstructions > 0}
            warnColor="var(--purple)"
            warnBorder="#c4b5fd"
            tooltip="Approved/executing instructions not updated in 7+ days"
          />
          <HealthCard
            label="Sessions Needing Action"
            value={sessionsNeedingAction}
            href="/tasks"
            warn={sessionsNeedingAction > 0}
            warnColor="var(--orange)"
            warnBorder="#fdba74"
            tooltip="Operator sessions from last 48h with non-CONTINUE decision"
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
          <Link href="/audit" style={{ color: 'var(--blue)' }}>View audit log →</Link>
          <Link href="/instructions/pending" style={{ color: 'var(--blue)' }}>Review pending instructions →</Link>
        </div>
      </div>

      {/* Recent runs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent Agent Runs</span>
        </div>
        {recentRuns.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No agent runs recorded yet"
            description="Run a prompt from a task detail page to record agent runs and evaluation results here."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/tasks/${run.taskId}`} style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12 }}>
                        {run.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/tasks/${run.taskId}`} style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12 }}>
                        {run.taskId.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={run.status} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {run.startedAt.toISOString().split('T')[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({
  label, value, href, warn, warnColor, warnBorder, tooltip,
}: {
  label: string; value: number; href: string;
  warn: boolean; warnColor: string; warnBorder: string; tooltip?: string;
}) {
  return (
    <Link
      href={href}
      className="health-card"
      style={{ border: warn ? `2px solid ${warnBorder}` : '1px solid var(--border)' }}
      title={tooltip}
    >
      <div className="health-card-label">{label}</div>
      <div className="health-card-value" style={{ color: warn ? warnColor : 'var(--text)' }}>
        {value}
      </div>
    </Link>
  );
}
