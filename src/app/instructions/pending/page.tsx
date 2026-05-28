import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskBadge, EnvBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function PendingApprovalsPage() {
  const pending = await prisma.instruction.findMany({
    where: { status: 'pending_approval' },
    orderBy: { createdAt: 'asc' },
    include: {
      task: { select: { id: true, title: true, riskLevel: true, environment: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Pending Approvals"
        subtitle="Instructions awaiting review before execution"
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
          title="No instructions awaiting approval"
          description="When instructions are submitted for approval they appear here. Approve or block them from the task detail page."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instruction</th>
                  <th>Task</th>
                  <th>Risk</th>
                  <th>Env</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((instr) => (
                  <tr key={instr.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>{instr.title}</div>
                      <span className="id-chip" style={{ marginTop: 3, display: 'inline-block' }}>
                        {instr.id.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/tasks/${instr.task.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {instr.task.title}
                      </Link>
                    </td>
                    <td><RiskBadge level={instr.task.riskLevel} /></td>
                    <td><EnvBadge env={instr.task.environment} /></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {instr.createdAt.toISOString().split('T')[0]}
                    </td>
                    <td>
                      <Link
                        href={`/tasks/${instr.task.id}#instructions`}
                        className="btn btn-primary btn-sm"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            Approve or block from the task detail page via{' '}
            <code style={{ background: 'var(--gray-bg)', padding: '1px 5px', borderRadius: 3 }}>
              PATCH /api/instructions/[id]
            </code>{' '}
            with{' '}
            <code style={{ background: 'var(--gray-bg)', padding: '1px 5px', borderRadius: 3 }}>
              {'{"status":"approved"}'}
            </code>.
          </div>
        </>
      )}
    </div>
  );
}
