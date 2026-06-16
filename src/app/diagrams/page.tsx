import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import DiagramExportButton from '@/components/DiagramExportButton';

export const dynamic = 'force-dynamic';

export default async function DiagramsPage() {
  // Check if Diagram table exists (it may not if migration hasn't run)
  let diagrams: Array<{ id: string; title: string; kind: string; entityType: string; entityId: string; createdAt: Date }> = [];
  try {
    diagrams = await prisma.diagram.findMany({
      where: { orgId: 'org_default' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, kind: true, entityType: true, entityId: true, createdAt: true },
    });
  } catch {
    // Table doesn't exist yet (migration not run)
  }

  return (
    <div>
      <PageHeader title="Diagrams" subtitle="Saved Mermaid diagrams for tasks and projects" />
      <div className="section">
        {diagrams.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
            No diagrams saved yet. Generate and save diagrams from task or project pages.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Kind</th><th>Entity</th><th>Created</th><th>Export</th></tr>
              </thead>
              <tbody>
                {diagrams.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.title}</td>
                    <td><span className="badge badge-neutral">{d.kind}</span></td>
                    <td>
                      <Link href={`/${d.entityType}s/${d.entityId}`} style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--blue)' }}>
                        {d.entityId.slice(0, 12)}…
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.createdAt.toLocaleDateString()}</td>
                    <td><DiagramExportButton diagramId={d.id} title={d.title} /></td>
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
