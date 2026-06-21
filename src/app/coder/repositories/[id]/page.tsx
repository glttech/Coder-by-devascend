import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import SyncButton from './SyncButton';

export const dynamic = 'force-dynamic';

interface PageProps { params: { id: string } }

function CiStatus({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const map: Record<string, { color: string; label: string }> = {
    success: { color: '#16a34a', label: '✓ pass' },
    failure: { color: '#dc2626', label: '✗ fail' },
    pending: { color: '#2563eb', label: '… pending' },
    neutral: { color: '#64748b', label: '— neutral' },
  };
  const s = map[status] ?? { color: '#64748b', label: status };
  return <span style={{ color: s.color, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}

function PrState({ state, merged }: { state: string; merged: boolean }) {
  if (merged) return <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(124,58,237,0.3)' }}>merged</span>;
  if (state === 'open') return <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(34,197,94,0.3)' }}>open</span>;
  return <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, background: 'rgba(156,163,175,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(156,163,175,0.3)' }}>closed</span>;
}

export default async function RepositoryDetailPage({ params }: PageProps) {
  const repo = await prisma.repository.findUnique({
    where: { id: params.id },
    include: {
      repositoryPRs: {
        orderBy: { githubUpdatedAt: 'desc' },
        take: 100,
        include: { task: { select: { id: true, title: true } } },
      },
      _count: { select: { cliSessions: true } },
    },
  });

  if (!repo) notFound();

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link href="/coder/repositories" style={{ fontSize: 13, color: 'var(--blue)' }}>
          ← Repositories
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <PageHeader
          title={repo.fullName}
          subtitle={`${repo.repositoryPRs.length} PRs · ${repo._count.cliSessions} CLI sessions`}
        />
        <SyncButton repoId={repo.id} syncStatus={repo.syncStatus} />
      </div>

      {/* Meta strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, fontSize: 13 }}>
        <div><strong style={{ color: 'var(--text-muted)', fontSize: 11 }}>DEFAULT BRANCH</strong><div><code>{repo.defaultBranch}</code></div></div>
        <div><strong style={{ color: 'var(--text-muted)', fontSize: 11 }}>VISIBILITY</strong><div>{repo.private ? 'Private' : 'Public'}</div></div>
        <div><strong style={{ color: 'var(--text-muted)', fontSize: 11 }}>STATUS</strong><div>{repo.enabled ? 'Enabled' : <span style={{ color: '#dc2626' }}>Disabled</span>}</div></div>
        <div><strong style={{ color: 'var(--text-muted)', fontSize: 11 }}>LAST SYNC</strong><div>{repo.syncedAt ? repo.syncedAt.toLocaleString() : 'Never'}</div></div>
        {repo.lastSyncError && (
          <div style={{ flexBasis: '100%' }}>
            <strong style={{ color: '#dc2626', fontSize: 11 }}>SYNC ERROR</strong>
            <div style={{ color: '#dc2626', fontSize: 12 }}>{repo.lastSyncError}</div>
          </div>
        )}
      </div>

      {/* PR table */}
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Pull Requests</h2>
      {repo.repositoryPRs.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8 }}>
          No PRs synced yet. Click <strong>Sync PRs</strong> to import from GitHub.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>State</th>
                <th className="col-hide-mobile">Branch</th>
                <th className="col-hide-mobile">CI</th>
                <th className="col-hide-mobile">Task</th>
                <th className="col-hide-mobile">Updated</th>
              </tr>
            </thead>
            <tbody>
              {repo.repositoryPRs.map((pr) => (
                <tr key={pr.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {pr.prUrl ? (
                      <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>
                        #{pr.prNumber}
                      </a>
                    ) : (
                      `#${pr.prNumber}`
                    )}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>
                    {pr.title}
                    {pr.author && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>by {pr.author}</span>}
                  </td>
                  <td><PrState state={pr.state} merged={pr.merged} /></td>
                  <td className="col-hide-mobile"><code style={{ fontSize: 11 }}>{pr.sourceBranch ?? '—'}</code></td>
                  <td className="col-hide-mobile"><CiStatus status={pr.ciStatus} /></td>
                  <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                    {pr.task ? (
                      <Link href={`/tasks/${pr.task.id}`} style={{ color: 'var(--blue)' }}>
                        {pr.task.title.slice(0, 30)}{pr.task.title.length > 30 ? '…' : ''}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {pr.githubUpdatedAt
                      ? pr.githubUpdatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
