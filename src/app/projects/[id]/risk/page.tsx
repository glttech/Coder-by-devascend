import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskBadge } from '@/components/ui/Badge';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function RiskPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return <div style={{ padding: 32 }}>Unauthorized</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
      </div>
    );
  }

  // Get all task IDs for this project
  const taskIds = await prisma.task.findMany({
    where: { projectId: params.id },
    select: { id: true },
  });
  const taskIdList = taskIds.map((t) => t.id);

  // Parallel queries
  const [riskGroups, policyEvents, regressionPRs, failedCIPRs] = await Promise.all([
    // Risk summary by riskLevel
    prisma.task.groupBy({
      by: ['riskLevel'],
      where: { projectId: params.id },
      _count: { _all: true },
    }),

    // Policy gate audit log events for tasks in this project
    taskIdList.length > 0
      ? prisma.auditLog.findMany({
          where: {
            taskId: { in: taskIdList },
            event: { in: ['policy_gate_blocked', 'policy_gate_approved'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            event: true,
            details: true,
            createdAt: true,
            task: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),

    // Regression risk PRs
    prisma.githubPR.findMany({
      where: { projectId: params.id, bugState: 'regression_risk' },
      orderBy: { importedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        importedAt: true,
      },
    }),

    // Failed CI PRs
    prisma.githubPR.findMany({
      where: { projectId: params.id, ciStatus: 'failure' },
      orderBy: { importedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        importedAt: true,
      },
    }),
  ]);

  // Build risk summary map
  const riskCount: Record<string, number> = {};
  for (const row of riskGroups) {
    riskCount[row.riskLevel.toLowerCase()] = row._count._all;
  }

  const riskSummary = [
    { level: 'critical', label: 'Critical', color: 'var(--red)', count: riskCount['critical'] ?? 0 },
    { level: 'high', label: 'High', color: 'var(--amber)', count: riskCount['high'] ?? 0 },
    { level: 'medium', label: 'Medium', color: '#eab308', count: riskCount['medium'] ?? 0 },
    { level: 'low', label: 'Low', color: 'var(--green)', count: riskCount['low'] ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Risk Dashboard"
        subtitle={
          <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← {project.name}
          </Link>
        }
        actions={
          <Link href="/settings/policies" className="btn btn-ghost btn-sm">
            Policy Reference →
          </Link>
        }
      />

      {/* Risk Summary Cards */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Risk Summary by Level</span>
          <Link href={`/tasks?projectId=${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            View all tasks →
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {riskSummary.map(({ level, label, color, count }) => (
            <div
              key={level}
              className="stat-card"
              style={{ border: count > 0 && (level === 'critical' || level === 'high') ? `2px solid ${color}` : undefined }}
            >
              <div className="stat-card-label">{label} Risk</div>
              <div className="stat-card-value" style={{ color: count > 0 ? color : 'var(--text)' }}>
                {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Policy Gate Activity */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Policy Gate Activity</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Recent blocked &amp; approved events
          </span>
        </div>
        {policyEvents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              No policy gate events recorded for this project yet.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Task</th>
                  <th>Date</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {policyEvents.map((evt) => {
                  const isBlocked = evt.event === 'policy_gate_blocked';
                  return (
                    <tr key={evt.id}>
                      <td>
                        <span
                          className={`badge ${isBlocked ? 'badge-sev-high' : 'badge-success'}`}
                        >
                          {isBlocked ? 'Blocked' : 'Approved'}
                        </span>
                      </td>
                      <td>
                        {evt.task ? (
                          <Link
                            href={`/tasks/${evt.task.id}`}
                            style={{ color: 'var(--blue)', fontWeight: 500, fontSize: 13 }}
                          >
                            {evt.task.title.length > 50
                              ? evt.task.title.slice(0, 50) + '…'
                              : evt.task.title}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(evt.createdAt)}
                      </td>
                      <td
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {evt.details
                          ? evt.details.length > 80
                            ? evt.details.slice(0, 80) + '…'
                            : evt.details
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regression Risk PRs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">
            Regression Risk PRs
            {regressionPRs.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  background: 'var(--red)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {regressionPRs.length}
              </span>
            )}
          </span>
          <Link href={`/projects/${params.id}/prs`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            View all PRs →
          </Link>
        </div>
        {regressionPRs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              No regression risk pull requests detected.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR #</th>
                  <th>Title</th>
                  <th>State</th>
                  <th>CI</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                {regressionPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                      >
                        #{pr.prNumber}
                      </Link>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}
                      >
                        {pr.title.length > 60 ? pr.title.slice(0, 60) + '…' : pr.title}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          pr.merged
                            ? 'success'
                            : pr.state === 'open'
                            ? 'pending_approval'
                            : 'neutral'
                        }`}
                      >
                        {pr.merged ? 'merged' : pr.state}
                      </span>
                    </td>
                    <td>
                      {pr.ciStatus ? (
                        <span
                          className={`badge badge-${
                            pr.ciStatus === 'success'
                              ? 'success'
                              : pr.ciStatus === 'failure'
                              ? 'sev-high'
                              : 'neutral'
                          }`}
                        >
                          {pr.ciStatus}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(pr.importedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Failed CI PRs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">
            Failed CI PRs
            {failedCIPRs.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  background: 'var(--red)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '1px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {failedCIPRs.length}
              </span>
            )}
          </span>
          <Link href={`/projects/${params.id}/prs?ci=failure`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            Filter by failed CI →
          </Link>
        </div>
        {failedCIPRs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              No pull requests with CI failures.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR #</th>
                  <th>Title</th>
                  <th>State</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                {failedCIPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                      >
                        #{pr.prNumber}
                      </Link>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}
                      >
                        {pr.title.length > 60 ? pr.title.slice(0, 60) + '…' : pr.title}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          pr.merged
                            ? 'success'
                            : pr.state === 'open'
                            ? 'pending_approval'
                            : 'neutral'
                        }`}
                      >
                        {pr.merged ? 'merged' : pr.state}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(pr.importedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task Risk Breakdown */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Risk Distribution</span>
        </div>
        <div className="card">
          {riskSummary.every((r) => r.count === 0) ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No tasks in this project yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {riskSummary.map(({ level, label, color, count }) => {
                const total = riskSummary.reduce((a, r) => a + r.count, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 80,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 18,
                        background: 'var(--surface-2)',
                        borderRadius: 4,
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {pct > 0 && (
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: color,
                            opacity: 0.75,
                            transition: 'width 0.3s',
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        width: 40,
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text)',
                        flexShrink: 0,
                      }}
                    >
                      {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
