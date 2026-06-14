import prisma from '@/lib/prisma';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

interface MilestonesPageProps {
  params: { id: string };
}

export default async function MilestonesPage({ params }: MilestonesPageProps) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">⚠</div>
        <div className="empty-state-title">Authentication required</div>
        <p className="empty-state-description">Please log in to view milestones.</p>
      </div>
    );
  }

  const user = roleCheck.user;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
        <p className="empty-state-description">This project does not exist or has been removed.</p>
      </div>
    );
  }

  const milestones = await prisma.milestone.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { id: true, status: true } },
    },
  });

  const now = new Date();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              <Link href={`/projects/${project.id}`} style={{ color: 'var(--blue)' }}>{project.name}</Link>
              {' → '}
              <span>Milestones</span>
            </nav>
            <h1 className="page-title">Milestones</h1>
          </div>
          {user.role === 'admin' && (
            <Link href={`/projects/${project.id}/milestones/new`} className="btn btn-primary btn-sm">
              + New Milestone
            </Link>
          )}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="empty-state" style={{ maxWidth: 480, margin: '48px auto' }}>
          <div className="empty-state-icon">🏁</div>
          <div className="empty-state-title">No milestones yet</div>
          <p className="empty-state-description">
            Create one to group tasks into sprints.
          </p>
          {user.role === 'admin' && (
            <Link href={`/projects/${project.id}/milestones/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              + New Milestone
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {milestones.map((milestone) => {
            const totalTasks = milestone._count.tasks;
            const completedTasks = milestone.tasks.filter((t) => t.status === 'completed').length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const isPastDue =
              milestone.status === 'open' &&
              milestone.targetDate !== null &&
              milestone.targetDate < now;

            return (
              <div key={milestone.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <Link
                        href={`/projects/${project.id}/milestones/${milestone.id}`}
                        style={{ fontWeight: 600, fontSize: 15, color: 'var(--blue)', textDecoration: 'none' }}
                      >
                        {milestone.title}
                      </Link>
                      <span
                        className={`badge ${milestone.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}
                        style={{ fontSize: 11 }}
                      >
                        {milestone.status}
                      </span>
                    </div>

                    {milestone.description && (
                      <p
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          margin: '0 0 8px',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {milestone.description}
                      </p>
                    )}

                    {milestone.targetDate && (
                      <div style={{ fontSize: 12, color: isPastDue ? 'var(--red)' : 'var(--text-muted)', marginBottom: 8, fontWeight: isPastDue ? 600 : 400 }}>
                        {isPastDue ? 'Past due: ' : 'Due: '}
                        {milestone.targetDate.toLocaleDateString()}
                        {isPastDue && ' ⚠'}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, maxWidth: 200, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: milestone.status === 'completed' ? 'var(--green)' : 'var(--blue)',
                            borderRadius: 3,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {completedTasks} of {totalTasks} tasks complete
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/projects/${project.id}/milestones/${milestone.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
