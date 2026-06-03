import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tasks: true, githubPRs: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <Link href="/projects/new" className="btn btn-primary">
            + New Project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon="⬟"
          title="No projects yet"
          description="Projects connect your GitHub repos to tasks and agent runs. Create one to start tracking PR evidence and governance status."
          action={<Link href="/projects/new" className="btn btn-primary">Create first project</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Repository</th>
                <th>Branch</th>
                <th>Tasks</th>
                <th>PRs</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const repoUrl = p.repoOwner && p.repoName
                  ? `https://github.com/${p.repoOwner}/${p.repoName}`
                  : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {p.name}
                      </Link>
                      {p.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.description.slice(0, 80)}{p.description.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.repoOwner && p.repoName ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {p.repoOwner}/{p.repoName}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                      {p.defaultBranch}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p._count.tasks}</span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p._count.githubPRs}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {p.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
