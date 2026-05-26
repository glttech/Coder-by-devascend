import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const EVENT_BADGE: Record<string, React.CSSProperties> = {
  instruction_created:        { background: '#dbeafe', color: '#1d4ed8' },
  instruction_status_changed: { background: '#ede9fe', color: '#6d28d9' },
  operator_session_created:   { background: '#dcfce7', color: '#15803d' },
  operator_session_updated:   { background: '#d1fae5', color: '#065f46' },
};

function EventBadge({ event }: { event: string }) {
  const style = EVENT_BADGE[event] ?? { background: '#f3f4f6', color: '#374151' };
  const label = event.replace(/_/g, ' ');
  return (
    <span style={{ ...style, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function DetailsSummary({ raw }: { raw: string | null }) {
  const data = parseDetails(raw);
  if (!data) return <span style={{ color: '#9ca3af' }}>—</span>;

  // Surface the most useful fields first, omit IDs already shown in other columns.
  const display: [string, unknown][] = [];
  const skip = new Set(['instructionId', 'taskId', 'at']);
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    display.push([k, v]);
  }

  return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      {display.slice(0, 6).map(([k, v]) => (
        <div key={k}>
          <span style={{ color: '#6b7280' }}>{k}:</span>{' '}
          <span style={{ fontFamily: 'monospace' }}>
            {typeof v === 'string' && v.length > 40 ? v.slice(0, 12) + '…' : String(v ?? '—')}
          </span>
        </div>
      ))}
    </div>
  );
}

interface AuditPageProps {
  searchParams: { taskId?: string; instructionId?: string };
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const { taskId, instructionId } = searchParams;

  const where: Record<string, unknown> = {};
  if (taskId) where.taskId = taskId;
  if (instructionId) where.instructionId = instructionId;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      task: { select: { id: true, title: true } },
      instruction: { select: { id: true, title: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          {logs.length === 200 ? '200+ entries (latest 200 shown)' : `${logs.length} entries`}
          {taskId && <> · filtered by task <code>{taskId.slice(0, 8)}</code></>}
          {instructionId && <> · filtered by instruction <code>{instructionId.slice(0, 8)}</code></>}
        </span>
      </div>

      {(taskId || instructionId) && (
        <p className="text-xs">
          <Link href="/audit" className="text-blue-600 underline">Clear filters</Link>
        </p>
      )}

      {logs.length === 0 ? (
        <p className="text-sm" style={{ color: '#6b7280' }}>No audit entries found.</p>
      ) : (
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border-b py-2 text-left pr-4" style={{ width: 140 }}>When</th>
              <th className="border-b py-2 text-left pr-4">Event</th>
              <th className="border-b py-2 text-left pr-4">Task</th>
              <th className="border-b py-2 text-left pr-4">Instruction</th>
              <th className="border-b py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-100" style={{ verticalAlign: 'top' }}>
                <td className="py-2 pr-4 text-xs" style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {log.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                </td>
                <td className="py-2 pr-4">
                  <EventBadge event={log.event} />
                </td>
                <td className="py-2 pr-4 text-xs">
                  {log.task ? (
                    <Link href={`/tasks/${log.task.id}?audit=1`} className="text-blue-600 underline">
                      {log.task.title.length > 24 ? log.task.title.slice(0, 24) + '…' : log.task.title}
                    </Link>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {log.instruction ? (
                    <Link href={`/audit?instructionId=${log.instruction.id}`} className="text-blue-600 underline">
                      {log.instruction.title.length > 24 ? log.instruction.title.slice(0, 24) + '…' : log.instruction.title}
                    </Link>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  )}
                </td>
                <td className="py-2">
                  <DetailsSummary raw={log.details} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
