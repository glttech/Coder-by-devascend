import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Displays all tasks with their status and a link to the detail page.  This
 * page supplements the dashboard and provides an easy way to access tasks.
 */
export default async function TaskList() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      instructions: {
        where: { status: 'pending_approval' },
        select: { id: true },
      },
    },
  });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tasks</h2>
      <Link href="/tasks/new" className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">New Task</Link>
      <table className="min-w-full text-sm border-collapse mt-4">
        <thead>
          <tr>
            <th className="border-b py-2 text-left">ID</th>
            <th className="border-b py-2 text-left">Title</th>
            <th className="border-b py-2 text-left">Status</th>
            <th className="border-b py-2 text-left">Agent</th>
            <th className="border-b py-2 text-left">Created</th>
            <th className="border-b py-2 text-left">Instructions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-gray-100">
              <td className="py-2 pr-2">
                <Link href={`/tasks/${task.id}`} className="text-blue-600 underline">
                  {task.id.slice(0, 8)}
                </Link>
              </td>
              <td className="py-2 pr-2">{task.title}</td>
              <td className="py-2 pr-2">{task.status}</td>
              <td className="py-2 pr-2">{task.agentTool}</td>
              <td className="py-2 pr-2">{task.createdAt.toISOString().split('T')[0]}</td>
              <td className="py-2 pr-2">
                {task.instructions.length > 0 && (
                  <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#d97706', color: '#fff' }}>
                    {task.instructions.length} pending
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}