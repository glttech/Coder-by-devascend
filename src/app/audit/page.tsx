import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  instruction_created:          'Instruction Created',
  instruction_status_changed:   'Status Changed',
  operator_session_created:     'Session Submitted',
  operator_session_updated:     'Session Updated',
  task_created:                 'Task Created',
  agent_run_created:            'Agent Run Recorded',
  task_approval_decided:        'Approval Decided',
  task_status_changed:          'Task Status Changed',
};

const RISK_EVENTS = new Set(['operator_session_created', 'operator_session_updated']);

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function DetailsSummary({ raw, event }: { raw: string | null; event: string }) {
  const data = parseDetails(raw);
  if (!data) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  // For status changes: show from → to prominently
  if (event === 'instruction_status_changed' && data.from && data.to) {
    return (
      <span style={{ fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>{String(data.from).replace(/_/g, ' ')}</span>
        {' → '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{String(data.to).replace(/_/g, ' ')}</span>
      </span>
    );
  }

  // For operator sessions: show the decision
  if ((event === 'operator_session_created' || event === 'operator_session_updated') && data.recommendedAction) {
    const action = String(data.recommendedAction);
    const isRisky = action !== 'CONTINUE';
    return (
      <span style={{ fontSize: 12, fontWeight: isRisky ? 600 : 400, color: isRisky ? 'var(--red-text)' : 'var(--green-text)' }}>
        {action.replace(/_/g, ' ')}
      </span>
    );
  }

  // Generic: show first 2 non-boring fields
  const skip = new Set(['instructionId', 'taskId', 'at', 'id']);
  const display = Object.entries(data).filter(([k]) => !skip.has(k));
  return (
    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
      {display.slice(0, 3).map(([k, v]) => (
        <div key={k}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}:</span>{' '}
          <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
            {typeof v === 'string' && v.length > 50 ? v.slice(0, 30) + '…' : String(v ?? '—')}
          </span>
        </div>
      ))}
    </div>
  );
}

interface AuditPageProps {
  searchParams: { taskId?: string; instructionId?: string; event?: string };
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const { taskId, instructionId, event: eventFilter } = searchParams;
  const where: Record<string, unknown> = {};
  if (taskId) where.taskId = taskId;
  if (instructionId) where.instructionId = instructionId;
  if (eventFilter) where.event = eventFilter;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      task: { select: { id: true, title: true } },
      instruction: { select: { id: true, title: true } },
    },
  });

  const hasFilter = !!(taskId || instructionId || eventFilter);

  const parts: string[] = [
    logs.length === 200 ? '200+ entries (latest 200)' : `${logs.length} entries`,
  ];
  if (taskId) parts.push(`task: ${taskId.slice(0, 8)}`);
  if (instructionId) parts.push(`instruction: ${instructionId.slice(0, 8)}`);
  if (eventFilter) parts.push(`event: ${EVENT_LABELS[eventFilter] ?? eventFilter}`);
  const subtitle = parts.join(' · ');

  // Quick-filter links for common event types
  const EVENT_FILTERS = [
    { label: 'All',               event: null },
    { label: 'Tasks',             event: 'task_created' },
    { label: 'Runs',              event: 'agent_run_created' },
    { label: 'Approvals',         event: 'task_approval_decided' },
    { label: 'Status Changes',    event: 'instruction_status_changed' },
    { label: 'Sessions',          event: 'operator_session_created' },
  ];

  function filterHref(e: string | null): string {
    const params = new URLSearchParams();
    if (taskId) params.set('taskId', taskId);
    if (instructionId) params.set('instructionId', instructionId);
    if (e) params.set('event', e);
    const qs = params.toString();
    return `/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={subtitle}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/api/audit/export" className="btn btn-ghost btn-sm">Export CSV</a>
            {hasFilter && (
              <Link href="/audit" className="btn btn-ghost btn-sm">Clear filters</Link>
            )}
          </div>
        }
      />

      {/* Quick filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {EVENT_FILTERS.map(({ label, event: e }) => {
          const isActive = (e === null && !eventFilter) || e === eventFilter;
          return (
            <Link
              key={label}
              href={filterHref(e)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: isActive ? 600 : 400 }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon="◎"
          title="No audit entries"
          description={hasFilter
            ? 'No entries match the current filters.'
            : 'Audit entries are recorded automatically when instructions are created, status-changed, or operator sessions are submitted.'}
          action={hasFilter ? <Link href="/audit" className="btn btn-ghost btn-sm">Clear filters</Link> : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>When</th>
                <th style={{ width: 160 }}>Event</th>
                <th>Task</th>
                <th>Instruction</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isRiskEvent = RISK_EVENTS.has(log.event);
                const details = parseDetails(log.details);
                const isRiskyDecision = isRiskEvent && details?.recommendedAction && details.recommendedAction !== 'CONTINUE';
                return (
                  <tr
                    key={log.id}
                    style={{
                      verticalAlign: 'top',
                      borderLeft: isRiskyDecision ? '3px solid var(--red)' : isRiskEvent ? '3px solid var(--border)' : undefined,
                    }}
                  >
                    <td style={{ whiteSpace: 'nowrap', paddingTop: 10 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                        {relativeTime(log.createdAt)}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
                        {log.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
                      </div>
                    </td>
                    <td style={{ paddingTop: 10 }}>
                      <span style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontWeight: 500,
                        color: isRiskyDecision ? 'var(--red-text)' : 'var(--text-secondary)',
                        padding: '2px 0',
                      }}>
                        {EVENT_LABELS[log.event] ?? log.event.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, paddingTop: 10 }}>
                      {log.task ? (
                        <Link href={`/tasks/${log.task.id}`} style={{ color: 'var(--blue)' }}>
                          {log.task.title.length > 30 ? log.task.title.slice(0, 30) + '…' : log.task.title}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, paddingTop: 10 }}>
                      {log.instruction ? (
                        <Link href={`/audit?instructionId=${log.instruction.id}`} style={{ color: 'var(--blue)' }}>
                          {log.instruction.title.length > 28 ? log.instruction.title.slice(0, 28) + '…' : log.instruction.title}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ paddingTop: 10 }}>
                      <DetailsSummary raw={log.details} event={log.event} />
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
