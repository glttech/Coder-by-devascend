import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

function SyncBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    idle:    { background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' },
    syncing: { background: 'rgba(59,130,246,0.1)',  color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' },
    synced:  { background: 'rgba(34,197,94,0.1)',   color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
    error:   { background: 'rgba(239,68,68,0.1)',   color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
  };
  const style = styles[status] ?? styles.idle;
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: { cursor?: string; orgId?: string };
}

export default async function RepositoriesPage({ searchParams }: PageProps) {
  const orgId = searchParams.orgId ?? 'org_default';
  const cursor = searchParams.cursor;

  const repos = await prisma.repository.findMany({
    where: {
      orgId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE,
    include: {
      _count: { select: { repositoryPRs: true, cliSessions: true } },
    },
  });

  const total = cursor ? null : await prisma.repository.count({ where: { orgId } });
  const nextCursor = repos.length === PAGE_SIZE ? repos[repos.length - 1].createdAt.toISOString() : null;

  const subtitle = total !== null
    ? `${total} repositor${total !== 1 ? 'ies' : 'y'} registered`
    : `${repos.length} shown`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <PageHeader title="Repositories" subtitle={subtitle} />
        <Link href="/coder/repositories/new" className="btn btn-primary btn-sm">
          + Add Repository
        </Link>
      </div>

      {repos.length === 0 && !cursor ? (
        <EmptyState
          icon="⬟"
          title="No repositories registered yet."
          description="Register a GitHub repository to start tracking CLI sessions and PRs."
          action={<Link href="/coder/repositories/new" className="btn btn-primary btn-sm">Add Repository</Link>}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th className="col-hide-mobile">Branch</th>
                  <th>Sync</th>
                  <th className="col-hide-mobile">PRs</th>
                  <th className="col-hide-mobile">Sessions</th>
                  <th className="col-hide-mobile">Synced</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.fullName}</div>
                      {r.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {r.description}
                        </div>
                      )}
                      {!r.enabled && (
                        <span style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>disabled</span>
                      )}
                    </td>
                    <td className="col-hide-mobile">
                      <code style={{ fontSize: 12 }}>{r.defaultBranch}</code>
                    </td>
                    <td><SyncBadge status={r.syncStatus} /></td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r._count.repositoryPRs}
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r._count.cliSessions}
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.syncedAt
                        ? r.syncedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <Link href={`/coder/repositories/${r.id}`} className="btn btn-ghost btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link href={`/coder/repositories?cursor=${encodeURIComponent(nextCursor)}&orgId=${orgId}`} className="btn btn-ghost">
                Next page →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
