import prisma from '@/lib/prisma';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import MilestoneStatusToggle from './MilestoneStatusToggle';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; milestoneId: string };
}

export default async function MilestoneDetailPage({ params }: PageProps) {
  const currentUser = await getCurrentUser();
  const roleCheck = requireRole(currentUser, 'any');
  if (!roleCheck.ok) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">⚠</div>
        <div className="empty-state-title">Authentication required</div>
        <p className="empty-state-description">Please log in to view this milestone.</p>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
      </div>
    );
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: params.milestoneId },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          priority: true,
          status: true,
          dueDate: true,
          riskLevel: true,
        },
      },
    },
  });

  if (!milestone || milestone.projectId !== params.id) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Milestone not found</div>
        <p className="empty-state-description">
          <Link href={`/projects/${params.id}/milestones`} style={{ color: 'var(--blue)' }}>Back to milestones</Link>
        </p>
      </div>
    );
  }

  const totalTasks = milestone.tasks.length;
  const completedTasks = milestone.tasks.filter((t) => t.status === 'completed').length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const now = new Date();
  const isPastDue = milestone.status === 'open' && milestone.targetDate && milestone.targetDate < now;
  const isAdmin = roleCheck.user.role === 'admin';

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link href={`/projects/${project.id}`} style={{ color: 'var(--blue)' }}>{project.name}</Link>
        <span>›</span>
        <Link href={`/projects/${project.id}/milestones`} style={{ color: 'var(--blue)' }}>Milestones</Link>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>{milestone.title}</span>
      </nav>

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{milestone.title}</h1>
              <span className={`badge ${milestone.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>
                {milestone.status}
              </span>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <MilestoneStatusToggle
                projectId={params.id}
                milestoneId={params.milestoneId}
                currentStatus={milestone.status}
              />
              <Link
                href={`/projects/${params.id}/milestones/${params.milestoneId}/edit`}
                className="btn btn-ghost btn-sm"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="section">
        <div className="card">
          <div className="meta-grid">
            {milestone.description && (
              <div className="meta-row">
                <span className="meta-label">Description</span>
                <span className="meta-value">{milestone.description}</span>
              </div>
            )}
            {milestone.targetDate && (
              <div className="meta-row">
                <span className="meta-label">Target Date</span>
                <span className="meta-value" style={{ color: isPastDue ? 'var(--red)' : undefined, fontWeight: isPastDue ? 600 : undefined }}>
                  {milestone.targetDate.toLocaleDateString()}
                  {isPastDue && ' — Past due'}
                </span>
              </div>
            )}
            <div className="meta-row">
              <span className="meta-label">Status</span>
              <span className="meta-value">
                <span className={`badge ${milestone.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>
                  {milestone.status}
                </span>
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Created</span>
              <span className="meta-value">{milestone.createdAt.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Progress</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {completedTasks} of {totalTasks} tasks complete ({pct}%)
          </span>
        </div>
        <div className="card">
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {completedTasks} of {totalTasks} tasks complete
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: pct === 100 ? 'var(--green)' : 'var(--text-muted)' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: pct === 100 ? 'var(--green)' : 'var(--blue)',
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Tasks ({totalTasks})</span>
        </div>
        {milestone.tasks.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks linked to this milestone.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {milestone.tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link href={`/tasks/${task.id}`} style={{ color: 'var(--blue)', fontWeight: 500 }}>
                        {task.title}
                      </Link>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: task.priority === 'critical' ? 'var(--red)' : task.priority === 'high' ? 'var(--amber)' : 'var(--text-muted)',
                      }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.status}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {task.dueDate ? task.dueDate.toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: task.riskLevel === 'high' ? 'var(--red)' : task.riskLevel === 'medium' ? 'var(--amber)' : 'var(--green)',
                      }}>
                        {task.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
