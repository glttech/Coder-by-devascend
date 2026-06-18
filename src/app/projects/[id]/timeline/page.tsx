import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  groupPRs,
  computeTimelineSummary,
  CLASSIFICATION_LABELS,
  type TimelinePR,
  type TimelineGrouping,
  type TimelineClassification,
} from '@/lib/buildTimeline';

export const dynamic = 'force-dynamic';

// ── Classification colours ────────────────────────────────────────────────────

const CLASS_COLOR: Record<TimelineClassification, string> = {
  feature:      'var(--blue)',
  bug_fix:      'var(--red)',
  security:     'var(--amber)',
  migration:    'var(--purple)',
  deployment:   'var(--green)',
  rollback:     'var(--orange, #f97316)',
  incident:     'var(--red)',
  chore:        'var(--text-muted)',
  test:         'var(--teal, #14b8a6)',
  docs:         'var(--text-muted)',
  unclassified: 'var(--text-muted)',
};

const CLASS_ICON: Record<TimelineClassification, string> = {
  feature:      '✦',
  bug_fix:      '⚑',
  security:     '⚠',
  migration:    '⬡',
  deployment:   '▶',
  rollback:     '↩',
  incident:     '🚨',
  chore:        '⚙',
  test:         '✓',
  docs:         '⊞',
  unclassified: '·',
};

const CI_COLOR: Record<string, string> = {
  success: 'var(--green)',
  failure: 'var(--red)',
  pending: 'var(--amber)',
  neutral: 'var(--text-muted)',
};

const BUG_STATE_BADGE: Record<string, { label: string; color: string }> = {
  known_issue:      { label: 'Open bug', color: 'var(--red)' },
  fixed:            { label: 'Fixed', color: 'var(--green)' },
  regression_risk:  { label: 'Regression risk', color: 'var(--amber)' },
  needs_retest:     { label: 'Needs retest', color: 'var(--amber)' },
};

const VALID_GROUPINGS: TimelineGrouping[] = ['week', 'day', 'milestone'];
const VALID_CLASSIFICATIONS: TimelineClassification[] = [
  'feature', 'bug_fix', 'security', 'migration', 'deployment',
  'rollback', 'incident', 'chore', 'test', 'docs',
];

interface PageProps {
  params: { id: string };
  searchParams: {
    grouping?: string;
    classification?: string;
    since?: string;
    until?: string;
  };
}

