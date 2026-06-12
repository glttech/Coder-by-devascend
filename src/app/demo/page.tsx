import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { getCurrentUser, isAuthEnabled } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  // Redirect to login when auth is enforced and user is not authenticated.
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login');
    }
  }

  // Fetch seeded projects with task counts.
  let projects: { id: string; name: string; description: string | null; repoOwner: string | null; repoName: string | null; _count: { tasks: number; githubPRs: number } }[] = [];
  let totalTasks = 0;
  let totalRuns = 0;
  let totalPRs = 0;
  let dbError = false;

  try {
    projects = await prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { tasks: true, githubPRs: true } } },
    });
    totalTasks = await prisma.task.count();
    totalRuns = await prisma.agentRun.count();
    totalPRs = await prisma.githubPR.count();
  } catch {
    dbError = true;
  }

  const hasDemoData = projects.some(
    (p) => p.name === 'Payments API' || p.name === 'Auth Service',
  );

  return (
    <div>
      <PageHeader
        title="Demo Mode"
        subtitle="Sample data overview — explore the app with pre-populated content"
      />

      {/* Setup banner */}
      {!hasDemoData && !dbError && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 8,
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.35)',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--amber)' }}>No demo data found.</strong>{' '}
          Run{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: 3 }}>
            npm run seed:demo
          </code>{' '}
          in your terminal to populate sample projects, tasks, agent runs, and PRs.
        </div>
      )}

      {hasDemoData && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 8,
          background: 'rgba(34,197,94,0.07)',
          border: '1px solid rgba(34,197,94,0.25)',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--green)' }}>Demo data is loaded.</strong>{' '}
          The app is populated with {totalTasks} tasks, {totalRuns} agent runs, and {totalPRs} GitHub PRs across {projects.length} projects.
          Re-run{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: 3 }}>
            npm run seed:demo
          </code>{' '}
          any time to refresh — all upserts are idempotent.
        </div>
      )}

      {dbError && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 8,
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--red)' }}>Database unavailable.</strong>{' '}
          Could not connect to the database. Check that{' '}
          <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: 3 }}>DATABASE_URL</code>{' '}
          is set and the DB is running.
        </div>
      )}

      {/* Summary stats */}
      {hasDemoData && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Summary</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-card-label">Projects</div>
              <div className="stat-card-value">{projects.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Tasks</div>
              <div className="stat-card-value">{totalTasks}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Agent Runs</div>
              <div className="stat-card-value">{totalRuns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">GitHub PRs</div>
              <div className="stat-card-value">{totalPRs}</div>
            </div>
          </div>
        </div>
      )}

      {/* Project list */}
      {projects.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Seeded Projects</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Repository</th>
                  <th>Tasks</th>
                  <th>PRs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ color: 'var(--blue)', fontWeight: 500 }}
                      >
                        {p.name}
                      </Link>
                      {p.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {p.description.slice(0, 80)}{p.description.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.repoOwner && p.repoName ? (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {p.repoOwner}/{p.repoName}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p._count.tasks}</span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p._count.githubPRs}</span>
                    </td>
                    <td>
                      <Link href={`/projects/${p.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick navigation */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Explore the app</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { href: '/', label: 'Dashboard', desc: 'Overview with stats, recent tasks, and PR health.' },
            { href: '/projects', label: 'Projects', desc: 'Browse repositories and their imported PRs.' },
            { href: '/tasks', label: 'Tasks', desc: 'All AI-assisted development tasks.' },
            { href: '/instructions/pending', label: 'Review Queue', desc: 'Pending AI suggestions awaiting human approval.' },
            { href: '/audit', label: 'Audit Log', desc: 'Full event trail for every change.' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card-bg)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue)', minWidth: 130 }}>
                {label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* How to run seed */}
      <div className="section">
        <div className="card" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
            Populate or refresh demo data
          </div>
          <p style={{ marginBottom: 8 }}>
            Run the following command to seed (or re-seed) the database with the demo dataset:
          </p>
          <code style={{
            display: 'block',
            fontFamily: 'monospace',
            fontSize: 13,
            background: 'rgba(0,0,0,0.06)',
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 8,
          }}>
            npm run seed:demo
          </code>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 0 }}>
            The script uses fixed UUIDs for all records, so it is safe to run repeatedly — existing
            demo data will be updated in place rather than duplicated.
          </p>
        </div>
      </div>
    </div>
  );
}
