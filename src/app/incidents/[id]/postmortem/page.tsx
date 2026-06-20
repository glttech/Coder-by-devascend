import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { SeverityBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

interface PostmortemPageProps {
  params: { id: string };
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <Card>
        <CardHeader title={title} />
        <div style={{ marginTop: 8 }}>{children}</div>
      </Card>
    </div>
  );
}

function NoContent({ label }: { label: string }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
      {label}
    </p>
  );
}

export default async function IncidentPostmortemPage({ params }: PostmortemPageProps) {
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
        <p className="empty-state-description">
          This incident ID does not exist or has been removed.
        </p>
      </div>
    );
  }

  let timeline: TimelineEntry[] = [];
  try {
    timeline = JSON.parse(incident.timeline ?? '[]');
  } catch {
    timeline = [];
  }

  const hasContent =
    incident.description ||
    incident.reviewerDecision ||
    incident.followUpAction ||
    timeline.length > 0;

  return (
    <div>
      <PageHeader
        title={`Postmortem: ${incident.title}`}
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
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/incidents/${incident.id}`} className="btn btn-ghost btn-sm">
              ← Incident Details
            </Link>
            <Link href="/incidents" className="btn btn-ghost btn-sm">
              All Incidents
            </Link>
          </div>
        }
      />

      {!hasContent && (
        <div className="section">
          <div
            style={{
              padding: '24px 20px',
              borderRadius: 8,
              border: '2px dashed var(--border)',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Postmortem not yet filed
            </div>
            <p style={{ fontSize: 13, margin: '0 auto', maxWidth: 440 }}>
              No postmortem content has been recorded for this incident. Update the incident with a
              description, reviewer decision, and follow-up action to populate this page.
            </p>
          </div>
        </div>
      )}

      {/* Incident metadata */}
      <Section title="Incident Overview">
        <div className="meta-grid">
          <div className="meta-row">
            <span className="meta-label">Severity</span>
            <span className="meta-value">
              <SeverityBadge severity={incident.severity} />
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Status</span>
            <span className="meta-value">
              <StatusBadge status={incident.status} />
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Trigger</span>
            <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {incident.trigger}
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
        </div>
      </Section>

      {/* Summary / What Happened */}
      <Section title="Summary — What Happened">
        {incident.description ? (
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
            {incident.description}
          </p>
        ) : (
          <NoContent label="No summary recorded. Add a description on the incident page." />
        )}
      </Section>

      {/* Timeline of Events */}
      <Section title="Timeline of Events">
        {timeline.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    minWidth: 180,
                    flexShrink: 0,
                  }}
                >
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
        ) : (
          <NoContent label="No timeline entries recorded for this incident." />
        )}
      </Section>

      {/* Root Cause */}
      <Section title="Root Cause">
        {incident.riskCategory ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 8px 0', lineHeight: 1.6 }}>
              <strong>Risk Category:</strong> {incident.riskCategory}
            </p>
            {(incident.failedCommand || incident.failedTest) && (
              <div style={{ marginTop: 12 }}>
                {incident.failedCommand && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Failed Command
                    </div>
                    <pre
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '10px 14px',
                        fontSize: 12,
                        overflowX: 'auto',
                        margin: 0,
                      }}
                    >
                      {incident.failedCommand}
                    </pre>
                  </div>
                )}
                {incident.failedTest && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Failed Test
                    </div>
                    <pre
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '10px 14px',
                        fontSize: 12,
                        overflowX: 'auto',
                        margin: 0,
                      }}
                    >
                      {incident.failedTest}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <NoContent label="Root cause analysis not yet documented." />
        )}
      </Section>

      {/* Impact Assessment */}
      <Section title="Impact Assessment">
        {incident.reviewerDecision ? (
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
            {incident.reviewerDecision}
          </p>
        ) : (
          <NoContent label="Impact assessment not yet recorded. Add a reviewer decision on the incident page." />
        )}
      </Section>

      {/* Action Items */}
      <Section title="Action Items / Follow-up">
        {incident.followUpAction ? (
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
            {incident.followUpAction}
          </p>
        ) : (
          <NoContent label="No follow-up actions recorded yet." />
        )}
      </Section>

      {/* Agent Run context (if any) */}
      {incident.agentRun && (
        <Section title="Related Agent Run">
          <div className="meta-grid">
            <div className="meta-row">
              <span className="meta-label">Run ID</span>
              <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {incident.agentRun.id}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">{incident.agentRun.status}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Tool</span>
              <span className="meta-value">{incident.agentRun.selectedTool}</span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
