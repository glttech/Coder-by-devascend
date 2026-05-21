import prisma from '@/lib/prisma';
import Link from 'next/link';

/**
 * Dashboard page.  Displays high‑level statistics about tasks and recent
 * agent runs.  Uses server components to query Prisma directly.  If the
 * database has not been migrated yet the queries will throw; wrap them in
 * try/catch and fall back to zero counts.
 */
export default async function Dashboard() {
  let totalTasks = 0;
  let byStatus: Record<string, number> = {};
  let recentRuns: { id: string; taskId: string; status: string; startedAt: Date }[] = [];
  let pendingApprovals = 0;
  let failedEvaluations = 0;
  try {
    totalTasks = await prisma.task.count();
    const tasks = await prisma.task.findMany({ include: { agentRuns: { include: { evaluations: true } }, approval: true } });
    // Compute counts by status
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
  } catch (err) {
    console.warn('Database not ready or other error', err);
  }

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
                    {/* Link run ID to its parent task since there is no dedicated run page */}
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