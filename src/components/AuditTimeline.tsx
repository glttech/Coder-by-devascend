import prisma from '@/lib/prisma';
import { relativeTime } from '@/lib/relativeTime';

// Map AuditLog `event` values to plain-English descriptions and icons.
const EVENT_MAP: Record<string, { icon: string; label: string }> = {
  task_created:              { icon: '✦', label: 'Task created' },
  task_updated:              { icon: '✎', label: 'Task updated' },
  task_completed:            { icon: '✔', label: 'Task marked as complete' },
  task_status_changed:       { icon: '↻', label: 'Task status changed' },
  task_approval_decided:     { icon: '⚖', label: 'Task approval decided' },
  instruction_created:       { icon: '💡', label: 'AI suggestion submitted' },
  instruction_submitted:     { icon: '💡', label: 'AI suggestion submitted' },
  instruction_approved:      { icon: '✅', label: 'AI suggestion approved' },
  instruction_blocked:       { icon: '🚫', label: 'AI suggestion blocked' },
  instruction_status_changed:{ icon: '↻', label: 'AI suggestion status changed' },
  agent_run_created:         { icon: '⚙', label: 'AI response recorded' },
  approval_granted:          { icon: '✅', label: 'Task approved' },
  approval_rejected:         { icon: '✕', label: 'Task rejected' },
  github_pr_refreshed:       { icon: '⟳', label: 'Pull request status refreshed' },
  operator_session_created:  { icon: '▶', label: 'AI session submitted' },
  operator_session_updated:  { icon: '✎', label: 'AI session updated' },
};

function eventLabel(event: string): { icon: string; label: string } {
  if (event in EVENT_MAP) return EVENT_MAP[event];
  return {
    icon: '•',
    label: event.replace(/_/g, ' '),
  };
}

interface AuditTimelineProps {
  taskId: string;
}

export default async function AuditTimeline({ taskId }: AuditTimelineProps) {
  const logs = await prisma.auditLog.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  if (logs.length === 0) {
    return (
      <div style={{
        padding: '24px 0',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
      {/* Vertical guide line */}
      <li aria-hidden="true" style={{
        position: 'absolute',
        left: 19,
        top: 8,
        bottom: 8,
        width: 2,
        background: 'var(--border)',
        borderRadius: 1,
        pointerEvents: 'none',
      }} />

      {logs.map((log) => {
        const { icon, label } = eventLabel(log.event);
        const relative = relativeTime(log.createdAt);
        const absolute = log.createdAt.toISOString();

        return (
          <li
            key={log.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              paddingBottom: 18,
              position: 'relative',
            }}
          >
            {/* Icon bubble */}
            <div style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--surface, #fff)',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              zIndex: 1,
            }}>
              {icon}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {label}
              </div>
              <div
                title={absolute}
                style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, cursor: 'default' }}
              >
                {relative}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
