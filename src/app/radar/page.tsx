import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import AddFeatureIdeaForm from './AddFeatureIdeaForm';

export const dynamic = 'force-dynamic';

type Decision = 'build' | 'skip' | 'defer' | 'under_review';
type Relevance = 'low' | 'medium' | 'high' | 'critical';

const DECISION_CONFIG: Record<Decision, { label: string; color: string; bg: string }> = {
  under_review: { label: 'Under review', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  build:        { label: 'Build', color: 'var(--green)', bg: 'color-mix(in srgb, var(--green) 12%, transparent)' },
  defer:        { label: 'Defer', color: 'var(--blue)', bg: 'color-mix(in srgb, var(--blue) 12%, transparent)' },
  skip:         { label: 'Skip', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
};

const RELEVANCE_CONFIG: Record<Relevance, { color: string }> = {
  low:      { color: 'var(--text-muted)' },
  medium:   { color: 'var(--blue)' },
  high:     { color: 'var(--amber)' },
  critical: { color: 'var(--red)' },
};

const VALID_DECISIONS: Decision[] = ['under_review', 'build', 'defer', 'skip'];

interface PageProps {
  searchParams: { decision?: string; relevance?: string };
}

export default async function FeatureRadarPage({ searchParams }: PageProps) {
  const decisionFilter = VALID_DECISIONS.includes(searchParams.decision as Decision)
    ? (searchParams.decision as Decision)
    : null;
  const relevanceFilter = ['low', 'medium', 'high', 'critical'].includes(searchParams.relevance ?? '')
    ? searchParams.relevance
    : null;

  const where: Record<string, unknown> = {};
  if (decisionFilter) where['decision'] = decisionFilter;
  if (relevanceFilter) where['relevance'] = relevanceFilter;

  const [ideas, totals] = await Promise.all([
    prisma.featureIdea.findMany({
      where,
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.featureIdea.groupBy({
      by: ['decision'],
      _count: { _all: true },
    }),
  ]);

  const countByDecision = Object.fromEntries(
    totals.map((t) => [t.decision, t._count._all]),
  );

  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (decisionFilter) p.set('decision', decisionFilter);
    if (relevanceFilter) p.set('relevance', relevanceFilter);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '') p.delete(k); else p.set(k, v);
    }
    const qs = p.toString();
    return `/radar${qs ? `?${qs}` : ''}`;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 48px' }}>
      <PageHeader
        title="Feature Radar"
        subtitle="Track external AI-dev features and decide: build, skip, or defer"
        actions={<Link href="/memory" className="btn btn-secondary btn-sm">Memory Search</Link>}
      />

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link
          href={filterUrl({ decision: '' })}
          style={{
            padding: '5px 16px', borderRadius: 6, fontSize: '0.78rem',
            background: !decisionFilter ? 'var(--blue)' : 'var(--surface)',
            color: !decisionFilter ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)', textDecoration: 'none',
          }}
        >
          All ({Object.values(countByDecision).reduce((a, b) => a + b, 0)})
        </Link>
        {VALID_DECISIONS.map((d) => {
          const cfg = DECISION_CONFIG[d];
          const count = countByDecision[d] ?? 0;
          return (
            <Link
              key={d}
              href={filterUrl({ decision: d === decisionFilter ? '' : d })}
              style={{
                padding: '5px 16px', borderRadius: 6, fontSize: '0.78rem',
                background: decisionFilter === d ? cfg.color : 'var(--surface)',
                color: decisionFilter === d ? '#fff' : 'var(--text)',
                border: `1px solid ${decisionFilter === d ? cfg.color : 'var(--border)'}`,
                textDecoration: 'none',
              }}
            >
              {cfg.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* ── Add form ──────────────────────────────────────────────────── */}
      <AddFeatureIdeaForm />

      {/* ── Idea list ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        {ideas.length === 0 ? (
          <div className="empty-state" style={{ maxWidth: 420, marginTop: 32 }}>
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">No ideas yet</div>
            <div className="empty-state-subtitle">
              Add your first external feature idea using the form above.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ideas.map((idea) => {
              const decCfg = DECISION_CONFIG[idea.decision as Decision] ?? DECISION_CONFIG['under_review'];
              const relCfg = RELEVANCE_CONFIG[idea.relevance as Relevance] ?? RELEVANCE_CONFIG['medium'];

              return (
                <div
                  key={idea.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    borderLeft: `4px solid ${decCfg.color}`,
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>
                          {idea.title}
                        </span>
                        {idea.coderHasFeature && (
                          <span style={{
                            fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10,
                            background: 'color-mix(in srgb, var(--green) 15%, transparent)',
                            color: 'var(--green)', border: '1px solid var(--green)',
                          }}>
                            Coder has this
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                        {idea.vendor && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {idea.vendor}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: relCfg.color, fontWeight: 600 }}>
                          {idea.relevance} relevance
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {idea.riskLevel} risk
                        </span>
                        {idea.sourceUrl && (
                          <a
                            href={idea.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.72rem', color: 'var(--blue)' }}
                          >
                            Source ↗
                          </a>
                        )}
                      </div>

                      {/* Description */}
                      {idea.description && (
                        <div style={{
                          fontSize: '0.78rem', color: 'var(--text-muted)',
                          marginTop: 6, lineHeight: 1.5,
                        }}>
                          {idea.description}
                        </div>
                      )}

                      {/* Problem solved */}
                      {idea.problemSolved && (
                        <div style={{
                          fontSize: '0.75rem', color: 'var(--text-muted)',
                          marginTop: 4, fontStyle: 'italic',
                        }}>
                          Solves: {idea.problemSolved}
                        </div>
                      )}

                      {/* Decision note */}
                      {idea.decisionNote && (
                        <div style={{
                          fontSize: '0.75rem', color: 'var(--text-muted)',
                          marginTop: 4,
                        }}>
                          Note: {idea.decisionNote}
                        </div>
                      )}

                      {/* Links to task/milestone */}
                      {(idea.taskId || idea.milestoneId) && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                          {idea.taskId && (
                            <Link href={`/tasks/${idea.taskId}`} style={{ fontSize: '0.72rem', color: 'var(--blue)' }}>
                              → Task
                            </Link>
                          )}
                          {idea.milestoneId && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--purple)' }}>
                              → Milestone
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Decision badge */}
                    <span style={{
                      fontSize: '0.7rem', padding: '4px 12px', borderRadius: 20,
                      background: decCfg.bg, color: decCfg.color,
                      border: `1px solid ${decCfg.color}`,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {decCfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Use the API (<code style={{ fontSize: '0.7rem' }}>PATCH /api/feature-ideas/[id]</code>) to update decisions and link ideas to tasks.
      </div>
    </div>
  );
}
