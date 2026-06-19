import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

// Valid instruction statuses
const ALL_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'blocked',
] as const;

type InstructionStatus = (typeof ALL_STATUSES)[number];

function isValidStatus(s: string): s is InstructionStatus {
  return (ALL_STATUSES as readonly string[]).includes(s);
}

interface SearchParams {
  status?: string;
}

interface ChangeControlPageProps {
  searchParams: SearchParams;
}

export default async function ChangeControlPage({ searchParams }: ChangeControlPageProps) {
  const filterStatus =
    searchParams.status && isValidStatus(searchParams.status)
      ? searchParams.status
      : undefined;

  const instructions = await prisma.instruction.findMany({
    where: filterStatus ? { status: filterStatus } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      task: {
        include: { project: { select: { id: true, name: true } } },
      },
    },
  });

  // Summary counts (always across all statuses, not filtered)
  const allInstructions = await prisma.instruction.findMany({
    select: { status: true },
  });

  const counts = {
    total: allInstructions.length,
    pending_approval: allInstructions.filter((i) => i.status === 'pending_approval').length,
    approved: allInstructions.filter((i) => i.status === 'approved').length,
    blocked: allInstructions.filter((i) => i.status === 'blocked').length,
    completed: allInstructions.filter((i) => i.status === 'completed').length,
    draft: allInstructions.filter((i) => i.status === 'draft').length,
    executing: allInstructions.filter((i) => i.status === 'executing').length,
  };

  return (
    <div>
      <PageHeader
        title="Change Control"
        subtitle="All instructions across projects — review, approve, and track change requests"
      />

      {/* Summary counts */}
      <div className="section">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { label: 'Total', count: counts.total, color: 'var(--text-secondary)', href: '/change-control' },
            { label: 'Pending Review', count: counts.pending_approval, color: '#f59e0b', href: '/change-control?status=pending_approval' },
            { label: 'Approved', count: counts.approved, color: '#22c55e', href: '/change-control?status=approved' },
            { label: 'Executing', count: counts.executing, color: '#3b82f6', href: '/change-control?status=executing' },
            { label: 'Completed', count: counts.completed, color: '#6b7280', href: '/change-control?status=completed' },
            { label: 'Blocked', count: counts.blocked, color: '#ef4444', href: '/change-control?status=blocked' },
            { label: 'Draft', count: counts.draft, color: '#8b5cf6', href: '/change-control?status=draft' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card card-sm"
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  borderColor:
                    (filterStatus === undefined && item.label === 'Total') ||
                    (filterStatus && item.href.includes(filterStatus))
                      ? item.color
                      : undefined,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: item.color,
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {item.count}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {item.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="section">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/change-control"
            className={`btn btn-sm ${!filterStatus ? 'btn-primary' : 'btn-ghost'}`}
          >
            All
          </Link>
          {ALL_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/change-control?status=${s}`}
              className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
            >
              {s.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
      </div>

      {instructions.length === 0 ? (
        <EmptyState
          icon="◎"
          title={filterStatus ? `No instructions with status "${filterStatus}"` : 'No change requests yet'}
          description="Instructions are created when tasks need structured change control review."
        />
      ) : (
        <div className="section">
          <Card>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Title</th>
                    <th className="col-hide-mobile">Project</th>
                    <th className="col-hide-mobile">Task</th>
                    <th className="col-hide-mobile">Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instructions.map((instruction) => (
                    <tr key={instruction.id}>
                      <td>
                        <Badge text={instruction.status} variant="status" />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{instruction.title}</div>
                        {instruction.blockedReason && (
                          <div
                            style={{
                              fontSize: 11,
                              color: '#ef4444',
                              marginTop: 2,
                              fontStyle: 'italic',
                            }}
                          >
                            Blocked: {instruction.blockedReason}
                          </div>
                        )}
                      </td>
                      <td className="col-hide-mobile">
                        {instruction.task?.project ? (
                          <Link
                            href={`/projects/${instruction.task.project.id}`}
                            style={{ color: 'var(--blue)', fontSize: 12 }}
                          >
                            {instruction.task.project.name}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="col-hide-mobile">
                        {instruction.task ? (
                          <Link
                            href={`/tasks/${instruction.task.id}`}
                            style={{ color: 'var(--blue)', fontSize: 12 }}
                          >
                            {instruction.task.title.length > 40
                              ? `${instruction.task.title.slice(0, 40)}…`
                              : instruction.task.title}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="col-hide-mobile">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {instruction.createdAt.toISOString().split('T')[0]}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/tasks/${instruction.taskId}`}
                          className="btn btn-ghost btn-sm"
                        >
                          View Task
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
