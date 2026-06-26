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
  type SignalCategory,
} from '@/lib/prIntelligence';
import { evaluatePrPolicy, VERDICT_META, APPROVER_LABEL, type PrPolicyResult } from '@/lib/prPolicyEngine';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { triage?: string; repo?: string; category?: string };
}

type TriageFilter = 'all' | 'blocked' | 'needs_review' | 'safe';

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  migration: 'Migration',
  auth_security: 'Auth / Security',
  env_secrets: 'Env / Secrets',
  infra_deploy: 'Infra / Deploy',
  api_contract: 'API Contract',
  billing: 'Billing',
  rbac_permission: 'RBAC',
  dependency: 'Dependencies',
  test_change: 'Tests',
  large_diff: 'Large Diff',
  ci: 'CI',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--amber)',
  medium: 'var(--blue)',
  low: 'var(--text-muted)',
};

const CI_BADGE: Record<string, string> = {
  success: 'badge-success',
  failure: 'badge-sev-high',
  pending: 'badge-warning',
  neutral: 'badge-neutral',
};

function normaliseTriageFilter(raw?: string): TriageFilter {
  if (raw === 'blocked' || raw === 'needs_review' || raw === 'safe') return raw;
  return 'all';
}

function filterHref(triage: TriageFilter, repo?: string, category?: string) {
  const params = new URLSearchParams();
  if (triage !== 'all') params.set('triage', triage);
  if (repo) params.set('repo', repo);
  if (category) params.set('category', category);
  const qs = params.toString();
  return `/review${qs ? `?${qs}` : ''}`;
}

