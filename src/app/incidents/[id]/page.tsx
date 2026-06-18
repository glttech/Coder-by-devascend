import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import IncidentStatusToggle from './IncidentStatusToggle';

export const dynamic = 'force-dynamic';

interface IncidentPageProps {
  params: { id: string };
}

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
      fontWeight: 600,
      color,
      padding: '2px 8px',
      borderRadius: 4,
      background: `${color}1a`,
      border: `1px solid ${color}4d`,
    }}>
      {severity.toUpperCase()}
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

interface TimelineEntry {
  timestamp: string;
  event: string;
  actor?: string;
}

export default async function IncidentDetailPage({ params }: IncidentPageProps) {
  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      task: { include: { project: true } },
      agentRun: { select: { id: true, status: true, selectedTool: true } },
    },
  });

  if (!incident) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Incident not found</div>
        <p className="empty-state-description">This incident ID does not exist or has been removed.</p>
      </div>
    );
  }

  let timeline: TimelineEntry[] = [];
  try {
    timeline = JSON.parse(incident.timeline ?? '[]');
  } catch {
    timeline = [];
  }

  return (
    <div>
      <PageHeader
        title={incident.title}
        subtitle={
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            {incident.id}
          </span>
        }
        badge={
          <div style={{ display: 'flex', gap: 6 }}>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
        }
        actions={
          <Link href="/incidents" className="btn btn-ghost btn-sm">
            ← All Incidents
          </Link>
        }
      />

      {/* Header info: trigger */}
      <div className="section">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500 }}>Trigger:</span>
          <span style={{ fontFamily: 'monospace', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
            {incident.trigger}
          </span>
        </div>
      </div>

      {/* Overview card */}
      <div className="section">
        <Card>
          <CardHeader title="Overview" />
          <div className="meta-grid">
            {incident.description && (
              <div className="meta-row">
                <span className="meta-label">Description</span>
                <span className="meta-value">{incident.description}</span>
              </div>
            )}
            <div className="meta-row">
              <span className="meta-label">Risk Category</span>
              <span className="meta-value">{incident.riskCategory ?? '—'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Task</span>
              <span className="meta-value">
                {incident.task ? (
                  <Link href={`/tasks/${incident.task.id}`} style={{ color: 'var(--blue)' }}>
                    {incident.task.title}
                  </Link>
                ) : '—'}
              </span>
            </div>
            {incident.task?.project && (
              <div className="meta-row">
                <span className="meta-label">Project</span>
                <span className="meta-value">
                  <Link href={`/projects/${incident.task.project.id}`} style={{ color: 'var(--blue)' }}>
                    {incident.task.project.name}
                  </Link>
                </span>
              </div>
            )}
            <div className="meta-row">
              <span className="meta-label">Agent Run</span>
              <span className="meta-value">
                {incident.agentRun ? (
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {incident.agentRun.id.slice(0, 8)} ({incident.agentRun.status})
                  </span>
                ) : '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Created</span>
              <span className="meta-value" style={{ fontSize: 12 }}>
                {incident.createdAt.toISOString()}
              </span>
            </div>
            {incident.resolvedAt && (
              <div className="meta-row">
                <span className="meta-label">Resolved</span>
                <span className="meta-value" style={{ fontSize: 12 }}>
                  {incident.resolvedAt.toISOString()}
                  {incident.resolvedBy && ` by ${incident.resolvedBy}`}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="section">
          <Card>
            <CardHeader title="Timeline" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {timeline.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 180, flexShrink: 0 }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    {entry.event}
                    {entry.actor && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        — {entry.actor}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Failed command / test */}
      {(incident.failedCommand || incident.failedTest) && (
        <div className="section">
          <Card>
            <CardHeader title="Failure Details" />
            {incident.failedCommand && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Failed Command</div>
                <pre style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', fontSize: 12, overflowX: 'auto', margin: 0 }}>
                  {incident.failedCommand}
                </pre>
              </div>
            )}
            {incident.failedTest && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Failed Test</div>
                <pre style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', fontSize: 12, overflowX: 'auto', margin: 0 }}>
                  {incident.failedTest}
                </pre>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Reviewer decision */}
      {incident.reviewerDecision && (
        <div className="section">
          <Card>
            <CardHeader title="Reviewer Decision" />
            <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{incident.reviewerDecision}</p>
          </Card>
        </div>
      )}

      {/* Follow-up action (read only if already set) */}
      {incident.followUpAction && (
        <div className="section">
          <Card>
            <CardHeader title="Follow-up Action" />
            <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{incident.followUpAction}</p>
          </Card>
        </div>
      )}

      {/* Status update (admin client component) */}
      <div className="section">
        <Card>
          <CardHeader title="Update Status" subtitle="Admin only — change status or add a follow-up action note" />
          <IncidentStatusToggle
            incidentId={incident.id}
            currentStatus={incident.status}
            currentFollowUpAction={incident.followUpAction}
          />
        </Card>
      </div>
    </div>
  );
}
