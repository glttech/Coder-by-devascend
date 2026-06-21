import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildSessionStats, buildTaskStats, buildPrStatsFromList, todayUTC } from '@/lib/coder/dashboardStats';

export const dynamic = 'force-dynamic';

// ── Shared style helpers ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:   { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
    running:   { bg: 'rgba(59,130,246,0.1)',  color: '#2563eb' },
    completed: { bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
    failed:    { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
    cancelled: { bg: 'rgba(156,163,175,0.1)', color: '#6b7280' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}4d`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
  const color = colors[risk] ?? '#64748b';
  return (
    <span style={{ color, background: `${color}1a`, border: `1px solid ${color}4d`, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {risk}
    </span>
  );
}

function PrStateBadge({ state, merged }: { state: string; merged: boolean }) {
  if (merged) return <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600, background: 'rgba(124,58,237,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(124,58,237,0.3)' }}>merged</span>;
  return <StatusBadge status={state} />;
}

function relativeTime(ts: Date | string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return '—';
  const endMs = end ? end.getTime() : Date.now();
  const secs = Math.round((endMs - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
  href?: string;
}

function StatCard({ label, value, sub, accent = 'var(--blue)', href }: StatCardProps) {
  const inner = (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'contents' }}>{inner}</Link>;
  return inner;
}

// ── Risk bar ─────────────────────────────────────────────────────────────────

function RiskBar({ byRisk }: { byRisk: { low: number; medium: number; high: number; unknown: number } }) {
  const total = byRisk.low + byRisk.medium + byRisk.high + byRisk.unknown;
  if (total === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No open tasks</div>;

  const segments = [
    { label: 'high',    count: byRisk.high,    color: '#dc2626' },
    { label: 'medium',  count: byRisk.medium,  color: '#d97706' },
    { label: 'low',     count: byRisk.low,     color: '#16a34a' },
    { label: 'unknown', count: byRisk.unknown, color: '#94a3b8' },
  ].filter((s) => s.count > 0);

  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ flex: s.count / total, background: s.color, minWidth: 4 }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {segments.map((s) => (
          <span key={s.label} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}{count !== undefined && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span>}</h2>
      {href && <Link href={href} style={{ fontSize: 12, color: 'var(--blue)' }}>View all →</Link>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CoderDashboardPage() {
  const today = todayUTC();

  const [allSessions, allTasks, allPrs, repoCount, activeSessions, openTasks, recentPrs] = await Promise.all([
    // For stat aggregation — lightweight selects
    prisma.cliSession.findMany({
      select: { status: true, startedAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      select: { status: true, riskLevel: true, approvalRequired: true, approval: { select: { approved: true } } },
    }),
    prisma.repositoryPR.findMany({
      select: { state: true, merged: true, ciStatus: true, githubMergedAt: true },
    }),
    prisma.repository.count({ where: { enabled: true } }),

    // For active sessions panel
    prisma.cliSession.findMany({
      where: { status: 'running' },
      orderBy: { startedAt: 'asc' },
      take: 8,
      select: {
        id: true,
        command: true,
        status: true,
        startedAt: true,
        task: { select: { id: true, title: true } },
        repository: { select: { id: true, fullName: true } },
        summary: true,
      },
    }),

    // For open tasks panel
    prisma.task.findMany({
      where: { status: { notIn: ['completed', 'failed', 'cancelled', 'approved'] } },
      orderBy: [{ riskLevel: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        riskLevel: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        approval: { select: { approved: true } },
      },
    }),

    // For recent PRs panel
    prisma.repositoryPR.findMany({
      where: { OR: [{ state: 'open' }, { merged: true }] },
      orderBy: { githubUpdatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        prUrl: true,
        sourceBranch: true,
        githubUpdatedAt: true,
        repository: { select: { id: true, fullName: true } },
        task: { select: { id: true, title: true } },
        cliSession: { select: { id: true } },
      },
    }),
  ]);

  const sessionStats = buildSessionStats(allSessions, today);
  const taskStats = buildTaskStats(allTasks);
  const prStats = buildPrStatsFromList(allPrs, today);

  const pendingSessionCount = activeSessions.length === 0
    ? await prisma.cliSession.count({ where: { status: 'pending' } })
    : 0;

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle={`Work Control Room overview · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
      />

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <StatCard
          label="Active Sessions"
          value={sessionStats.active}
          sub={sessionStats.pending > 0 ? `${sessionStats.pending} pending` : 'none pending'}
          accent={sessionStats.active > 0 ? '#2563eb' : 'var(--text-muted)'}
          href="/coder/sessions?status=running"
        />
        <StatCard
          label="Open Tasks"
          value={taskStats.open}
          sub={taskStats.pendingApproval > 0 ? `${taskStats.pendingApproval} need approval` : 'none pending approval'}
          accent={taskStats.open > 0 ? '#7c3aed' : 'var(--text-muted)'}
          href="/coder/tasks"
        />
        <StatCard
          label="Open PRs"
          value={prStats.open}
          sub={prStats.ciFailure > 0 ? `${prStats.ciFailure} CI failure` : prStats.mergedToday > 0 ? `${prStats.mergedToday} merged today` : 'all CI green'}
          accent={prStats.ciFailure > 0 ? '#dc2626' : prStats.open > 0 ? '#0891b2' : 'var(--text-muted)'}
          href="/coder/control-room"
        />
        <StatCard
          label="Repos"
          value={repoCount}
          sub={`${sessionStats.completedToday} sessions done today`}
          accent="var(--text-secondary)"
          href="/coder/repositories"
        />
        {sessionStats.failedToday > 0 && (
          <StatCard
            label="Failed Today"
            value={sessionStats.failedToday}
            sub="sessions"
            accent="#dc2626"
            href="/coder/sessions?status=failed"
          />
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>

        {/* Risk breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
          <SectionHeader title="Open Task Risk" href="/coder/tasks" count={taskStats.open} />
          <RiskBar byRisk={taskStats.byRisk} />
        </div>

        {/* Active sessions */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
          <SectionHeader title="Active Sessions" href="/coder/sessions?status=running" count={sessionStats.active} />
          {activeSessions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No sessions currently running
              {pendingSessionCount > 0 && ` · ${pendingSessionCount} pending`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeSessions.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/coder/sessions/${s.id}`} style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 500, display: 'block', wordBreak: 'break-all' }}>
                      <code>{s.command.slice(0, 60)}{s.command.length > 60 ? '…' : ''}</code>
                    </Link>
                    {s.summary && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{s.summary}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.repository?.fullName ?? ''}
                      {s.repository && s.task ? ' · ' : ''}
                      {s.task?.title ?? ''}
                      {s.startedAt ? ` · ${formatDuration(s.startedAt, null)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Open tasks ── */}
      {openTasks.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
          <SectionHeader title="Open Tasks" href="/coder/tasks" count={openTasks.length} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th className="col-hide-mobile">Risk</th>
                  <th className="col-hide-mobile">Project</th>
                  <th className="col-hide-mobile">Updated</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {openTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tasks/${t.id}`} style={{ color: 'var(--blue)', fontWeight: 500, fontSize: 13 }}>
                        {t.title.length > 60 ? t.title.slice(0, 60) + '…' : t.title}
                      </Link>
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="col-hide-mobile"><RiskBadge risk={t.riskLevel} /></td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {t.project?.name ?? '—'}
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {relativeTime(t.updatedAt)}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {t.approval?.approved === true ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ approved</span>
                      ) : t.approval?.approved === false ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ rejected</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent PRs ── */}
      {recentPrs.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
          <SectionHeader title="Recent PRs" href="/coder/control-room" count={recentPrs.length} />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>State</th>
                  <th className="col-hide-mobile">CI</th>
                  <th className="col-hide-mobile">Repo</th>
                  <th className="col-hide-mobile">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentPrs.map((pr) => (
                  <tr key={pr.id}>
                    <td style={{ fontSize: 12 }}>
                      {pr.prUrl ? (
                        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 500 }}>
                          #{pr.prNumber} {pr.title.length > 55 ? pr.title.slice(0, 55) + '…' : pr.title}
                        </a>
                      ) : (
                        <span>#{pr.prNumber} {pr.title}</span>
                      )}
                      {pr.sourceBranch && (
                        <div><code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pr.sourceBranch}</code></div>
                      )}
                    </td>
                    <td><PrStateBadge state={pr.state} merged={pr.merged} /></td>
                    <td className="col-hide-mobile" style={{ fontSize: 11 }}>
                      {pr.ciStatus ? (
                        <span style={{ color: pr.ciStatus === 'success' ? '#16a34a' : pr.ciStatus === 'failure' ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                          {pr.ciStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {pr.repository ? (
                        <Link href={`/coder/repositories/${pr.repository.id}`} style={{ color: 'var(--text-secondary)' }}>
                          {pr.repository.fullName}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {pr.githubUpdatedAt ? relativeTime(pr.githubUpdatedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {openTasks.length === 0 && recentPrs.length === 0 && activeSessions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>No active work found.</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <Link href="/coder/tasks" style={{ color: 'var(--blue)' }}>Create a task</Link> or{' '}
            <Link href="/coder/repositories" style={{ color: 'var(--blue)' }}>add a repository</Link> to get started.
          </div>
        </div>
      )}
    </div>
  );
}
