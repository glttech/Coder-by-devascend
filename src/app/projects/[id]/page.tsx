import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskBadge } from '@/components/ui/Badge';
import { computeProjectHealth, computeStalePRs, computeReleaseReadiness, healthSignal } from '@/lib/projectHealth';
import type { PRHealthInputFull } from '@/lib/projectHealth';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: { id: string };
}

const SIGNAL_BADGE: Record<string, string> = {
  critical: 'badge-sev-high',
  warning:  'badge-warning',
  clear:    'badge-success',
};

const SIGNAL_LABEL: Record<string, string> = {
  critical: 'Needs attention',
  warning:  'Review suggested',
  clear:    'All clear',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high:     'var(--amber)',
  medium:   'var(--yellow, #eab308)',
  low:      'var(--green)',
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString();
}

function isOverdue(d: Date | null | undefined): boolean {
  if (!d) return false;
  return d < new Date();
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          riskLevel: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      githubPRs: { orderBy: { importedAt: 'desc' }, take: 5 },
      _count: { select: { tasks: true, githubPRs: true } },
    },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
        <p className="empty-state-description">This project ID does not exist or has been removed.</p>
      </div>
    );
  }

  // Fetch all PR health data (separate query — list page uses its own query with filters)
  const allPRsForHealth = await prisma.githubPR.findMany({
    where: { projectId: params.id },
    select: { id: true, prNumber: true, title: true, body: true, state: true, merged: true, ciStatus: true, importedAt: true, updatedAt: true, githubMergedAt: true },
  }) as PRHealthInputFull[];

  // Task progress counts
  const taskCounts = await prisma.task.groupBy({
    by: ['status'],
    where: { projectId: params.id },
    _count: { _all: true },
  });

  const countByStatus: Record<string, number> = {};
  for (const row of taskCounts) {
    countByStatus[row.status] = row._count._all;
  }
  const totalTasks = Object.values(countByStatus).reduce((a, b) => a + b, 0);
  const completedTasks = countByStatus['completed'] ?? 0;
  const runningTasks = countByStatus['running'] ?? 0;
  const pendingTasks = countByStatus['pending'] ?? 0;
  const failedTasks = countByStatus['failed'] ?? 0;
  const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const runningPct = totalTasks > 0 ? Math.round((runningTasks / totalTasks) * 100) : 0;
  const pendingPct = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;
  const failedPct = totalTasks > 0 ? Math.round((failedTasks / totalTasks) * 100) : 0;

  // Milestones with task counts
  const milestones = await prisma.milestone.findMany({
    where: { projectId: params.id },
    include: { _count: { select: { tasks: true } } },
    orderBy: { targetDate: 'asc' },
  });

  // Per-milestone completed task counts
  const milestoneCompletedCounts: Record<string, number> = {};
  if (milestones.length > 0) {
    const milestoneIds = milestones.map((m) => m.id);
    const completedPerMilestone = await prisma.task.groupBy({
      by: ['milestoneId'],
      where: { milestoneId: { in: milestoneIds }, status: 'completed' },
      _count: { _all: true },
    });
    for (const row of completedPerMilestone) {
      if (row.milestoneId) {
        milestoneCompletedCounts[row.milestoneId] = row._count._all;
      }
    }
  }

  const health = computeProjectHealth(allPRsForHealth);
  const signal = healthSignal(health);
  const stalePRs = computeStalePRs(allPRsForHealth);
  const releaseReadiness = computeReleaseReadiness(allPRsForHealth);

  const repoUrl = project.repoOwner && project.repoName
    ? `https://github.com/${project.repoOwner}/${project.repoName}`
    : null;

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={
          repoUrl ? (
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--blue)' }}>
              {project.repoOwner}/{project.repoName} ↗
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No GitHub repo linked</span>
          )
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/projects/${project.id}/intelligence`} className="btn btn-ghost btn-sm">
              Intelligence
            </Link>
            <Link href={`/projects/${project.id}/governance-timeline`} className="btn btn-ghost btn-sm">
              Timeline
            </Link>
            <Link href={`/projects/${project.id}/board`} className="btn btn-ghost btn-sm">
              Board
            </Link>
            <Link href={`/projects/${project.id}/milestones`} className="btn btn-ghost btn-sm">
              Milestones
            </Link>
            <Link href={`/projects/${project.id}/risk`} className="btn btn-ghost btn-sm">
              Risk
            </Link>
            <Link href={`/projects/${project.id}/edit`} className="btn btn-ghost btn-sm">
              Edit
            </Link>
            <a href={`/api/projects/${project.id}/report`} target="_blank" className="btn btn-ghost btn-sm">
              Download Report
            </a>
          </div>
        }
      />

      {/* Project Details */}
      <div className="section">
        <div className="card">
          <div className="meta-grid">
            {project.description && (
              <div className="meta-row">
                <span className="meta-label">Description</span>
                <span className="meta-value">{project.description}</span>
              </div>
            )}
            <div className="meta-row">
              <span className="meta-label">Repository</span>
              <span className="meta-value">
                {repoUrl ? (
                  <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 13 }}>
                    {project.repoOwner}/{project.repoName}
                  </a>
                ) : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Default branch</span>
              <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 13 }}>{project.defaultBranch}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Tasks</span>
              <span className="meta-value">{project._count.tasks}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Imported PRs</span>
              <span className="meta-value">{project._count.githubPRs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Health */}
      {health.total > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Code Review Health</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${SIGNAL_BADGE[signal]}`}>{SIGNAL_LABEL[signal]}</span>
              <Link href={`/projects/${project.id}/prs`} style={{ fontSize: 12, color: 'var(--blue)' }}>
                View all PRs →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <HealthStat label="Total" value={health.total} />
            <HealthStat label="Merged" value={health.mergedCount} color="var(--green)" />
            <HealthStat label="Open" value={health.openCount} />
            <HealthStat
              label="CI Failures"
              value={health.failedCICount}
              color={health.failedCICount > 0 ? 'var(--red)' : undefined}
              highlight={health.failedCICount > 0}
              href={health.failedCICount > 0 ? `/projects/${project.id}/prs?ci=failure` : undefined}
            />
            <HealthStat
              label="Pending CI"
              value={health.pendingCICount}
              color={health.pendingCICount > 0 ? 'var(--amber)' : undefined}
              href={health.pendingCICount > 0 ? `/projects/${project.id}/prs?ci=pending` : undefined}
            />
            <HealthStat
              label="High Risk"
              value={health.highRiskCount}
              color={health.highRiskCount > 0 ? 'var(--red)' : undefined}
              highlight={health.highRiskCount > 0}
            />
            <HealthStat
              label="Stale (7d+)"
              value={health.staleCount}
              color={health.staleCount > 0 ? 'var(--amber)' : undefined}
              href={health.staleCount > 0 ? `/projects/${project.id}/prs?state=open` : undefined}
              tooltip="Open PRs not refreshed in 7+ days"
            />
          </div>
        </div>
      )}

      {/* Stale PR Alert */}
      {stalePRs.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title" style={{ color: 'var(--amber)' }}>
              Needs Refresh ({stalePRs.length})
            </span>
            <Link href={`/projects/${project.id}/prs?state=open`} style={{ fontSize: 12, color: 'var(--blue)' }}>
              View open PRs →
            </Link>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr><th>PR</th><th>Title</th><th>Stale for</th><th></th></tr>
              </thead>
              <tbody>
                {stalePRs.map((sp) => (
                  <tr key={sp.id}>
                    <td>
                      <Link href={`/projects/${project.id}/prs/${sp.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>
                        #{sp.prNumber}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <Link href={`/projects/${project.id}/prs/${sp.id}`} style={{ color: 'var(--text)', fontSize: 13 }}>
                        {sp.title.length > 60 ? sp.title.slice(0, 60) + '…' : sp.title}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                      {sp.daysSinceRefresh}d
                    </td>
                    <td>
                      <Link href={`/projects/${project.id}/prs/${sp.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                        Refresh →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Release Readiness Snapshot */}
      {health.total > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Release Readiness</span>
            <span className={`badge ${releaseReadiness.signal === 'ready' ? 'badge-success' : releaseReadiness.signal === 'caution' ? 'badge-warning' : 'badge-sev-high'}`}>
              {releaseReadiness.signal === 'ready' ? 'Ready' : releaseReadiness.signal === 'caution' ? 'Caution' : 'Blocked'}
            </span>
          </div>
          <div className="card">
            <p style={{ fontSize: 13, margin: '0 0 12px', color: releaseReadiness.signal === 'ready' ? 'var(--green)' : releaseReadiness.signal === 'caution' ? 'var(--amber)' : 'var(--red)', fontWeight: 500 }}>
              {releaseReadiness.suggestedAction}
            </p>
            {releaseReadiness.recentMergedPRs.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Recent merged PRs
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {releaseReadiness.recentMergedPRs.map((mpr) => (
                    <li key={mpr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Link href={`/projects/${project.id}/prs/${mpr.id}`} style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--blue)', flexShrink: 0 }}>
                        #{mpr.prNumber}
                      </Link>
                      <Link href={`/projects/${project.id}/prs/${mpr.id}`} style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mpr.title.length > 70 ? mpr.title.slice(0, 70) + '…' : mpr.title}
                      </Link>
                      {mpr.githubMergedAt && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {mpr.githubMergedAt.toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Progress Bar */}
      {totalTasks > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Task Progress</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {completedTasks} of {totalTasks} tasks complete ({completedPct}%)
            </span>
          </div>
          <div className="card">
            {/* Segmented progress bar */}
            <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'var(--border)', marginBottom: 12 }}>
              {completedPct > 0 && (
                <div style={{ width: `${completedPct}%`, background: 'var(--green)', transition: 'width 0.3s' }} title={`Completed: ${completedTasks}`} />
              )}
              {runningPct > 0 && (
                <div style={{ width: `${runningPct}%`, background: 'var(--blue)', transition: 'width 0.3s' }} title={`Running: ${runningTasks}`} />
              )}
              {pendingPct > 0 && (
                <div style={{ width: `${pendingPct}%`, background: 'var(--border)', transition: 'width 0.3s' }} title={`Pending: ${pendingTasks}`} />
              )}
              {failedPct > 0 && (
                <div style={{ width: `${failedPct}%`, background: 'var(--red)', transition: 'width 0.3s' }} title={`Failed: ${failedTasks}`} />
              )}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
              <LegendItem color="var(--green)" label="Completed" count={completedTasks} />
              <LegendItem color="var(--blue)" label="Running" count={runningTasks} />
              <LegendItem color="var(--border)" label="Pending" count={pendingTasks} />
              <LegendItem color="var(--red)" label="Failed" count={failedTasks} />
            </div>
          </div>
        </div>
      )}

      {/* Milestones Summary */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Milestones ({milestones.length})</span>
          <Link href={`/projects/${project.id}/milestones/new`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            + New
          </Link>
        </div>
        {milestones.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>No milestones yet.</div>
            <Link href={`/projects/${project.id}/milestones/new`} className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>
              + Create first milestone
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr><th>Milestone</th><th>Status</th><th>Progress</th><th>Target date</th></tr>
              </thead>
              <tbody>
                {milestones.map((m) => {
                  const total = m._count.tasks;
                  const done = milestoneCompletedCounts[m.id] ?? 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const overdue = m.status === 'open' && isOverdue(m.targetDate);
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/projects/${project.id}/milestones/${m.id}`} style={{ color: 'var(--blue)' }}>
                          {m.title}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${m.status === 'completed' ? 'badge-success' : 'badge-pending_approval'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                            {total > 0 && (
                              <div style={{ width: `${pct}%`, height: '100%', background: m.status === 'completed' ? 'var(--green)' : 'var(--blue)', transition: 'width 0.3s' }} />
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{done}/{total}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--text-muted)', fontWeight: overdue ? 600 : undefined }}>
                        {m.targetDate ? (
                          <>
                            {formatDate(m.targetDate)}
                            {overdue && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700 }}>Overdue</span>}
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Tasks */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent Tasks ({project._count.tasks})</span>
          <Link href={`/tasks?projectId=${project.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>View all →</Link>
        </div>
        {project.tasks.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks linked to this project.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Priority</th><th>Status</th><th>Risk</th><th>Due</th><th>Created</th></tr>
              </thead>
              <tbody>
                {project.tasks.map((t) => {
                  const taskOverdue = t.status !== 'completed' && isOverdue(t.dueDate);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/tasks/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>{t.title}</Link>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[t.priority] ?? 'var(--text-muted)', flexShrink: 0, display: 'inline-block' }} />
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.status}</td>
                      <td><RiskBadge level={t.riskLevel} /></td>
                      <td style={{ fontSize: 12, color: taskOverdue ? 'var(--red)' : 'var(--text-muted)', fontWeight: taskOverdue ? 600 : undefined }}>
                        {t.dueDate ? (
                          <>
                            {formatDate(t.dueDate)}
                            {taskOverdue && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700 }}>Overdue</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.createdAt.toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GitHub PRs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">GitHub PRs ({project._count.githubPRs})</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/projects/${project.id}/prs`} style={{ fontSize: 12, color: 'var(--blue)' }}>
              View all →
            </Link>
            {repoUrl && (
              <Link href={`/projects/${project.id}/prs/import`} className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>
                + Import PR
              </Link>
            )}
          </div>
        </div>
        {project.githubPRs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {repoUrl
              ? <>No pull requests imported yet. Click <strong>+ Import PR</strong> to fetch a GitHub pull request.</>

              : <>No GitHub repo linked. <Link href={`/projects/${project.id}/edit`} style={{ color: 'var(--blue)' }}>Edit this project</Link> to add a repo, then import PRs.</>
            }
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>PR</th><th>Title</th><th>State</th><th>Branch</th><th>CI</th><th>Imported</th></tr>
              </thead>
              <tbody>
                {project.githubPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link href={`/projects/${project.id}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>
                        #{pr.prNumber}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500, maxWidth: 300 }}>
                      <Link href={`/projects/${project.id}/prs/${pr.id}`} style={{ color: 'var(--text)' }}>
                        {pr.title.slice(0, 60)}{pr.title.length > 60 ? '…' : ''}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'}`}>
                        {pr.merged ? 'merged' : pr.state}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      {pr.sourceBranch ? pr.sourceBranch.slice(0, 30) : '—'}
                    </td>
                    <td>
                      {pr.ciStatus ? (
                        <span className={`badge badge-${pr.ciStatus === 'success' ? 'success' : pr.ciStatus === 'failure' ? 'sev-high' : 'neutral'}`}>
                          {pr.ciStatus}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {pr.importedAt.toLocaleDateString()}
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

function HealthStat({
  label, value, color, highlight, href, tooltip,
}: {
  label: string; value: number; color?: string;
  highlight?: boolean; href?: string; tooltip?: string;
}) {
  const content = (
    <div
      className="stat-card"
      style={{ border: highlight ? '2px solid var(--red)' : undefined, cursor: href ? 'pointer' : undefined }}
      title={tooltip}
    >
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}: {count}
    </span>
  );
}
