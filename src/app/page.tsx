import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Dashboard page.  Displays high-level statistics about tasks, recent
 * agent runs, and governance health signals (Phase 2 Step 7).
 */
export default async function Dashboard() {
  let totalTasks = 0;
  let byStatus: Record<string, number> = {};
  let recentRuns: { id: string; taskId: string; status: string; startedAt: Date }[] = [];
  let pendingApprovals = 0;
  let failedEvaluations = 0;

  // Governance health signals
  let pendingInstructions = 0;
  let blockedInstructions = 0;
  let staleInstructions = 0;
  let sessionsNeedingAction = 0;

  try {
    totalTasks = await prisma.task.count();
    const tasks = await prisma.task.findMany({ include: { agentRuns: { include: { evaluations: true } }, approval: true } });
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      if (t.approvalRequired && (!t.approval || t.approval.approved === null)) {
        pendingApprovals++;
      }
      for (const run of t.agentRuns) {
        for (const evalRes of run.evaluations) {
          if (!evalRes.passed) failedEvaluations++;
        }
        recentRuns.push({ id: run.id, taskId: t.id, status: run.status, startedAt: run.startedAt });
      }
    }
    recentRuns.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    recentRuns = recentRuns.slice(0, 5);

    // Governance health: instruction status counts
    [pendingInstructions, blockedInstructions] = await Promise.all([
      prisma.instruction.count({ where: { status: 'pending_approval' } }),
      prisma.instruction.count({ where: { status: 'blocked' } }),
    ]);

    // Stale instructions: approved/executing with no stateVersion (pre-hash rows) or
    // instructions in executing/approved state older than 7 days without resolution.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    staleInstructions = await prisma.instruction.count({
      where: {
        status: { in: ['approved', 'executing'] },
        updatedAt: { lt: sevenDaysAgo },
      },
    });

    // Operator sessions needing action: recommendedAction is not CONTINUE and session
    // was created in the last 48 hours (still actionable).
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    sessionsNeedingAction = await prisma.operatorSession.count({
      where: {
        createdAt: { gte: twoDaysAgo },
        AND: [
          { recommendedAction: { not: null } },
          { recommendedAction: { not: 'CONTINUE' } },
        ],
      },
    });
  } catch (err) {
    console.warn('Database not ready or other error', err);
  }

  const healthWarning = pendingInstructions > 0 || blockedInstructions > 0 || staleInstructions > 0 || sessionsNeedingAction > 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={totalTasks.toString()} />
          {Object.entries(byStatus).map(([status, count]) => (
            <StatCard key={status} label={status.replace(/^(.)/, (c) => c.toUpperCase())} value={count.toString()} />
          ))}
          <StatCard label="Pending Approvals" value={pendingApprovals.toString()} />
          <StatCard label="Failed Evaluations" value={failedEvaluations.toString()} />
        </div>
      </section>

      {/* Governance Health Signals — Phase 2 Step 7 */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Governance Health</h2>
          {healthWarning ? (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              Needs attention
            </span>
          ) : (
            <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              All clear
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthCard
            label="Pending Approvals"
            value={pendingInstructions}
            href="/instructions/pending"
            warn={pendingInstructions > 0}
            warnColor="#d97706"
          />
          <HealthCard
            label="Blocked Instructions"
            value={blockedInstructions}
            href="/tasks"
            warn={blockedInstructions > 0}
            warnColor="#dc2626"
          />
          <HealthCard
            label="Stale (7d+)"
            value={staleInstructions}
            href="/tasks"
            warn={staleInstructions > 0}
            warnColor="#7c3aed"
            tooltip="Approved/executing instructions not updated in 7+ days"
          />
          <HealthCard
            label="Sessions Needing Action"
            value={sessionsNeedingAction}
            href="/tasks"
            warn={sessionsNeedingAction > 0}
            warnColor="#d97706"
            tooltip="Operator sessions from last 48h with non-CONTINUE decision"
          />
        </div>
        <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
          <Link href="/audit" className="text-blue-600 underline">View full audit log</Link>
          {' · '}
          <Link href="/instructions/pending" className="text-blue-600 underline">Review pending instructions</Link>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Recent Agent Runs</h2>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-gray-600">No runs recorded yet.</p>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border-b py-2 text-left">Run ID</th>
                <th className="border-b py-2 text-left">Task</th>
                <th className="border-b py-2 text-left">Status</th>
                <th className="border-b py-2 text-left">Started At</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id} className="hover:bg-gray-100">
                  <td className="py-2 pr-2 text-blue-600 underline">
                    <Link href={`/tasks/${run.taskId}`}>{run.id.slice(0, 8)}</Link>
                  </td>
                  <td className="py-2 pr-2">
                    <Link href={`/tasks/${run.taskId}`}>{run.taskId.slice(0, 8)}</Link>
                  </td>
                  <td className="py-2 pr-2">{run.status}</td>
                  <td className="py-2 pr-2">{run.startedAt.toISOString().split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded p-4 shadow-sm flex flex-col items-start">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

function HealthCard({
  label, value, href, warn, warnColor, tooltip,
}: {
  label: string;
  value: number;
  href: string;
  warn: boolean;
  warnColor: string;
  tooltip?: string;
}) {
  const borderColor = warn ? warnColor : '#e5e7eb';
  const valueColor = warn ? warnColor : '#111827';
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        className="bg-white rounded p-4 shadow-sm flex flex-col items-start"
        style={{ border: `2px solid ${borderColor}`, cursor: 'pointer' }}
        title={tooltip}
      >
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-2xl font-bold" style={{ color: valueColor }}>{value}</span>
      </div>
    </Link>
  );
}
