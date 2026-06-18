import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  extractBugs,
  linkBugs,
  computeBugSummary,
  sortBugs,
  type BugRecord,
  type BugState,
} from '@/lib/bugIntelligence';
import type { TimelinePR } from '@/lib/buildTimeline';

export const dynamic = 'force-dynamic';

const BUG_STATE_CONFIG: Record<BugState, { label: string; color: string; bg: string }> = {
  known_issue:     { label: 'Open', color: 'var(--red)', bg: 'color-mix(in srgb, var(--red) 12%, transparent)' },
  fixed:           { label: 'Fixed', color: 'var(--green)', bg: 'color-mix(in srgb, var(--green) 12%, transparent)' },
  regression_risk: { label: 'Regression risk', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 15%, transparent)' },
  needs_retest:    { label: 'Needs retest', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
};

const VALID_STATES: BugState[] = ['known_issue', 'regression_risk', 'needs_retest', 'fixed'];

interface PageProps {
  params: { id: string };
  searchParams: { bugState?: string; area?: string };
}

export default async function BugIntelligencePage({ params, searchParams }: PageProps) {
  const stateFilter = VALID_STATES.includes(searchParams.bugState as BugState)
    ? (searchParams.bugState as BugState)
    : null;
  const areaFilter = searchParams.area ?? null;

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

  // Load bug-relevant PRs
  const rawBugPRs = await prisma.githubPR.findMany({
    where: {
      projectId: params.id,
      OR: [
        { classification: 'bug_fix' },
        { classification: 'incident' },
        { bugState: { not: null } },
      ],
    },
    orderBy: [{ githubMergedAt: 'desc' }, { githubCreatedAt: 'desc' }],
    select: {
      id: true, prNumber: true, title: true, author: true, prUrl: true,
      state: true, merged: true, ciStatus: true, classification: true,
      bugState: true, labels: true, filesChangedCount: true,
      githubMergedAt: true, githubCreatedAt: true, milestoneId: true,
    },
  });

  // Load all PRs for link resolution
  const allRawPRs = await prisma.githubPR.findMany({
    where: { projectId: params.id },
    select: {
      id: true, prNumber: true, title: true, author: true, prUrl: true,
      state: true, merged: true, ciStatus: true, classification: true,
      bugState: true, labels: true, filesChangedCount: true,
      githubMergedAt: true, githubCreatedAt: true, milestoneId: true,
    },
  });

  const toPR = (pr: typeof rawBugPRs[0]): TimelinePR => ({
    ...pr,
    classification: (pr.classification as TimelinePR['classification']) ?? 'unclassified',
    milestoneTitle: null,
  });

  const bugPRs = rawBugPRs.map(toPR);
  const allPRs = allRawPRs.map(toPR);

  let bugs = extractBugs(bugPRs);
  bugs = linkBugs(bugs, allPRs);
  bugs = sortBugs(bugs);

  const summary = computeBugSummary(bugs);

  // Apply filters
  let filtered = bugs;
  if (stateFilter) filtered = filtered.filter((b) => b.bugState === stateFilter);
  if (areaFilter) filtered = filtered.filter((b) => b.riskArea === areaFilter);

  const allPRsById = new Map(allPRs.map((p) => [p.id, p]));

  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (stateFilter) p.set('bugState', stateFilter);
    if (areaFilter) p.set('area', areaFilter);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k); else p.set(k, v);
    }
    const qs = p.toString();
    return `/projects/${params.id}/bugs${qs ? `?${qs}` : ''}`;
  }

  const topAreas = Object.entries(summary.byArea)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader
        title="Bug Intelligence"
        subtitle={<span style={{ color: 'var(--text-muted)' }}>{project.name}</span>}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/projects/${params.id}/timeline`} className="btn btn-secondary btn-sm">
              Timeline
            </Link>
            <Link href={`/projects/${params.id}/prs`} className="btn btn-secondary btn-sm">
              PR List
            </Link>
          </div>
        }
      />

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total bugs', value: summary.total, color: 'var(--text)' },
          { label: 'Open', value: summary.open, color: summary.open > 0 ? 'var(--red)' : 'var(--text-muted)' },
          { label: 'Regression risk', value: summary.regressionRisk, color: summary.regressionRisk > 0 ? 'var(--amber)' : 'var(--text-muted)' },
          { label: 'Fixed', value: summary.fixed, color: 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 14px',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Risk areas ────────────────────────────────────────────────── */}
      {topAreas.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Risk areas:</span>
          {topAreas.map(([area, count]) => (
            <Link
              key={area}
              href={filterUrl({ area: area === areaFilter ? '' : area })}
              style={{
                fontSize: '0.72rem', padding: '3px 10px', borderRadius: 10,
                background: areaFilter === area ? 'var(--red)' : 'var(--surface-2)',
                color: areaFilter === area ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              {area} ({count})
            </Link>
          ))}
        </div>
      )}

      {/* ── State filter tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link
          href={filterUrl({ bugState: '' })}
          style={{
            fontSize: '0.78rem', padding: '5px 14px', borderRadius: 6,
            background: !stateFilter ? 'var(--blue)' : 'var(--surface)',
            color: !stateFilter ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
          }}
        >
          All ({summary.total})
        </Link>
        {VALID_STATES.map((s) => {
          const cfg = BUG_STATE_CONFIG[s];
          const count = bugs.filter((b) => b.bugState === s).length;
          return (
            <Link
              key={s}
              href={filterUrl({ bugState: s === stateFilter ? '' : s })}
              style={{
                fontSize: '0.78rem', padding: '5px 14px', borderRadius: 6,
                background: stateFilter === s ? cfg.color : 'var(--surface)',
                color: stateFilter === s ? '#fff' : 'var(--text)',
                border: `1px solid ${stateFilter === s ? cfg.color : 'var(--border)'}`,
                textDecoration: 'none',
              }}
            >
              {cfg.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* ── Bug list ──────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="empty-state" style={{ maxWidth: 420, marginTop: 32 }}>
          <div className="empty-state-icon">✓</div>
          <div className="empty-state-title">
            {stateFilter === 'known_issue' ? 'No open bugs' :
             stateFilter === 'regression_risk' ? 'No regression risks' :
             'No bugs found'}
          </div>
          <div className="empty-state-subtitle">
            {bugs.length === 0
              ? 'Import PRs from GitHub to detect bug-related changes.'
              : 'Try clearing the filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((bug) => {
            const cfg = BUG_STATE_CONFIG[bug.bugState];
            const causePR = bug.causedByPrId ? allPRsById.get(bug.causedByPrId) : null;
            const fixPR = bug.fixedByPrId ? allPRsById.get(bug.fixedByPrId) : null;

            return (
              <div
                key={bug.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  borderLeft: `4px solid ${cfg.color}`,
                  padding: '12px 14px',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: 2, flexShrink: 0 }}>
                    #{bug.prNumber}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bug.prUrl ? (
                        <a href={bug.prUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--text)', textDecoration: 'none' }}>
                          {bug.title}
                        </a>
                      ) : bug.title}
                    </div>

                    {/* Meta */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {bug.author && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{bug.author}</span>}
                      {bug.githubMergedAt && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          merged {new Date(bug.githubMergedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {bug.riskArea && (
                        <span style={{
                          fontSize: '0.68rem', padding: '1px 7px', borderRadius: 10,
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}>
                          {bug.riskArea}
                        </span>
                      )}
                      {bug.ciStatus && bug.ciStatus !== 'neutral' && (
                        <span style={{
                          fontSize: '0.68rem', padding: '1px 7px', borderRadius: 10,
                          color: bug.ciStatus === 'success' ? 'var(--green)' : bug.ciStatus === 'failure' ? 'var(--red)' : 'var(--amber)',
                          background: bug.ciStatus === 'success'
                            ? 'color-mix(in srgb, var(--green) 12%, transparent)'
                            : bug.ciStatus === 'failure'
                            ? 'color-mix(in srgb, var(--red) 12%, transparent)'
                            : 'color-mix(in srgb, var(--amber) 12%, transparent)',
                        }}>
                          CI {bug.ciStatus}
                        </span>
                      )}
                    </div>

                    {/* Linked PRs */}
                    {(causePR || fixPR) && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                        {causePR && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Caused by:{' '}
                            {causePR.prUrl ? (
                              <a href={causePR.prUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--blue)' }}>
                                #{causePR.prNumber}
                              </a>
                            ) : `#${causePR.prNumber}`}
                          </span>
                        )}
                        {fixPR && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Fixed by:{' '}
                            {fixPR.prUrl ? (
                              <a href={fixPR.prUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--green)' }}>
                                #{fixPR.prNumber}
                              </a>
                            ) : `#${fixPR.prNumber}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* State badge */}
                  <span style={{
                    fontSize: '0.7rem', padding: '3px 10px', borderRadius: 10,
                    background: cfg.bg, color: cfg.color,
                    border: `1px solid ${cfg.color}`,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {filtered.length} bug{filtered.length !== 1 ? 's' : ''} shown ·{' '}
          Use{' '}
          <Link href={`/projects/${params.id}/prs`} style={{ color: 'var(--blue)' }}>PR list</Link>
          {' '}to correct bug state classifications.
        </div>
      )}
    </div>
  );
}
