import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { EventBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function DetailsSummary({ raw }: { raw: string | null }) {
  const data = parseDetails(raw);
  if (!data) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  const skip = new Set(['instructionId', 'taskId', 'at']);
  const display: [string, unknown][] = Object.entries(data).filter(([k]) => !skip.has(k));

  return (
    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
      {display.slice(0, 6).map(([k, v]) => (
        <div key={k}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}:</span>{' '}
          <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
            {typeof v === 'string' && v.length > 60 ? v.slice(0, 30) + '…' : String(v ?? '—')}
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

  const subtitle = [
    logs.length === 200 ? '200+ entries (latest 200 shown)' : `${logs.length} entries`,
    taskId ? `· filtered by task ${taskId.slice(0, 8)}` : null,
    instructionId ? `· filtered by instruction ${instructionId.slice(0, 8)}` : null,
  ].filter(Boolean).join(' ');

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={subtitle}
        actions={
          (taskId || instructionId) ? (
            <Link href="/audit" className="btn btn-ghost btn-sm">Clear filters</Link>
          ) : undefined
        }
      />

      {logs.length === 0 ? (
        <EmptyState
          icon="◎"
          title="No audit entries"
          description="Audit entries are recorded automatically when instructions are created, status-changed, or operator sessions are submitted."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>When</th>
                <th>Event</th>
                <th>Task</th>
                <th>Instruction</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ verticalAlign: 'top' }}>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', paddingTop: 12 }}>
                    {log.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td style={{ paddingTop: 12 }}>
                    <EventBadge event={log.event} />
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {log.task ? (
                      <Link href={`/tasks/${log.task.id}`} style={{ color: 'var(--blue)' }}>
                        {log.task.title.length > 28 ? log.task.title.slice(0, 28) + '…' : log.task.title}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {log.instruction ? (
                      <Link href={`/audit?instructionId=${log.instruction.id}`} style={{ color: 'var(--blue)' }}>
                        {log.instruction.title.length > 28 ? log.instruction.title.slice(0, 28) + '…' : log.instruction.title}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td><DetailsSummary raw={log.details} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