export default async function BuildTimelinePage({ params, searchParams }: PageProps) {
  const grouping: TimelineGrouping =
    VALID_GROUPINGS.includes(searchParams.grouping as TimelineGrouping)
      ? (searchParams.grouping as TimelineGrouping)
      : 'week';

  const classFilter = VALID_CLASSIFICATIONS.includes(searchParams.classification as TimelineClassification)
    ? (searchParams.classification as TimelineClassification)
    : null;

  const since = searchParams.since ? new Date(searchParams.since) : null;
  const until = searchParams.until ? new Date(searchParams.until) : null;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, repoOwner: true, repoName: true },
  });

  if (!project) {
    return (
      <div className="empty-state" style={{ maxWidth: 420 }}>
        <div className="empty-state-icon">✕</div>
        <div className="empty-state-title">Project not found</div>
      </div>
    );
  }

  // Load all milestones for the project (for milestone grouping labels)
  const milestones = await prisma.milestone.findMany({
    where: { projectId: params.id },
    select: { id: true, title: true },
  });
  const milestoneMap = new Map(milestones.map((m) => [m.id, m.title]));

  // Build Prisma where clause
  type PrismaDateFilter = { gte?: Date; lte?: Date };
  const dateFilter: PrismaDateFilter = {};
  if (since) dateFilter.gte = since;
  if (until) dateFilter.lte = until;
  const hasDates = Object.keys(dateFilter).length > 0;

  const where: Record<string, unknown> = { projectId: params.id };
  if (classFilter) where['classification'] = classFilter;
  if (hasDates) where['githubMergedAt'] = dateFilter;

  const rawPRs = await prisma.githubPR.findMany({
    where,
    orderBy: [{ githubMergedAt: 'desc' }, { githubCreatedAt: 'desc' }],
    select: {
      id: true,
      prNumber: true,
      title: true,
      author: true,
      prUrl: true,
      state: true,
      merged: true,
      ciStatus: true,
      classification: true,
      bugState: true,
      labels: true,
      filesChangedCount: true,
      githubMergedAt: true,
      githubCreatedAt: true,
      milestoneId: true,
    },
  });

  const prs: TimelinePR[] = rawPRs.map((pr) => ({
    ...pr,
    classification: (pr.classification as TimelineClassification) ?? 'unclassified',
    milestoneTitle: pr.milestoneId ? milestoneMap.get(pr.milestoneId) ?? null : null,
  }));

  const buckets = groupPRs(prs, grouping);
  const summary = computeTimelineSummary(prs);

  // Filter URL helper
  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (grouping !== 'week') p.set('grouping', grouping);
    if (classFilter) p.set('classification', classFilter);
    if (since) p.set('since', since.toISOString().slice(0, 10));
    if (until) p.set('until', until.toISOString().slice(0, 10));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k); else p.set(k, v);
    }
    const qs = p.toString();
    return `/projects/${params.id}/timeline${qs ? `?${qs}` : ''}`;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader
        title="Build Timeline"
        subtitle={
          <>
            <span style={{ color: 'var(--text-muted)' }}>{project.name}</span>
            {project.repoOwner && project.repoName && (
              <> · <a
                href={`https://github.com/${project.repoOwner}/${project.repoName}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--blue)', textDecoration: 'none', fontSize: '0.82rem' }}
              >
                {project.repoOwner}/{project.repoName}
              </a></>
            )}
          </>
        }
        actions={
          <Link href={`/projects/${params.id}/prs`} className="btn btn-secondary btn-sm">
            ← PR List
          </Link>
        }
      />

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'PRs indexed', value: summary.totalPRs, color: 'var(--text)' },
          { label: 'Features', value: summary.totalFeatures, color: 'var(--blue)' },
          { label: 'Bugs fixed', value: summary.totalBugsFixed, color: 'var(--green)' },
          { label: 'Security', value: summary.totalSecurity, color: 'var(--amber)' },
          { label: 'Migrations', value: summary.totalMigrations, color: 'var(--purple)' },
          { label: 'Incidents', value: summary.totalIncidents, color: 'var(--red)' },
          { label: 'Open bugs', value: summary.openBugs, color: summary.openBugs > 0 ? 'var(--red)' : 'var(--text-muted)' },
          { label: 'Regression risk', value: summary.regressionRisks, color: summary.regressionRisks > 0 ? 'var(--amber)' : 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24,
        padding: '12px 14px', background: 'var(--surface-2)',
        border: '1px solid var(--border)', borderRadius: 8,
      }}>
        {/* Grouping */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 4 }}>Group by</span>
          {(['week', 'day', 'milestone'] as TimelineGrouping[]).map((g) => (
            <Link
              key={g}
              href={filterUrl({ grouping: g === 'week' ? '' : g })}
              style={{
                fontSize: '0.75rem', padding: '3px 10px', borderRadius: 4,
                background: grouping === g ? 'var(--blue)' : 'var(--surface)',
                color: grouping === g ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Link>
          ))}
        </div>

        {/* Classification filter */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 4 }}>Type</span>
          <Link
            href={filterUrl({ classification: '' })}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 4,
              background: !classFilter ? 'var(--blue)' : 'var(--surface)',
              color: !classFilter ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
            }}
          >
            All
          </Link>
          {VALID_CLASSIFICATIONS.map((cls) => (
            <Link
              key={cls}
              href={filterUrl({ classification: cls === classFilter ? '' : cls })}
              style={{
                fontSize: '0.73rem', padding: '3px 8px', borderRadius: 4,
                background: classFilter === cls ? CLASS_COLOR[cls] : 'var(--surface)',
                color: classFilter === cls ? '#fff' : 'var(--text)',
                border: `1px solid ${classFilter === cls ? CLASS_COLOR[cls] : 'var(--border)'}`,
                textDecoration: 'none',
              }}
            >
              {CLASS_ICON[cls]} {cls.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Timeline buckets ───────────────────────────────────────────── */}
      {buckets.length === 0 ? (
        <div className="empty-state" style={{ maxWidth: 420, marginTop: 40 }}>
          <div className="empty-state-icon">◷</div>
          <div className="empty-state-title">No PRs in this view</div>
          <div className="empty-state-subtitle">
            Import PRs from GitHub to build a product timeline.
            {classFilter && (
              <> <Link href={filterUrl({ classification: '' })} style={{ color: 'var(--blue)' }}>Clear filter</Link></>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {buckets.map((bucket) => (
            <div key={bucket.key}>
              {/* Bucket header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
              }}>
                <div style={{
                  fontWeight: 600, fontSize: '0.9rem',
                  color: 'var(--text)',
                }}>
                  {bucket.label}
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {bucket.prCount} PR{bucket.prCount !== 1 ? 's' : ''}
                  {bucket.featuresCount > 0 && ` · ${bucket.featuresCount} feature${bucket.featuresCount !== 1 ? 's' : ''}`}
                  {bucket.bugsFixedCount > 0 && ` · ${bucket.bugsFixedCount} bug${bucket.bugsFixedCount !== 1 ? 's' : ''} fixed`}
                  {bucket.migrationCount > 0 && ` · ${bucket.migrationCount} migration${bucket.migrationCount !== 1 ? 's' : ''}`}
                </div>
              </div>

              {/* Sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 16 }}>
                {bucket.sections.map((section) => (
                  <div key={section.classification}>
                    {/* Section header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 6,
                    }}>
                      <span style={{
                        color: CLASS_COLOR[section.classification],
                        fontSize: '0.82rem', fontWeight: 600,
                      }}>
                        {CLASS_ICON[section.classification]} {section.label}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', color: 'var(--text-muted)',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '0 6px', lineHeight: '18px',
                      }}>
                        {section.prs.length}
                      </span>
                    </div>

                    {/* PRs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {section.prs.map((pr) => (
                        <div key={pr.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '8px 12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          borderLeft: `3px solid ${CLASS_COLOR[pr.classification]}`,
                        }}>
                          {/* PR number */}
                          <span style={{
                            fontSize: '0.72rem', color: 'var(--text-muted)',
                            fontFamily: 'monospace', whiteSpace: 'nowrap',
                            paddingTop: 1,
                          }}>
                            #{pr.prNumber}
                          </span>

                          {/* Title */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.85rem', color: 'var(--text)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {pr.prUrl ? (
                                <a
                                  href={pr.prUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--text)', textDecoration: 'none' }}
                                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                                >
                                  {pr.title}
                                </a>
                              ) : pr.title}
                            </div>

                            {/* Meta row */}
                            <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                              {pr.author && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  @{pr.author}
                                </span>
                              )}
                              {pr.githubMergedAt && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  merged {new Date(pr.githubMergedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {pr.filesChangedCount != null && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {pr.filesChangedCount} file{pr.filesChangedCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {pr.milestoneTitle && (
                                <span style={{
                                  fontSize: '0.68rem', color: 'var(--purple)',
                                  background: 'color-mix(in srgb, var(--purple) 15%, transparent)',
                                  padding: '1px 6px', borderRadius: 10,
                                }}>
                                  {pr.milestoneTitle}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right side badges */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            {pr.bugState && BUG_STATE_BADGE[pr.bugState] && (
                              <span style={{
                                fontSize: '0.68rem',
                                color: BUG_STATE_BADGE[pr.bugState].color,
                                background: `color-mix(in srgb, ${BUG_STATE_BADGE[pr.bugState].color} 15%, transparent)`,
                                padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap',
                              }}>
                                {BUG_STATE_BADGE[pr.bugState].label}
                              </span>
                            )}
                            {pr.ciStatus && pr.ciStatus !== 'neutral' && (
                              <span style={{
                                fontSize: '0.68rem',
                                color: CI_COLOR[pr.ciStatus] ?? 'var(--text-muted)',
                                background: `color-mix(in srgb, ${CI_COLOR[pr.ciStatus] ?? 'var(--text-muted)'} 15%, transparent)`,
                                padding: '2px 7px', borderRadius: 10,
                              }}>
                                CI {pr.ciStatus}
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.68rem',
                              color: pr.merged ? 'var(--purple)' : pr.state === 'open' ? 'var(--green)' : 'var(--text-muted)',
                            }}>
                              {pr.merged ? 'merged' : pr.state}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      {prs.length > 0 && (
        <div style={{ marginTop: 32, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {prs.length} PR{prs.length !== 1 ? 's' : ''} shown ·{' '}
          Classification is automatic — use{' '}
          <Link href={`/projects/${params.id}/prs`} style={{ color: 'var(--blue)' }}>PR list</Link>
          {' '}to correct any misclassifications.
        </div>
      )}
    </div>
  );
}
