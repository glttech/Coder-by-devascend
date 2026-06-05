import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskBadge } from '@/components/ui/Badge';
import { computeProjectHealth, computeStalePRs, healthSignal } from '@/lib/projectHealth';

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

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      tasks: { orderBy: { createdAt: 'desc' }, take: 10 },
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
    select: { id: true, prNumber: true, title: true, body: true, state: true, merged: true, ciStatus: true, importedAt: true, updatedAt: true },
  });

  const health = computeProjectHealth(allPRsForHealth);
  const signal = healthSignal(health);
  const stalePRs = computeStalePRs(allPRsForHealth);

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
          <Link href={`/projects/${project.id}/edit`} className="btn btn-ghost btn-sm">
            Edit
          </Link>
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
            <span className="section-title">PR Evidence Health</span>
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

      {/* Stale Evidence Alert */}
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
                <tr><th>Title</th><th>Status</th><th>Risk</th><th>Created</th></tr>
              </thead>
              <tbody>
                {project.tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tasks/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>{t.title}</Link>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.status}</td>
                    <td><RiskBadge level={t.riskLevel} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No PRs imported yet.{repoUrl ? ' Use "Import PR" to fetch evidence from a GitHub PR URL.' : ' Link a GitHub repo to enable PR import.'}
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
