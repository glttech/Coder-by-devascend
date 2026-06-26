import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import {
  analyzePrImportance,
  compareByImportance,
  PRIORITY_META,
  TRIAGE_META,
} from '@/lib/prIntelligence';

export const dynamic = 'force-dynamic';

// ── Small presentational helpers ─────────────────────────────────────────────

function CiBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
  const cls: Record<string, string> = {
    success: 'badge-success',
    failure: 'badge-sev-high',
    pending: 'badge-warning',
    neutral: 'badge-neutral',
  };
  return <span className={`badge ${cls[status] ?? 'badge-neutral'}`}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, React.CSSProperties> = {
    critical: { background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' },
    high: { background: 'rgba(249,115,22,0.1)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.3)' },
    medium: { background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' },
    low: { background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' },
  };
  const style =
    styles[severity] ??
    ({ background: 'rgba(100,116,139,0.1)', color: '#475569', border: '1px solid rgba(100,116,139,0.3)' } as React.CSSProperties);
  return (
    <span style={{ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {severity}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ExecutivePage() {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'any');
  if (!authResult.ok) redirect('/login');

  // ── 1. All open PRs with intelligence ──────────────────────────────────────
  const allOpenPRs = await prisma.githubPR.findMany({
    where: { state: 'open', merged: false },
    orderBy: { githubUpdatedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      projectId: true,
      prNumber: true,
      title: true,
      body: true,
      state: true,
      merged: true,
      ciStatus: true,
      classification: true,
      labels: true,
      filesChanged: true,
      filesChangedCount: true,
      prUrl: true,
      githubUpdatedAt: true,
      importedAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  const analysed = allOpenPRs
    .map((pr) => ({ pr, intel: analyzePrImportance(pr) }))
    .sort((a, b) => compareByImportance(a.intel, b.intel));

  // Section 1: Action Required — blocked PRs (triage === 'blocked')
  const blockedPRs = analysed.filter((item) => item.intel.triage === 'blocked');

  // Section 2: Review Needed — high/critical priority, needs_review
  const reviewNeededPRs = analysed.filter(
    (item) =>
      item.intel.triage === 'needs_review' &&
      (item.intel.priority === 'high' || item.intel.priority === 'critical'),
  );

  // Section 3: Failed CI — ciStatus=failure across all projects
  const failedCIPRs = analysed.filter((item) => item.pr.ciStatus === 'failure');

  // Section 4: At-Risk — high/critical importance score, open
  const atRiskPRs = analysed.filter(
    (item) =>
      (item.intel.priority === 'high' || item.intel.priority === 'critical') &&
      item.intel.triage !== 'blocked', // blocked already shown in section 1
  );

  // ── 2. Top-level counts + project list ─────────────────────────────────────
  const [totalProjects, totalOpenPRs, totalIncidents, totalTasks, projects] = await Promise.all([
    prisma.project.count(),
    prisma.githubPR.count({ where: { state: 'open', merged: false } }),
    prisma.incident.count({ where: { status: { in: ['open', 'investigating'] } } }),
    prisma.task.count({ where: { status: { not: 'done' } } }),
    prisma.project.findMany({ select: { id: true, name: true, repoOwner: true, repoName: true }, orderBy: { name: 'asc' } }),
  ]);

  // ── 3. Recent Activity — last 5 merged PRs ──────────────────────────────────
  const recentMergedPRs = await prisma.githubPR.findMany({
    where: { merged: true },
    orderBy: { githubMergedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      projectId: true,
      prNumber: true,
      title: true,
      ciStatus: true,
      githubMergedAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  // ── 4. Repo health — per-project PR breakdown ───────────────────────────────
  const repoHealth = projects.map((p) => {
    const prs = analysed.filter((item) => item.pr.projectId === p.id);
    return {
      project: p,
      total: prs.length,
      blocked: prs.filter((i) => i.intel.triage === 'blocked').length,
      needsReview: prs.filter((i) => i.intel.triage === 'needs_review').length,
      failedCI: prs.filter((i) => i.pr.ciStatus === 'failure').length,
    };
  }).filter((r) => r.total > 0);

  // ── 5. Recent Incidents ──────────────────────────────────────────────────────
  const recentIncidents = await prisma.incident.findMany({
    where: { status: { in: ['open', 'investigating'] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      severity: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Control Room"
        subtitle="What needs your attention right now"
        actions={
          <Link href="/review" className="btn btn-primary btn-sm">
            Review Center →
          </Link>
        }
      />

      {/* ── Top-line metrics ── */}
      <div className="section">
        <div className="metric-grid">
          <MetricCard
            label="Open PRs"
            value={totalOpenPRs}
            sub="across all projects"
            accent="blue"
            href="/review"
          />
          <MetricCard
            label="Action Required"
            value={blockedPRs.length}
            sub="blocked PRs"
            accent={blockedPRs.length > 0 ? 'red' : 'green'}
            href="/review?triage=blocked"
          />
          <MetricCard
            label="Needs Review"
            value={reviewNeededPRs.length}
            sub="high/critical priority"
            accent={reviewNeededPRs.length > 0 ? 'amber' : 'green'}
            href="/review?triage=needs_review"
          />
          <MetricCard
            label="Failed CI"
            value={failedCIPRs.length}
            sub="across all projects"
            accent={failedCIPRs.length > 0 ? 'red' : 'green'}
            href="/review"
          />
          <MetricCard
            label="Active Incidents"
            value={totalIncidents}
            sub="open or investigating"
            accent={totalIncidents > 0 ? 'red' : 'slate'}
            href="/incidents"
          />
          <MetricCard
            label="Projects"
            value={totalProjects}
            accent="indigo"
            href="/projects"
          />
          <MetricCard
            label="Open Tasks"
            value={totalTasks}
            sub="not done"
            accent="purple"
            href="/tasks"
          />
        </div>
      </div>

      {/* ── Section 1: Action Required ── */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">Action Required</span>
          {blockedPRs.length > 0 && (
            <span className="section-header-count">{blockedPRs.length}</span>
          )}
          <Link href="/review?triage=blocked" className="section-header-link">
            View all →
          </Link>
        </div>

        {blockedPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No blocked PRs — all clear.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blockedPRs.slice(0, 8).map(({ pr, intel }) => {
              const pmeta = PRIORITY_META[intel.priority];
              return (
                <div key={pr.id} className="feed-card" style={{ borderLeft: '3px solid var(--red)', paddingLeft: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="status-dot status-dot--failed" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: pmeta.color, minWidth: 48 }}>
                      {pmeta.label}
                    </span>
                    <Link
                      href={`/projects/${pr.projectId}/prs/${pr.id}`}
                      style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)', minWidth: 40 }}
                    >
                      #{pr.prNumber}
                    </Link>
                    <Link
                      href={`/projects/${pr.projectId}/prs/${pr.id}`}
                      style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}
                    >
                      {pr.title.length > 72 ? pr.title.slice(0, 72) + '…' : pr.title}
                    </Link>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {pr.project.name}
                    </span>
                    <CiBadge status={pr.ciStatus} />
                  </div>
                  {/* All signals with evidence */}
                  {intel.signals.slice(0, 3).map((sig) => (
                    <div key={sig.key} style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 24, marginBottom: 2, display: 'flex', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: sig.severity === 'critical' ? 'var(--red)' : sig.severity === 'high' ? 'var(--amber)' : 'var(--blue)', minWidth: 42, textTransform: 'uppercase', fontSize: 10 }}>
                        {sig.severity}
                      </span>
                      <span style={{ fontWeight: 600, minWidth: 100 }}>{sig.label}</span>
                      <span style={{ flex: 1 }}>{sig.evidence}</span>
                    </div>
                  ))}
                  {/* All blockers */}
                  {intel.mergeReadiness.blockers.map((b, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--red)', paddingLeft: 24, marginTop: 3, display: 'flex', gap: 6 }}>
                      <span>⛔</span><span>{b}</span>
                    </div>
                  ))}
                  {/* Required decision + next action */}
                  <div style={{ marginTop: 6, paddingLeft: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{intel.requiredDecision}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>→ {intel.nextAction}</span>
                  </div>
                </div>
              );
            })}
            {blockedPRs.length > 8 && (
              <Link href="/review?triage=blocked" style={{ fontSize: 12, color: 'var(--blue)' }}>
                +{blockedPRs.length - 8} more blocked PRs →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Review Needed ── */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">Review Needed</span>
          {reviewNeededPRs.length > 0 && (
            <span className="section-header-count">{reviewNeededPRs.length}</span>
          )}
          <Link href="/review?triage=needs_review" className="section-header-link">
            View all →
          </Link>
        </div>

        {reviewNeededPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No high-priority PRs waiting for review.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviewNeededPRs.slice(0, 6).map(({ pr, intel }) => {
              const pmeta = PRIORITY_META[intel.priority];
              const tmeta = TRIAGE_META[intel.triage];
              return (
                <div key={pr.id} className="feed-card" style={{ borderLeft: '3px solid var(--amber)', paddingLeft: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="status-dot status-dot--pending" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: pmeta.color, minWidth: 48 }}>
                      {pmeta.label}
                    </span>
                    <Link
                      href={`/projects/${pr.projectId}/prs/${pr.id}`}
                      style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)', minWidth: 40 }}
                    >
                      #{pr.prNumber}
                    </Link>
                    <Link
                      href={`/projects/${pr.projectId}/prs/${pr.id}`}
                      style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}
                    >
                      {pr.title.length > 72 ? pr.title.slice(0, 72) + '…' : pr.title}
                    </Link>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {pr.project.name}
                    </span>
                    <span className={`badge ${tmeta.badge}`} style={{ fontSize: 10 }}>
                      {tmeta.label}
                    </span>
                  </div>
                  {intel.signals.slice(0, 2).map((sig) => (
                    <div key={sig.key} style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 24, marginBottom: 2, display: 'flex', gap: 6 }}>
                      <span style={{ fontWeight: 700, color: sig.severity === 'critical' ? 'var(--red)' : sig.severity === 'high' ? 'var(--amber)' : 'var(--blue)', minWidth: 42, textTransform: 'uppercase', fontSize: 10 }}>
                        {sig.severity}
                      </span>
                      <span style={{ fontWeight: 600, minWidth: 100 }}>{sig.label}</span>
                      <span style={{ flex: 1 }}>{sig.evidence}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 6, paddingLeft: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{intel.requiredDecision}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>→ {intel.nextAction}</span>
                  </div>
                </div>
              );
            })}
            {reviewNeededPRs.length > 6 && (
              <Link href="/review?triage=needs_review" style={{ fontSize: 12, color: 'var(--blue)' }}>
                +{reviewNeededPRs.length - 6} more PRs need review →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Section 3: Failed CI ── */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">Failed CI</span>
          {failedCIPRs.length > 0 && (
            <span className="section-header-count">{failedCIPRs.length}</span>
          )}
          <Link href="/ci" className="section-header-link">
            CI Dashboard →
          </Link>
        </div>

        {failedCIPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No CI failures on open PRs.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>CI</th>
                </tr>
              </thead>
              <tbody>
                {failedCIPRs.slice(0, 10).map(({ pr, intel }) => {
                  const pmeta = PRIORITY_META[intel.priority];
                  return (
                    <tr key={pr.id}>
                      <td>
                        <Link
                          href={`/projects/${pr.projectId}/prs/${pr.id}`}
                          style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                        >
                          #{pr.prNumber}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)' }}>
                          {pr.title.length > 60 ? pr.title.slice(0, 60) + '…' : pr.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Link href={`/projects/${pr.projectId}/prs`} style={{ color: 'var(--text-secondary)' }}>
                          {pr.project.name}
                        </Link>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pmeta.color }}>{pmeta.label}</span>
                      </td>
                      <td>
                        <span className="badge badge-sev-high">failure</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {failedCIPRs.length > 10 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                +{failedCIPRs.length - 10} more with CI failures
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4: At-Risk PRs ── */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">At-Risk</span>
          {atRiskPRs.length > 0 && (
            <span className="section-header-count">{atRiskPRs.length}</span>
          )}
          <Link href="/review" className="section-header-link">
            View all PRs →
          </Link>
        </div>

        {atRiskPRs.length === 0 ? (
          <div className="feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="status-dot status-dot--success" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No high or critical importance PRs open.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>PR</th>
                  <th>Title / Signal</th>
                  <th>Project</th>
                  <th>Triage</th>
                  <th>CI</th>
                </tr>
              </thead>
              <tbody>
                {atRiskPRs.slice(0, 10).map(({ pr, intel }) => {
                  const pmeta = PRIORITY_META[intel.priority];
                  const tmeta = TRIAGE_META[intel.triage];
                  const topSignal = intel.signals[0];
                  return (
                    <tr key={pr.id}>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pmeta.color }}>
                          {pmeta.label}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/projects/${pr.projectId}/prs/${pr.id}`}
                          style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                        >
                          #{pr.prNumber}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ fontSize: 13, color: 'var(--text)' }}>
                          {pr.title.length > 56 ? pr.title.slice(0, 56) + '…' : pr.title}
                        </Link>
                        {topSignal && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            ⚑ {topSignal.label}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Link href={`/projects/${pr.projectId}/prs`} style={{ color: 'var(--text-secondary)' }}>
                          {pr.project.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${tmeta.badge}`}>{tmeta.label}</span>
                      </td>
                      <td>
                        <CiBadge status={pr.ciStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {atRiskPRs.length > 10 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                +{atRiskPRs.length - 10} more at-risk PRs
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Repo Health ── */}
      {repoHealth.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-header-title">Repo Health</span>
            <Link href="/projects" className="section-header-link">All projects →</Link>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Open PRs</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Blocked</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Needs Review</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Failed CI</th>
                  <th style={{ width: 80 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {repoHealth.map(({ project, total, blocked, needsReview, failedCI }) => {
                  const repoLabel = project.repoOwner && project.repoName
                    ? `${project.repoOwner}/${project.repoName}`
                    : project.name;
                  const isClean = blocked === 0 && failedCI === 0;
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link
                          href={`/projects/${project.id}/prs`}
                          style={{ fontSize: 13, color: 'var(--blue)', fontFamily: 'monospace' }}
                        >
                          {repoLabel}
                        </Link>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{total}</td>
                      <td style={{ textAlign: 'right' }}>
                        {blocked > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>{blocked}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {needsReview > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--amber)', fontSize: 13 }}>{needsReview}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {failedCI > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13 }}>{failedCI}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>0</span>
                        )}
                      </td>
                      <td>
                        {isClean ? (
                          <span className="badge badge-success" style={{ fontSize: 10 }}>Healthy</span>
                        ) : blocked > 0 ? (
                          <span className="badge badge-sev-high" style={{ fontSize: 10 }}>Blocked</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>At Risk</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 5: Recent Activity ── */}
      <div className="section">
        <div className="section-header">
          <span className="section-header-title">Recent Activity</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last 5 merged PRs</span>
        </div>

        {recentMergedPRs.length === 0 ? (
          <div className="feed-card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No merged PRs yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentMergedPRs.map((pr) => (
              <div key={pr.id} className="feed-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="status-dot status-dot--success" />
                  <Link
                    href={`/projects/${pr.projectId}/prs/${pr.id}`}
                    style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)', minWidth: 40 }}
                  >
                    #{pr.prNumber}
                  </Link>
                  <Link
                    href={`/projects/${pr.projectId}/prs/${pr.id}`}
                    style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}
                  >
                    {pr.title.length > 72 ? pr.title.slice(0, 72) + '…' : pr.title}
                  </Link>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {pr.project.name}
                  </span>
                  <span className="badge badge-success" style={{ fontSize: 10 }}>merged</span>
                  {pr.githubMergedAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {pr.githubMergedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active Incidents ── */}
      {recentIncidents.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-header-title">Active Incidents</span>
            <span className="section-header-count">{recentIncidents.length}</span>
            <Link href="/incidents" className="section-header-link">View all →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentIncidents.map((incident) => (
              <div key={incident.id} className="feed-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="status-dot status-dot--failed" />
                  <SeverityBadge severity={incident.severity} />
                  <Link
                    href={`/incidents/${incident.id}`}
                    style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}
                  >
                    {incident.title.length > 80 ? incident.title.slice(0, 80) + '…' : incident.title}
                  </Link>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>
                    {incident.status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {incident.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
