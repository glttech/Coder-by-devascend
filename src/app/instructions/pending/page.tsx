import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskBadge, EnvBadge } from '@/components/ui/Badge';
import InstructionActions from '@/components/InstructionActions';

export const dynamic = 'force-dynamic';

export default async function PendingApprovalsPage() {
  const pending = await prisma.instruction.findMany({
    where: { status: 'pending_approval' },
    orderBy: { createdAt: 'asc' },
    include: {
      task: { select: { id: true, title: true, riskLevel: true, environment: true } },
    },
  });

  // Group instructions by task
  const taskMap = new Map<string, {
    task: { id: string; title: string; riskLevel: string; environment: string };
    instructions: typeof pending;
  }>();
  for (const instr of pending) {
    const key = instr.task.id;
    if (!taskMap.has(key)) taskMap.set(key, { task: instr.task, instructions: [] });
    taskMap.get(key)!.instructions.push(instr);
  }
  const groups = Array.from(taskMap.values());

  return (
    <div>
      <PageHeader
        title="Review Queue"
        subtitle="AI suggestions awaiting review before execution"
        badge={
          pending.length > 0 ? (
            <span className="badge badge-warning">{pending.length} waiting</span>
          ) : (
            <span className="badge badge-success">All clear</span>
          )
        }
      />

      {pending.length === 0 ? (
        <EmptyState
          icon="◉"
          title="No AI suggestions awaiting review"
          description="When AI suggestions are submitted for review they appear here. Approve or block them directly from this page."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map(({ task, instructions }) => (
            <div key={task.id}>
              {/* Task group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)',
              }}>
                <Link href={`/tasks/${task.id}`} style={{ fontWeight: 600, color: 'var(--blue)', fontSize: 14 }}>
                  {task.title}
                </Link>
                <RiskBadge level={task.riskLevel} />
                <EnvBadge env={task.environment} />
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                  {instructions.length} suggestion{instructions.length !== 1 ? 's' : ''} pending
                </span>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>AI Suggestion</th>
                      <th>Submitted</th>
                      <th style={{ minWidth: 260 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructions.map((instr) => (
                      <tr key={instr.id} style={{ verticalAlign: 'top' }}>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{instr.title}</div>
                          <span className="id-chip" style={{ marginTop: 3, display: 'inline-block' }}>
                            {instr.id.slice(0, 8)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12, paddingTop: 12 }}>
                          {instr.createdAt.toISOString().split('T')[0]}
                        </td>
                        <td>
                          <InstructionActions instructionId={instr.id} currentStatus={instr.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
