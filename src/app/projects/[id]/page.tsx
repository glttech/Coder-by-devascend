import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { RiskBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: { id: string };
}

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
