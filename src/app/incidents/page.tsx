import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--red, #ef4444)';
    case 'high':     return '#f97316';
    case 'medium':   return 'var(--amber, #f59e0b)';
    case 'low':      return 'var(--green, #22c55e)';
    default:         return 'var(--text-muted)';
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = severityColor(severity);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      fontWeight: 500,
      color,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
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

export default async function IncidentListPage() {
  const incidents = await prisma.incident.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      task: { select: { id: true, title: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Incidents"
        subtitle={`${incidents.length} incident${incidents.length !== 1 ? 's' : ''} total`}
      />

      {incidents.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No incidents — all clear."
          description="Incidents are created automatically when AI work fails, or manually for postmortems."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th className="col-hide-mobile">Trigger</th>
                <th>Status</th>
                <th className="col-hide-mobile">Task</th>
                <th className="col-hide-mobile">Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`/incidents/${incident.id}`} style={{ color: 'var(--text)' }}>
                      {incident.title}
                    </Link>
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {incident.trigger}
                  </td>
                  <td>
                    <StatusBadge status={incident.status} />
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                    {incident.task ? (
                      <Link href={`/tasks/${incident.task.id}`} style={{ color: 'var(--blue)' }}>
                        {incident.task.title.length > 40 ? incident.task.title.slice(0, 40) + '…' : incident.task.title}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {incident.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <Link href={`/incidents/${incident.id}`} className="btn btn-ghost btn-sm">
                      View
                    </Link>
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
