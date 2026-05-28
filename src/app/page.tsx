import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, DecisionBadge, RiskBadge } from '@/components/ui/Badge';

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
  let recentTasks: { id: string; title: string; status: string; riskLevel: string; environment: string; createdAt: Date }[] = [];
  let riskyDecisions: { id: string; taskId: string; taskTitle: string; recommendedAction: string; decisionReason: string | null; createdAt: Date }[] = [];

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

    recentTasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, status: true, riskLevel: true, environment: true, createdAt: true },
    });

    const riskySessions = await prisma.operatorSession.findMany({
      where: { AND: [{ recommendedAction: { not: null } }, { recommendedAction: { not: 'CONTINUE' } }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { task: { select: { id: true, title: true } } },
    });
    riskyDecisions = riskySessions.map((s) => ({
      id: s.id,
      taskId: s.task.id,
      taskTitle: s.task.title,
      recommendedAction: s.recommendedAction!,
      decisionReason: s.decisionReason,
      createdAt: s.createdAt,
    }));
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

      {/* Recent Tasks */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent Tasks</span>
          <Link href="/tasks" style={{ fontSize: 12, color: 'var(--blue)' }}>View all →</Link>
        </div>
        {recentTasks.length === 0 ? (
          <EmptyState
            icon="◈"
            title="No tasks yet"
            description="Create your first task to start tracking AI-assisted development work."
            action={<Link href="/tasks/new" className="btn btn-primary">New Task</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Env</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tasks/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {t.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><RiskBadge level={t.riskLevel} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.environment}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {t.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Risky Decisions */}
      {riskyDecisions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Latest Risky Decisions</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Operator sessions requiring action in the last 48h
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {riskyDecisions.map((d) => (
              <Link
                key={d.id}
                href={`/tasks/${d.taskId}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="decision-summary-row">
                  <DecisionBadge decision={d.recommendedAction} />
                  <span className="decision-summary-title">{d.taskTitle}</span>
                  <span className="decision-summary-reason">
                    {d.decisionReason ? d.decisionReason.slice(0, 80) + (d.decisionReason.length > 80 ? '…' : '') : ''}
                  </span>
                  <span className="decision-summary-time">
                    {d.createdAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
