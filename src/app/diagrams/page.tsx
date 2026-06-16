import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function DiagramsPage() {
  const diagrams = await prisma.diagram.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Saved Diagrams"
        subtitle={`${diagrams.length} diagram${diagrams.length !== 1 ? 's' : ''} saved`}
      />
      <div className="section">
        {diagrams.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No diagrams saved yet"
            description="Generate and save diagrams from any task or project page."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {diagrams.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.title}</td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 10 }}>{d.kind}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {d.entityType && d.entityId ? (
                        <Link href={`/${d.entityType}s/${d.entityId}`} style={{ color: 'var(--blue)' }}>
                          {d.entityType}/{d.entityId.slice(0, 8)}
                        </Link>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {d.createdAt.toLocaleDateString()}
                    </td>
                    <td></td>
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
