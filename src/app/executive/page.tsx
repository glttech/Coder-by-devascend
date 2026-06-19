import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import {
  computeProjectHealth,
  healthSignal,
} from '@/lib/projectHealth';

export const dynamic = 'force-dynamic';

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, React.CSSProperties> = {
    critical: { background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
    high:     { background: 'rgba(249,115,22,0.1)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.3)' },
    medium:   { background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' },
    low:      { background: 'rgba(34,197,94,0.1)',  color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
  };
  const style = styles[severity] ?? { background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.3)' };
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    open:          { background: 'rgba(239,68,68,0.1)',   color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
    investigating: { background: 'rgba(249,115,22,0.1)',  color: '#ea580c', border: '1px solid rgba(249,115,22,0.3)' },
    resolved:      { background: 'rgba(34,197,94,0.1)',   color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
    closed:        { background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.3)' },
  };
  const style = styles[status] ?? { background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.3)' };
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, React.CSSProperties> = {
    CRITICAL: { background: 'rgba(239,68,68,0.15)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700 },
    HIGH:     { background: 'rgba(249,115,22,0.15)', color: '#c2410c', border: '1px solid rgba(249,115,22,0.4)' },
    MEDIUM:   { background: 'rgba(245,158,11,0.1)',  color: '#b45309', border: '1px solid rgba(245,158,11,0.3)' },
    LOW:      { background: 'rgba(34,197,94,0.1)',   color: '#15803d', border: '1px solid rgba(34,197,94,0.3)' },
  };
  const upper = level.toUpperCase();
  const style = styles[upper] ?? {};
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
      {upper}
    </span>
  );
}

function HealthSignalBadge({ signal }: { signal: 'critical' | 'warning' | 'clear' }) {
  const styles: Record<string, React.CSSProperties> = {
    critical: { background: 'rgba(239,68,68,0.1)',   color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
    warning:  { background: 'rgba(245,158,11,0.1)',  color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' },
    clear:    { background: 'rgba(34,197,94,0.1)',   color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
  };
  return (
    <span style={{ ...styles[signal], padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {signal}
    </span>
  );
}

export default async function ExecutivePage() {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'any');
  if (!authResult.ok) redirect('/login');

  // Org-wide summary counts
  const [
    totalProjects,
    totalTasks,
    totalAgentRuns,
    totalPRs,
    totalIncidents,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.task.count(),
    prisma.agentRun.count(),
    prisma.githubPR.count(),
    prisma.incident.count(),
  ]);

  // Projects table data
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tasks: { select: { id: true } },
      githubPRs: {
        select: {
          id: true, state: true, merged: true, ciStatus: true,
          title: true, body: true, importedAt: true, updatedAt: true, syncedAt: true,
        },
      },
      _count: { select: { ciRuns: true } },
    },
  });

  const projectRows = projects.map((project) => {
    const taskCount = project.tasks.length;
    const openPRs = project.githubPRs.filter((pr) => pr.state === 'open' && !pr.merged).length;
    const failedCIPRs = project.githubPRs.filter((pr) => pr.ciStatus === 'failure').length;
    const agentRunCount = project._count.ciRuns; // CiRun per project (proxy)

    // Compute health signal from PRs
    const prHealthInputs = project.githubPRs.map((pr) => ({
      title: pr.title,
      body: pr.body,
      state: pr.state,
      merged: pr.merged,
      ciStatus: pr.ciStatus,
      importedAt: pr.importedAt,
      updatedAt: pr.updatedAt,
    }));
    const health = computeProjectHealth(prHealthInputs);
    const signal = healthSignal(health);

    // Last PR sync
    const latestSync = project.githubPRs
      .map((pr) => pr.syncedAt ?? pr.importedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: project.id,
      name: project.name,
      taskCount,
      openPRs,
      failedCIPRs,
      agentRunCount,
      lastPRSync: latestSync ?? null,
      signal,
    };
  });

  // Recent incidents (last 5)
  const recentIncidents = await prisma.incident.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { task: { select: { id: true, title: true, projectId: true } } },
  });

  // Top risk tasks
  const topRiskTasks = await prisma.task.findMany({
    where: { riskLevel: { in: ['critical', 'high'] } },
    orderBy: [{ riskLevel: 'desc' }, { createdAt: 'desc' }],
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      riskLevel: true,
      project: { select: { id: true, name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Org-wide metrics and risk overview"
      />

      {/* Summary row */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Summary</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-card-label">Total Projects</div>
            <div className="stat-card-value">{totalProjects}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Tasks</div>
            <div className="stat-card-value">{totalTasks}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Agent Runs</div>
            <div className="stat-card-value">{totalAgentRuns}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">PRs Imported</div>
            <div className="stat-card-value">{totalPRs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total Incidents</div>
            <div className="stat-card-value" style={{ color: totalIncidents > 0 ? 'var(--amber)' : 'var(--text)' }}>
              {totalIncidents}
            </div>
          </div>
        </div>
      </div>

      {/* Projects table */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Projects</span>
          <Link href="/projects" style={{ fontSize: 12, color: 'var(--blue)' }}>View all →</Link>
        </div>
        {projectRows.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No projects yet.</p>
          </Card>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Tasks</th>
                  <th>Open PRs</th>
                  <th>Failed CI PRs</th>
                  <th>CI Runs</th>
                  <th>Last PR Sync</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/projects/${row.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {row.name}
                      </Link>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.taskCount}</td>
                    <td style={{ fontSize: 13 }}>{row.openPRs}</td>
                    <td style={{ fontSize: 13, color: row.failedCIPRs > 0 ? 'var(--red)' : 'inherit' }}>
                      {row.failedCIPRs}
                    </td>
                    <td style={{ fontSize: 13 }}>{row.agentRunCount}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {row.lastPRSync
                        ? row.lastPRSync.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <HealthSignalBadge signal={row.signal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent incidents */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent Incidents</span>
          <Link href="/incidents" style={{ fontSize: 12, color: 'var(--blue)' }}>View all →</Link>
        </div>
        {recentIncidents.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No incidents — all clear.</p>
          </Card>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Task</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td><SeverityBadge severity={incident.severity} /></td>
                    <td style={{ fontWeight: 500 }}>
                      <Link href={`/incidents/${incident.id}`} style={{ color: 'var(--text)' }}>
                        {incident.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={incident.status} /></td>
                    <td style={{ fontSize: 12 }}>
                      {incident.task ? (
                        <Link href={`/tasks/${incident.task.id}`} style={{ color: 'var(--blue)' }}>
                          {incident.task.title.length > 40
                            ? incident.task.title.slice(0, 40) + '…'
                            : incident.task.title}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {incident.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top risk tasks */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Top Risk Tasks</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CRITICAL &amp; HIGH risk — up to 10</span>
        </div>
        {topRiskTasks.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No high-risk tasks.</p>
          </Card>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {topRiskTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/tasks/${task.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {task.title.length > 60 ? task.title.slice(0, 60) + '…' : task.title}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/projects/${task.project.id}`} style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {task.project.name}
                      </Link>
                    </td>
                    <td><RiskBadge level={task.riskLevel} /></td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.status}</span>
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
