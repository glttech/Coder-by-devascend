import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildPRFilters, normaliseStateFilter, normaliseCIFilter } from '@/lib/prFilters';
import { computeCISummary } from '@/lib/projectHealth';
import {
  analyzePrImportance,
  summarizeTriage,
  compareByImportance,
  PRIORITY_META,
  TRIAGE_META,
} from '@/lib/prIntelligence';
import DiscoverPRsButton from '@/components/DiscoverPRsButton';
import FullSyncButton from '@/components/FullSyncButton';

export const dynamic = 'force-dynamic';

/** PRs open for longer than this without a refresh are considered stale. */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

interface PageProps {
  params: { id: string };
  searchParams: { state?: string; ci?: string; q?: string };
}

const CI_BADGE: Record<string, string> = {
  success: 'badge-success',
  failure: 'badge-sev-high',
  pending: 'badge-neutral',
  neutral: 'badge-neutral',
};

export default async function ProjectPRListPage({ params, searchParams }: PageProps) {
  const stateFilter = normaliseStateFilter(searchParams.state);
  const ciFilter = normaliseCIFilter(searchParams.ci);
  const q = searchParams.q?.trim() ?? '';

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, repoOwner: true, repoName: true, _count: { select: { githubPRs: true } } },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
      </div>
    );
  }

  const where = {
    projectId: params.id,
    ...buildPRFilters({ state: stateFilter, ci: ciFilter, q }),
  };

  const prsRaw = await prisma.githubPR.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, prNumber: true, title: true, body: true,
      state: true, merged: true, mergeSha: true,
      ciStatus: true, importedAt: true, updatedAt: true,
      labels: true, filesChanged: true, filesChangedCount: true, classification: true,
    },
  });

  // Compute PR intelligence for each PR, then sort the most important to the top.
  const prs = prsRaw
    .map((pr) => ({ pr, intel: analyzePrImportance(pr) }))
    .sort((a, b) => compareByImportance(a.intel, b.intel));

  const triageSummary = summarizeTriage(prs.map((p) => p.intel));
  const totalCount = project._count.githubPRs;
  const ciSummary = computeCISummary(prsRaw);
  const repoUrl = project.repoOwner && project.repoName
    ? `https://github.com/${project.repoOwner}/${project.repoName}`
    : null;

  const activeFilters = stateFilter !== 'all' || ciFilter !== 'all' || q;
  const filterUrl = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (stateFilter !== 'all') p.set('state', stateFilter);
    if (ciFilter !== 'all') p.set('ci', ciFilter);
    if (q) p.set('q', q);
    for (const [k, v] of Object.entries(extra)) {
      if (v === '') p.delete(k); else p.set(k, v);
    }
    const s = p.toString();
    return `/projects/${params.id}/prs${s ? '?' + s : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="Pull Request History"
        subtitle={
          <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← {project.name}
          </Link>
        }
        badge={
          <span className="badge badge-neutral">{prs.length}{activeFilters ? ` / ${totalCount}` : ''} PRs</span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/projects/${params.id}/governance-timeline`} className="btn btn-ghost btn-sm">
              Governance Timeline
            </Link>
            {repoUrl && (
              <>
                <DiscoverPRsButton projectId={params.id} />
                <FullSyncButton projectId={params.id} />
                <Link href={`/projects/${params.id}/prs/import`} className="btn btn-primary btn-sm">
                  + Import PR
                </Link>
              </>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="section" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* State filter */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>State</span>
            {(['all', 'open', 'merged', 'closed'] as const).map((s) => (
              <Link
                key={s}
                href={filterUrl({ state: s === 'all' ? '' : s })}
                className={`badge ${stateFilter === s || (s === 'all' && stateFilter === 'all') ? 'badge-active' : 'badge-neutral'}`}
                style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
              >
                {s}
              </Link>
            ))}
          </div>

          <span style={{ color: 'var(--border)', fontSize: 16 }}>|</span>

          {/* CI filter */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CI</span>
            {(['all', 'success', 'failure', 'pending', 'unknown'] as const).map((c) => (
              <Link
                key={c}
                href={filterUrl({ ci: c === 'all' ? '' : c })}
                className={`badge ${ciFilter === c ? 'badge-active' : c === 'failure' ? 'badge-neutral' : 'badge-neutral'}`}
                style={{ cursor: 'pointer', textDecoration: 'none', fontSize: 11 }}
              >
                {c}
              </Link>
            ))}
          </div>

          {activeFilters && (
            <Link href={`/projects/${params.id}/prs`} style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              Clear filters ✕
            </Link>
          )}
        </div>

        {/* Search */}
        <form method="GET" action={`/projects/${params.id}/prs`} style={{ marginTop: 10, display: 'flex', gap: 8, maxWidth: 420 }}>
          {stateFilter !== 'all' && <input type="hidden" name="state" value={stateFilter} />}
          {ciFilter !== 'all' && <input type="hidden" name="ci" value={ciFilter} />}
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search PR titles…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button type="submit" className="btn btn-ghost btn-sm">Search</button>
          {q && (
            <Link href={filterUrl({ q: '' })} className="btn btn-ghost btn-sm">Clear</Link>
          )}
        </form>
      </div>

      {/* CI Summary Bar — shown when there are non-success statuses in the current view */}
      {prs.length > 0 && (ciSummary.failed > 0 || ciSummary.pending > 0 || ciSummary.unknown > 0) && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>CI</span>
            {ciSummary.failed > 0 && (
              <Link href={filterUrl({ ci: 'failure' })} className="badge badge-sev-high" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                {ciSummary.failed} failed
              </Link>
            )}
            {ciSummary.pending > 0 && (
              <Link href={filterUrl({ ci: 'pending' })} className="badge badge-warning" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                {ciSummary.pending} pending
              </Link>
            )}
            {ciSummary.unknown > 0 && (
              <Link href={filterUrl({ ci: 'unknown' })} className="badge badge-neutral" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                {ciSummary.unknown} unknown
              </Link>
            )}
            {ciSummary.success > 0 && (
              <span className="badge badge-success" style={{ opacity: 0.7 }}>{ciSummary.success} passed</span>
            )}
          </div>
        </div>
      )}

      {/* Triage Summary — Safe / Needs Review / Blocked */}
      {prs.length > 0 && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
              Triage
            </span>
            <span className="badge badge-sev-high" title="CI failing or env/secrets change — cannot safely merge">
              {triageSummary.blocked} blocked
            </span>
            <span className="badge badge-warning" title="High-importance change that needs a human review">
              {triageSummary.needsReview} needs review
            </span>
            <span className="badge badge-success" style={{ opacity: 0.8 }} title="No important risk signals and CI not failing">
              {triageSummary.safe} safe
            </span>
          </div>
        </div>
      )}

      {/* PR Table */}
      <div className="section">
        {prs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>
            {activeFilters
              ? 'No PRs match the current filters.'
              : 'No pull requests imported yet. Use "+ Import PR" to add a GitHub pull request.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>PR</th>
                  <th>Title</th>
                  <th>Triage</th>
                  <th>State</th>
                  <th>CI</th>
                  <th>Last refreshed</th>
                </tr>
              </thead>
              <tbody>
                {prs.map(({ pr, intel }) => {
                  const lastRefreshed = pr.updatedAt > pr.importedAt ? pr.updatedAt : pr.importedAt;
                  const isStale =
                    pr.state === 'open' &&
                    Date.now() - lastRefreshed.getTime() > STALE_THRESHOLD_MS;
                  const pmeta = PRIORITY_META[intel.priority];
                  const tmeta = TRIAGE_META[intel.triage];
                  const topSignal = intel.signals[0];
                  return (
                    <tr key={pr.id}>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pmeta.color }} title={`Importance score ${intel.importanceScore}/100`}>
                          {pmeta.label}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/projects/${params.id}/prs/${pr.id}`}
                          style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                        >
                          #{pr.prNumber}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Link
                            href={`/projects/${params.id}/prs/${pr.id}`}
                            style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}
                          >
                            {pr.title.length > 64 ? pr.title.slice(0, 64) + '…' : pr.title}
                          </Link>
                          {isStale && (
                            <span
                              className="badge badge-warning"
                              style={{ fontSize: 10, whiteSpace: 'nowrap' }}
                              title="This open PR has not been refreshed in over 2 hours"
                            >
                              ⚠ Stale
                            </span>
                          )}
                        </div>
                        {topSignal && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }} title={topSignal.evidence}>
                            ⚑ {topSignal.label}
                            {intel.signals.length > 1 ? ` +${intel.signals.length - 1} more` : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${tmeta.badge}`}>{tmeta.label}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'}`}>
                          {pr.merged ? 'merged' : pr.state}
                        </span>
                      </td>
                      <td>
                        {pr.ciStatus ? (
                          <span className={`badge ${CI_BADGE[pr.ciStatus] ?? 'badge-neutral'}`}>{pr.ciStatus}</span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {lastRefreshed.toLocaleDateString()}
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
