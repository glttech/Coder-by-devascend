import prisma from '@/lib/prisma';
import Link from 'next/link';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          {pending.length} instruction{pending.length !== 1 ? 's' : ''} awaiting review
        </span>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm" style={{ color: '#6b7280' }}>
          No instructions currently awaiting approval.
        </p>
      ) : (
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border-b py-2 text-left pr-4">Instruction</th>
              <th className="border-b py-2 text-left pr-4">Task</th>
              <th className="border-b py-2 text-left pr-4">Risk</th>
              <th className="border-b py-2 text-left pr-4">Env</th>
              <th className="border-b py-2 text-left pr-4">Submitted</th>
              <th className="border-b py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((instr) => (
              <tr key={instr.id} className="hover:bg-gray-100">
                <td className="py-2 pr-4">
                  <div className="font-medium">{instr.title}</div>
                  <div className="text-xs" style={{ fontFamily: 'monospace', color: '#6b7280' }}>
                    {instr.id.slice(0, 8)}
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <Link
                    href={`/tasks/${instr.task.id}`}
                    className="text-blue-600 underline"
                  >
                    {instr.task.title}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  <RiskBadge level={instr.task.riskLevel} />
                </td>
                <td className="py-2 pr-4 text-xs">{instr.task.environment}</td>
                <td className="py-2 pr-4 text-xs" style={{ color: '#6b7280' }}>
                  {instr.createdAt.toISOString().split('T')[0]}
                </td>
                <td className="py-2">
                  <Link
                    href={`/tasks/${instr.task.id}#instructions`}
                    className="text-blue-600 underline text-xs"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs" style={{ color: '#9ca3af' }}>
        Approve or block instructions from the task detail page.
        Use <code>PATCH /api/instructions/[id]</code> with <code>{'{"status":"approved"}'}</code> or <code>{'{"status":"blocked","blockedReason":"..."}'}</code>.
      </p>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, React.CSSProperties> = {
    low:    { background: '#dcfce7', color: '#15803d' },
    medium: { background: '#fef9c3', color: '#a16207' },
    high:   { background: '#fee2e2', color: '#b91c1c' },
  };
  const style = styles[level] ?? { background: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ ...style, padding: '1px 6px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
      {level}
    </span>
  );
}