export default async function ReviewCenterPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'any');
  if (!authResult.ok) redirect('/login');

  const triageFilter = normaliseTriageFilter(searchParams.triage);
  const repoFilter = searchParams.repo ?? '';
  const categoryFilter = (searchParams.category ?? '') as SignalCategory | '';

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, repoOwner: true, repoName: true },
    orderBy: { name: 'asc' },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

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

  const analysed = openPRs
    .map((pr) => {
      const intel = analyzePrImportance(pr);
      const policy = evaluatePrPolicy({ ...pr, _intel: intel });
      return { pr, intel, policy };
    })
    .sort((a, b) => compareByImportance(a.intel, b.intel));

  const triageCounts = summarizeTriage(analysed.map((t) => t.intel));

  // Apply filters
  const filtered = analysed.filter((item) => {
    if (triageFilter === 'blocked' && item.intel.triage !== 'blocked') return false;
    if (triageFilter === 'needs_review' && item.intel.triage !== 'needs_review') return false;
    if (triageFilter === 'safe' && item.intel.triage !== 'safe') return false;
    if (repoFilter && item.pr.projectId !== repoFilter) return false;
    if (categoryFilter && !item.intel.signals.some((s) => s.category === categoryFilter)) return false;
    return true;
  });

  // Collect active categories for the filter chips (from analysed, not filtered)
  const activeCategories = new Set<SignalCategory>();
  for (const { intel } of analysed) {
    for (const sig of intel.signals) activeCategories.add(sig.category);
  }

  const hasProjects = projects.length > 0;
  const hasFilters = triageFilter !== 'all' || !!repoFilter || !!categoryFilter;

  // Group filtered items into lanes
  const blockedItems = filtered.filter((i) => i.intel.triage === 'blocked');
  const reviewItems = filtered.filter((i) => i.intel.triage === 'needs_review');
  const safeItems = filtered.filter((i) => i.intel.triage === 'safe');

  return (
    <div>
      <PageHeader
        title="Review Center"
        subtitle="Action-first queue — ranked by importance, with evidence"
        badge={
          <span className="badge badge-neutral">
            {filtered.length} PR{filtered.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {/* ── Triage summary cards ── */}
      <div className="section">
        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 560 }}>
          <MetricCard
            label="Blocked"
            value={triageCounts.blocked}
            sub="CI failing or needs approval"
            accent="red"
            href={filterHref('blocked', repoFilter, categoryFilter)}
          />
          <MetricCard
            label="Needs Review"
            value={triageCounts.needsReview}
            sub="High-importance, action needed"
            accent="amber"
            href={filterHref('needs_review', repoFilter, categoryFilter)}
          />
          <MetricCard
            label="Safe"
            value={triageCounts.safe}
            sub="No critical signals"
            accent="green"
            href={filterHref('safe', repoFilter, categoryFilter)}
          />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="section" style={{ paddingTop: 0, paddingBottom: 12 }}>
        {/* Triage filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 52 }}>
            Triage
          </span>
          {(['all', 'blocked', 'needs_review', 'safe'] as const).map((t) => {
            const isActive = triageFilter === t;
            const label = t === 'needs_review' ? 'Needs Review' : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <Link
                key={t}
                href={filterHref(t, repoFilter, categoryFilter)}
                className={`badge ${isActive ? 'badge-active' : 'badge-neutral'}`}
                style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Repo filter */}
        {projects.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 52 }}>
              Repo
            </span>
            <Link
              href={filterHref(triageFilter, '', categoryFilter)}
              className={`badge ${!repoFilter ? 'badge-active' : 'badge-neutral'}`}
              style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
            >
              All repos
            </Link>
            {projects.map((p) => {
              const label = p.repoOwner && p.repoName
                ? `${p.repoOwner}/${p.repoName}`
                : p.name;
              const isActive = repoFilter === p.id;
              return (
                <Link
                  key={p.id}
                  href={filterHref(triageFilter, p.id, categoryFilter)}
                  className={`badge ${isActive ? 'badge-active' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
                  title={label}
                >
                  {label.length > 28 ? label.slice(0, 28) + '…' : label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Risk-area (category) filter */}
        {activeCategories.size > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 52 }}>
              Risk
            </span>
            <Link
              href={filterHref(triageFilter, repoFilter, '')}
              className={`badge ${!categoryFilter ? 'badge-active' : 'badge-neutral'}`}
              style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
            >
              All
            </Link>
            {Array.from(activeCategories).map((cat) => {
              const isActive = categoryFilter === cat;
              return (
                <Link
                  key={cat}
                  href={filterHref(triageFilter, repoFilter, cat)}
                  className={`badge ${isActive ? 'badge-active' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
                >
                  {CATEGORY_LABELS[cat]}
                </Link>
              );
            })}
          </div>
        )}

        {hasFilters && (
          <Link href="/review" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'inline-block' }}>
            Clear all filters ✕
          </Link>
        )}
      </div>

      {/* ── Empty states ── */}
      {!hasProjects ? (
        <div className="section">
          <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Import a GitHub repository to start tracking pull requests.
            </p>
            <Link href="/projects/new" className="btn btn-primary">Import a project</Link>
          </div>
        </div>
      ) : openPRs.length === 0 ? (
        <div className="section">
          <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No open pull requests</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Import PRs from a project page to start tracking them here.
            </p>
            <Link href="/projects" className="btn btn-primary">Go to Projects</Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="section">
          <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◉</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No PRs match this filter</div>
            <Link href="/review" style={{ fontSize: 13, color: 'var(--blue)' }}>
              Clear filters to see all {openPRs.length} open PRs →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── Blocked lane ── */}
          {(triageFilter === 'all' || triageFilter === 'blocked') && blockedItems.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="section-header-title" style={{ color: 'var(--red)' }}>
                  ⛔ Blocked
                </span>
                <span className="section-header-count">{blockedItems.length}</span>
                <Link href={filterHref('blocked', repoFilter, categoryFilter)} className="section-header-link">
                  Filter to blocked →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {blockedItems.map(({ pr, intel, policy }) => {
                  const project = projectMap.get(pr.projectId);
                  const repoLabel = project?.repoOwner && project?.repoName
                    ? `${project.repoOwner}/${project.repoName}`
                    : project?.name ?? '—';
                  const pmeta = PRIORITY_META[intel.priority];
                  return (
                    <PrEvidenceCard
                      key={pr.id}
                      pr={pr}
                      intel={intel}
                      policy={policy}
                      repoLabel={repoLabel}
                      projectId={pr.projectId}
                      pmeta={pmeta}
                      dotClass="status-dot--failed"
                      borderAccent="var(--red)"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Needs Review lane ── */}
          {(triageFilter === 'all' || triageFilter === 'needs_review') && reviewItems.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="section-header-title" style={{ color: 'var(--amber)' }}>
                  ⚑ Needs Review
                </span>
                <span className="section-header-count">{reviewItems.length}</span>
                <Link href={filterHref('needs_review', repoFilter, categoryFilter)} className="section-header-link">
                  Filter to needs review →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reviewItems.map(({ pr, intel, policy }) => {
                  const project = projectMap.get(pr.projectId);
                  const repoLabel = project?.repoOwner && project?.repoName
                    ? `${project.repoOwner}/${project.repoName}`
                    : project?.name ?? '—';
                  const pmeta = PRIORITY_META[intel.priority];
                  return (
                    <PrEvidenceCard
                      key={pr.id}
                      pr={pr}
                      intel={intel}
                      policy={policy}
                      repoLabel={repoLabel}
                      projectId={pr.projectId}
                      pmeta={pmeta}
                      dotClass="status-dot--pending"
                      borderAccent="var(--amber)"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Safe lane (compact table) ── */}
          {(triageFilter === 'all' || triageFilter === 'safe') && safeItems.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="section-header-title" style={{ color: 'var(--green)' }}>
                  ✓ Safe
                </span>
                <span className="section-header-count">{safeItems.length}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Priority</th>
                      <th style={{ width: 56 }}>PR</th>
                      <th>Repo</th>
                      <th>Title</th>
                      <th style={{ width: 80 }}>CI</th>
                      <th style={{ width: 90 }}>Policy</th>
                      <th style={{ width: 160 }}>Next Action</th>
                      <th style={{ width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeItems.map(({ pr, intel, policy }) => {
                      const project = projectMap.get(pr.projectId);
                      const repoLabel = project?.repoOwner && project?.repoName
                        ? `${project.repoOwner}/${project.repoName}`
                        : project?.name ?? '—';
                      const pmeta = PRIORITY_META[intel.priority];
                      const vmeta = VERDICT_META[policy.verdict];
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
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project ? (
                              <Link href={`/projects/${project.id}/prs`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                {repoLabel.length > 24 ? repoLabel.slice(0, 24) + '…' : repoLabel}
                              </Link>
                            ) : '—'}
                          </td>
                          <td style={{ maxWidth: 300 }}>
                            <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} style={{ color: 'var(--text)', fontSize: 13 }}>
                              {pr.title.length > 64 ? pr.title.slice(0, 64) + '…' : pr.title}
                            </Link>
                          </td>
                          <td>
                            {pr.ciStatus ? (
                              <span className={`badge ${CI_BADGE[pr.ciStatus] ?? 'badge-neutral'}`}>
                                {pr.ciStatus}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, color: vmeta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {vmeta.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {intel.nextAction.length > 40
                              ? intel.nextAction.slice(0, 40) + '…'
                              : intel.nextAction}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Link href={`/projects/${pr.projectId}/prs/${pr.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}>
                                Detail
                              </Link>
                              {pr.prUrl && (
                                <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Evidence card component ───────────────────────────────────────────────────

interface PrEvidenceCardProps {
  pr: {
    id: string;
    projectId: string;
    prNumber: number;
    title: string;
    ciStatus: string | null;
    prUrl: string | null;
    filesChangedCount: number | null;
  };
  intel: ReturnType<typeof analyzePrImportance>;
  policy: PrPolicyResult;
  repoLabel: string;
  projectId: string;
  pmeta: { label: string; color: string };
  dotClass: string;
  borderAccent: string;
}

function PrEvidenceCard({
  pr,
  intel,
  policy,
  repoLabel,
  projectId,
  pmeta,
  dotClass,
  borderAccent,
}: PrEvidenceCardProps) {
  const vmeta = VERDICT_META[policy.verdict];
  return (
    <div
      className="feed-card"
      style={{ borderLeft: `3px solid ${borderAccent}`, paddingLeft: 16 }}
    >
      {/* ── Header row: dot / priority / PR# / title / repo / CI ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className={`status-dot ${dotClass}`} />
        <span style={{ fontSize: 11, fontWeight: 700, color: pmeta.color, minWidth: 48 }}>
          {pmeta.label}
        </span>
        <Link
          href={`/projects/${projectId}/prs/${pr.id}`}
          style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)', minWidth: 36 }}
        >
          #{pr.prNumber}
        </Link>
        <Link
          href={`/projects/${projectId}/prs/${pr.id}`}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}
        >
          {pr.title.length > 80 ? pr.title.slice(0, 80) + '…' : pr.title}
        </Link>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{repoLabel}</span>
        {pr.ciStatus && (
          <span className={`badge ${CI_BADGE[pr.ciStatus] ?? 'badge-neutral'}`} style={{ fontSize: 10 }}>
            {pr.ciStatus}
          </span>
        )}
        {pr.filesChangedCount != null && pr.filesChangedCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {pr.filesChangedCount} file{pr.filesChangedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Signal evidence list ── */}
      {intel.signals.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {intel.signals.map((sig) => (
            <div
              key={sig.key}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '5px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SEVERITY_COLOR[sig.severity] ?? 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  minWidth: 48,
                  paddingTop: 1,
                }}
              >
                {sig.severity}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 120 }}>
                {sig.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                {sig.evidence}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Blockers ── */}
      {intel.mergeReadiness.blockers.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {intel.mergeReadiness.blockers.map((b, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 3, display: 'flex', gap: 6 }}>
              <span>⛔</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Warnings ── */}
      {intel.mergeReadiness.warnings.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {intel.mergeReadiness.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 3, display: 'flex', gap: 6 }}>
              <span>⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Decision / Next action ── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          padding: '8px 10px',
          background: 'var(--surface-2)',
          borderRadius: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Required Decision
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {intel.requiredDecision}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Next Action
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {intel.nextAction}
          </div>
        </div>
      </div>

      {/* ── Policy verdict ── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          padding: '8px 10px',
          background: policy.verdict === 'blocked' ? 'rgba(239,68,68,0.06)' : policy.verdict === 'review_required' ? 'rgba(245,158,11,0.06)' : 'var(--surface-2)',
          border: `1px solid ${policy.verdict === 'blocked' ? 'rgba(239,68,68,0.2)' : policy.verdict === 'review_required' ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
          borderRadius: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 90 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Policy
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: vmeta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {vmeta.label}
          </div>
          {policy.requiredApprover !== 'none' && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Approver: {APPROVER_LABEL[policy.requiredApprover]}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Policy Reason
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {policy.founderExplanation}
          </div>
        </div>
        {policy.recommendedNextAction && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Recommended
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {policy.recommendedNextAction}
            </div>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href={`/projects/${projectId}/prs/${pr.id}`} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>
          View Detail →
        </Link>
        {pr.prUrl && (
          <a href={pr.prUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
            Open on GitHub ↗
          </a>
        )}
      </div>
    </div>
  );
}
