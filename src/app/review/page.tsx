import prisma from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import {
  analyzePrImportance,
  summarizeTriage,
  compareByImportance,
  PRIORITY_META,
  TRIAGE_META,
} from '@/lib/prIntelligence';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { triage?: string };
}

const CI_BADGE: Record<string, string> = {
  success: 'badge-success',
  failure: 'badge-sev-high',
  pending: 'badge-warning',
  neutral: 'badge-neutral',
};

type TriageFilter = 'all' | 'blocked' | 'needs_review' | 'safe';

function normaliseTriageFilter(raw?: string): TriageFilter {
  if (raw === 'blocked' || raw === 'needs_review' || raw === 'safe') return raw;
  return 'all';
}

export default async function ReviewCenterPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'any');
  if (!authResult.ok) redirect('/login');

  const triageFilter = normaliseTriageFilter(searchParams.triage);

  // Load all projects (for linking back to project PR pages)
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, repoOwner: true, repoName: true },
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Load all open PRs across all projects
  const openPRs = await prisma.githubPR.findMany({
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
    },
  });

  // Run intelligence on every PR, then sort most-important first
  const analysed = openPRs
    .map((pr) => ({ pr, intel: analyzePrImportance(pr) }))
    .sort((a, b) => compareByImportance(a.intel, b.intel));

  const triageCounts = summarizeTriage(analysed.map((t) => t.intel));

  // Apply triage filter
  const filtered =
    triageFilter === 'all'
      ? analysed
      : analysed.filter((item) => {
          if (triageFilter === 'blocked') return item.intel.triage === 'blocked';
          if (triageFilter === 'needs_review') return item.intel.triage === 'needs_review';
          if (triageFilter === 'safe') return item.intel.triage === 'safe';
          return true;
        });

  const hasProjects = projects.length > 0;

  function filterHref(t: TriageFilter) {
    if (t === 'all') return '/review';
    return `/review?triage=${t}`;
  }

  return (
    <div>
      <PageHeader
        title="Review Center"
        subtitle="Cross-repo review queue — all open PRs ranked by importance"
        badge={
          <span className="badge badge-neutral">{filtered.length} PR{filtered.length !== 1 ? 's' : ''}</span>
        }
      />

      {/* Triage metric cards */}
      <div className="section">
        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 560 }}>
          <MetricCard
            label="Blocked"
            value={triageCounts.blocked}
            sub="CI failing or env change"
            accent="red"
            href="/review?triage=blocked"
          />
          <MetricCard
            label="Needs Review"
            value={triageCounts.needsReview}
            sub="High-importance, needs human"
            accent="amber"
            href="/review?triage=needs_review"
          />
          <MetricCard
            label="Safe"
            value={triageCounts.safe}
            sub="No critical signals"
            accent="green"
            href="/review?triage=safe"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            Filter
          </span>
          {(['all', 'blocked', 'needs_review', 'safe'] as const).map((t) => {
            const isActive = triageFilter === t;
            const label = t === 'needs_review' ? 'Needs Review' : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <Link
                key={t}
                href={filterHref(t)}
                className={`badge ${isActive ? 'badge-active' : 'badge-neutral'}`}
                style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
              >
                {label}
              </Link>
            );
          })}
          {triageFilter !== 'all' && (
            <Link href="/review" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              Clear ✕
            </Link>
          )}
        </div>
      </div>

      {/* PR Table */}
      <div className="section">
        {!hasProjects ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Import a GitHub repository to start tracking pull requests.
            </p>
            <Link href="/projects/new" className="btn btn-primary">
              Import a project
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            {openPRs.length === 0 ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No open pull requests</div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  Import PRs from a project page to start tracking them here.
                </p>
                <Link href="/projects" className="btn btn-primary">
                  Go to Projects
                </Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 12 }}>◉</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No PRs match this filter</div>
                <Link href="/review" style={{ fontSize: 13, color: 'var(--blue)' }}>
                  Clear filter to see all {openPRs.length} open PRs →
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Priority</th>
                  <th style={{ width: 60 }}>PR</th>
                  <th>Repo</th>
                  <th>Title / Top Signal</th>
                  <th style={{ width: 100 }}>Triage</th>
                  <th style={{ width: 70 }}>CI</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ pr, intel }) => {
                  const project = projectMap.get(pr.projectId);
                  const pmeta = PRIORITY_META[intel.priority];
                  const tmeta = TRIAGE_META[intel.triage];
                  const topSignal = intel.signals[0];
                  const repoLabel = project
                    ? project.repoOwner && project.repoName
                      ? `${project.repoOwner}/${project.repoName}`
                      : project.name
                    : '—';

                  return (
                    <tr key={pr.id}>
                      {/* Priority */}
                      <td>
                        <span
                          style={{ fontSize: 11, fontWeight: 700, color: pmeta.color }}
                          title={`Importance score ${intel.importanceScore}/100`}
                        >
                          {pmeta.label}
                        </span>
                      </td>

                      {/* PR number */}
                      <td>
                        <Link
                          href={`/projects/${pr.projectId}/prs/${pr.id}`}
                          style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                        >
                          #{pr.prNumber}
                        </Link>
                      </td>

                      {/* Repo */}
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {project ? (
                          <Link
                            href={`/projects/${project.id}/prs`}
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                            title={repoLabel}
                          >
                            {repoLabel.length > 28 ? repoLabel.slice(0, 28) + '…' : repoLabel}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Title + top signal */}
                      <td style={{ maxWidth: 320 }}>
                        <Link
                          href={`/projects/${pr.projectId}/prs/${pr.id}`}
                          style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}
                        >
                          {pr.title.length > 72 ? pr.title.slice(0, 72) + '…' : pr.title}
                        </Link>
                        {topSignal && (
                          <div
                            style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}
                            title={topSignal.evidence}
                          >
                            ⚑ {topSignal.label}
                            {intel.signals.length > 1 ? ` +${intel.signals.length - 1}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Triage */}
                      <td>
                        <span className={`badge ${tmeta.badge}`}>{tmeta.label}</span>
                      </td>

                      {/* CI */}
                      <td>
                        {pr.ciStatus ? (
                          <span className={`badge ${CI_BADGE[pr.ciStatus] ?? 'badge-neutral'}`}>
                            {pr.ciStatus}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link
                            href={`/projects/${pr.projectId}/prs/${pr.id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            Detail
                          </Link>
                          {pr.prUrl && (
                            <a
                              href={pr.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                              GitHub ↗
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
