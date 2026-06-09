import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, DecisionBadge, RiskBadge } from '@/components/ui/Badge';
import { summarisePR } from '@/lib/prSummary';

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
  let staleTasks = 0;
  let sessionsNeedingAction = 0;
  let recentTasks: { id: string; title: string; status: string; riskLevel: string; environment: string; createdAt: Date }[] = [];
  let riskyDecisions: { id: string; taskId: string; taskTitle: string; recommendedAction: string; decisionReason: string | null; createdAt: Date }[] = [];
  let totalImportedPRs = 0;
  let failedCIPRs = 0;
  let openPRs = 0;
  let recentGithubPRs: {
    id: string; projectId: string; projectName: string;
    prNumber: number; title: string; body: string | null;
    state: string; merged: boolean; ciStatus: string | null;
    prUrl: string | null; importedAt: Date;
  }[] = [];

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
    staleTasks = await prisma.task.count({
      where: { status: { notIn: ['completed', 'failed'] }, updatedAt: { lt: sevenDaysAgo } },
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

    [totalImportedPRs, failedCIPRs, openPRs] = await Promise.all([
      prisma.githubPR.count(),
      prisma.githubPR.count({ where: { ciStatus: 'failure' } }),
      prisma.githubPR.count({ where: { state: 'open' } }),
    ]);

    const rawPRs = await prisma.githubPR.findMany({
      orderBy: { importedAt: 'desc' },
      take: 6,
      select: {
        id: true, projectId: true, prNumber: true, title: true, body: true,
        state: true, merged: true, ciStatus: true, prUrl: true, importedAt: true,
        project: { select: { name: true } },
      },
    });
    recentGithubPRs = rawPRs.map((p) => ({
      id: p.id, projectId: p.projectId, projectName: p.project.name,
      prNumber: p.prNumber, title: p.title, body: p.body,
      state: p.state, merged: p.merged, ciStatus: p.ciStatus,
      prUrl: p.prUrl, importedAt: p.importedAt,
    }));
  } catch (err) {
    console.warn('Database not ready', err);
  }

  const healthWarning = pendingInstructions > 0 || blockedInstructions > 0 || staleInstructions > 0 || staleTasks > 0 || sessionsNeedingAction > 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of AI-assisted development"
      />

      {/* Getting Started — shown only when no tasks exist */}
      {totalTasks === 0 && (
        <div className="section">
          <div className="card" style={{ background: 'var(--blue-bg, rgba(59,130,246,0.06))', border: '1px solid var(--blue-border, rgba(59,130,246,0.25))' }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title" style={{ fontSize: 16 }}>Getting Started</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  n: '1',
                  title: 'Create a project',
                  desc: 'Connect a GitHub repository so the tool can track pull requests.',
                  href: '/projects/new',
                  label: '→ New Project',
                },
                {
                  n: '2',
                  title: 'Create a task',
                  desc: 'Describe what you want the AI to work on.',
                  href: '/tasks/new',
                  label: '→ New Task',
                },
                {
                  n: '3',
                  title: 'Review suggestions',
                  desc: 'When the AI responds, approve or block its suggestion here.',
                  href: '/instructions/pending',
                  label: '→ Review Queue',
                },
              ].map(({ n, title, desc, href, label }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--blue)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>{n}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}> — {desc}</span>
                  </div>
                  <Link href={href} style={{ color: 'var(--blue)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="section">
        <div className="card">
          <p className="explainer-tagline">
            AI change control for AI-assisted development — every agent change is risk-checked, gated, and audited before it ships.
          </p>
          <div className="explainer-steps">
            {[
              { n: '1', title: 'Create a task', desc: 'Define the work, agent tool, risk level, and environment.' },
              { n: '2', title: 'Generate a safe prompt', desc: 'Get a structured prompt with stop conditions and validation steps.' },
              { n: '3', title: 'Record the agent response', desc: 'Paste what the AI agent did — files, commands, and output.' },
              { n: '4', title: 'Get a risk decision', desc: 'The console flags risk, checks completeness, and recommends the safe next step with a full audit trail.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="explainer-step">
                <div className="explainer-step-num">{n}</div>
                <div>
                  <div className="explainer-step-title">{title}</div>
                  <div className="explainer-step-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
            <div className="stat-card-label">Review Queue</div>
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
          <div className="stat-card">
            <div className="stat-card-label">Imported PRs</div>
            <div className="stat-card-value">{totalImportedPRs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Open PRs</div>
            <div className="stat-card-value">{openPRs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">CI Failures</div>
            <div className="stat-card-value" style={{ color: failedCIPRs > 0 ? 'var(--red)' : 'var(--text)' }}>
              {failedCIPRs}
            </div>
          </div>
        </div>
      </div>

      {/* Review Health */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Review Health</span>
          <span className={`badge ${healthWarning ? 'badge-warning' : 'badge-success'}`}>
            {healthWarning ? 'Needs attention' : 'All clear'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthCard
            label="Review Queue"
            value={pendingInstructions}
            href="/instructions/pending"
            warn={pendingInstructions > 0}
            warnColor="var(--amber)"
            warnBorder="#fde68a"
          />
          <HealthCard
            label="Blocked AI Suggestions"
            value={blockedInstructions}
            href="/tasks"
            warn={blockedInstructions > 0}
            warnColor="var(--red)"
            warnBorder="#fca5a5"
          />
          <HealthCard
            label="Stale AI Suggestions (7d+)"
            value={staleInstructions}
            href="/tasks"
            warn={staleInstructions > 0}
            warnColor="var(--purple)"
            warnBorder="#c4b5fd"
            tooltip="Approved/executing AI suggestions not updated in 7+ days"
          />
          <HealthCard
            label="Stale Tasks (7d+)"
            value={staleTasks}
            href="/tasks"
            warn={staleTasks > 0}
            warnColor="var(--amber)"
            warnBorder="#fde68a"
            tooltip="Non-terminal tasks not updated in 7+ days"
          />
          <HealthCard
            label="AI Reviews Needing Action"
            value={sessionsNeedingAction}
            href="/tasks"
            warn={sessionsNeedingAction > 0}
            warnColor="var(--orange)"
            warnBorder="#fdba74"
            tooltip="AI sessions from the last 48 hours that need follow-up"
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
          <Link href="/audit" style={{ color: 'var(--blue)' }}>View audit log →</Link>
          <Link href="/instructions/pending" style={{ color: 'var(--blue)' }}>Review AI suggestions →</Link>
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
                  <th>Environment</th>
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

      {/* Recent Pull Requests */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent Pull Requests</span>
          <Link href="/projects" style={{ fontSize: 12, color: 'var(--blue)' }}>View projects →</Link>
        </div>
        {recentGithubPRs.length === 0 ? (
          <EmptyState
            icon="⬟"
            title="No PRs imported yet"
            description="No pull requests imported yet. Open a project and import a GitHub pull request to track code reviews here."
            action={<Link href="/projects" className="btn btn-primary">Go to Projects</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Project</th>
                  <th>Title</th>
                  <th>State</th>
                  <th>CI</th>
                  <th>Risk</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                {recentGithubPRs.map((pr) => {
                  const summary = summarisePR(pr.title, pr.body ?? null);
                  const riskColor = ({ low: 'var(--green)', medium: 'var(--amber)', high: 'var(--red)' } as Record<string, string>)[summary.riskLevel] ?? 'var(--text-muted)';
                  return (
                    <tr key={pr.id}>
                      <td>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 12 }}>
                          #{pr.prNumber}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/projects/${pr.projectId}`} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          {pr.projectName}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                          {pr.title.length > 60 ? pr.title.slice(0, 60) + '…' : pr.title}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge badge-${pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'}`}>
                          {pr.merged ? 'merged' : pr.state}
                        </span>
                      </td>
                      <td>
                        {pr.ciStatus ? (
                          <span className={`badge ${pr.ciStatus === 'success' ? 'badge-success' : pr.ciStatus === 'failure' ? 'badge-sev-high' : 'badge-neutral'}`}>
                            {pr.ciStatus}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 600, color: riskColor }}>{summary.riskLevel.toUpperCase()}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pr.importedAt.toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent AI Responses</span>
        </div>
        {recentRuns.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No AI responses recorded yet"
            description="Run a prompt from a task detail page to record AI responses and evaluation results here."
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
