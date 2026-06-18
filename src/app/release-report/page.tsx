import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import { buildReleaseReport, ReportFilters } from '@/lib/releaseReport';
import { TimelinePR, TimelineClassification } from '@/lib/buildTimeline';
import ReportPrintButton from './ReportPrintButton';

export const dynamic = 'force-dynamic';

const VALID_CLASSIFICATIONS = new Set<TimelineClassification>([
  'feature', 'bug_fix', 'security', 'migration', 'deployment',
  'rollback', 'incident', 'chore', 'test', 'docs', 'unclassified',
]);

function toClassification(v: string | null): TimelineClassification {
  return v && VALID_CLASSIFICATIONS.has(v as TimelineClassification)
    ? (v as TimelineClassification)
    : 'unclassified';
}

const SECTION_LABELS: Record<string, string> = {
  features: 'Features Added',
  bugFixes: 'Bugs Fixed',
  security: 'Security Changes',
  migrations: 'Migrations',
  deployments: 'Deployments',
  incidents: 'Incidents',
  other: 'Other Changes',
};

const RISK_SEVERITY_COLOR: Record<string, string> = {
  high:   'var(--red)',
  medium: 'var(--amber)',
  low:    'var(--text-muted)',
};

const PENDING_LABEL: Record<string, string> = {
  open_bug:              'Open bug',
  regression_risk:       'Regression risk',
  needs_retest:          'Needs retest',
  migration_unverified:  'Migration unverified',
};

interface PageProps {
  searchParams: { projectId?: string; milestoneId?: string; since?: string; until?: string };
}

export default async function ReleaseReportPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return <div style={{ padding: 32 }}>Unauthorized</div>;
  }

  const { projectId, milestoneId, since: sinceStr, until: untilStr } = searchParams;
  const since = sinceStr ? new Date(sinceStr) : undefined;
  const until = untilStr ? new Date(untilStr) : undefined;

  // Load projects and milestones for the filter UI
  const [projects, milestones] = await Promise.all([
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    projectId
      ? prisma.milestone.findMany({ where: { projectId }, select: { id: true, title: true }, orderBy: { createdAt: 'desc' } })
      : Promise.resolve([]),
  ]);

  // Load PRs matching filters
  const where: Record<string, unknown> = { state: 'closed' };
  if (projectId)   where['projectId']   = projectId;
  if (milestoneId) where['milestoneId'] = milestoneId;
  if (since || until) {
    const df: Record<string, Date> = {};
    if (since && !isNaN(since.getTime())) df['gte'] = since;
    if (until && !isNaN(until.getTime())) df['lte'] = until;
    where['githubMergedAt'] = df;
  }

  const rawPRs = await prisma.githubPR.findMany({
    where,
    orderBy: { githubMergedAt: 'desc' },
    take: 500,
  });

  const prs: TimelinePR[] = rawPRs.map((pr) => ({
    id: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    author: pr.author ?? null,
    prUrl: null,
    state: pr.state,
    merged: !!pr.githubMergedAt,
    ciStatus: pr.ciStatus ?? null,
    classification: toClassification(pr.classification ?? null),
    bugState: pr.bugState ?? null,
    labels: [],
    filesChangedCount: null,
    githubMergedAt: pr.githubMergedAt ?? null,
    githubCreatedAt: pr.githubCreatedAt ?? null,
    milestoneId: pr.milestoneId ?? null,
  }));

  const filters: ReportFilters = { projectId, milestoneId, since, until };
  const report = buildReleaseReport(prs, filters);
  const { summary, sections, risks, pending } = report;

  const sectionEntries = Object.entries(sections) as Array<[keyof typeof sections, TimelinePR[]]>;
  const hasContent = prs.length > 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 48px' }} className="release-report">
      <PageHeader
        title="Release Intelligence Report"
        subtitle="Merged PRs, bugs fixed, migrations, security changes, and risks"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <ReportPrintButton />
            <Link href="/memory" className="btn btn-secondary btn-sm">Memory Search</Link>
          </div>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <form method="GET" style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Project</label>
          <select name="projectId" defaultValue={projectId ?? ''} className="input" style={{ fontSize: '0.78rem' }}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {milestones.length > 0 && (
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Milestone</label>
            <select name="milestoneId" defaultValue={milestoneId ?? ''} className="input" style={{ fontSize: '0.78rem' }}>
              <option value="">All milestones</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Since</label>
          <input type="date" name="since" defaultValue={sinceStr ?? ''} className="input" style={{ fontSize: '0.78rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Until</label>
          <input type="date" name="until" defaultValue={untilStr ?? ''} className="input" style={{ fontSize: '0.78rem' }} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">Generate</button>
      </form>

      {!hasContent ? (
        <div className="empty-state" style={{ maxWidth: 420, marginTop: 32 }}>
          <div className="empty-state-icon">◎</div>
          <div className="empty-state-title">No merged PRs found</div>
          <div className="empty-state-subtitle">Adjust the filters above to find merged pull requests.</div>
        </div>
      ) : (
        <>
          {/* ── Report header ────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '16px 20px', marginBottom: 24,
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Generated {new Date(report.generatedAt).toLocaleString()}
              {sinceStr && ` · from ${sinceStr}`}
              {untilStr && ` · to ${untilStr}`}
            </div>

            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Total PRs',    value: summary.totalPRs,        color: 'var(--text)' },
                { label: 'Features',     value: summary.features,         color: 'var(--green)' },
                { label: 'Bugs Fixed',   value: summary.bugsFixed,        color: 'var(--blue)' },
                { label: 'Security',     value: summary.securityChanges,  color: 'var(--amber)' },
                { label: 'Migrations',   value: summary.migrations,       color: 'var(--purple)' },
                { label: 'Incidents',    value: summary.incidents,        color: 'var(--red)' },
                { label: 'Open Bugs',    value: summary.openBugs,         color: summary.openBugs > 0 ? 'var(--red)' : 'var(--text-muted)' },
                { label: 'Regressions',  value: summary.regressionRisks,  color: summary.regressionRisks > 0 ? 'var(--red)' : 'var(--text-muted)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Risks ───────────────────────────────────────────────────── */}
          {risks.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10, color: 'var(--red)' }}>
                ⚠ Risks ({risks.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {risks.map((r) => (
                  <div key={r.prNumber} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderLeft: `4px solid ${RISK_SEVERITY_COLOR[r.severity]}`,
                    borderRadius: 6, padding: '8px 12px',
                  }}>
                    <span style={{ fontWeight: 500, fontSize: '0.8rem' }}>#{r.prNumber} {r.prTitle}</span>
                    <span style={{ fontSize: '0.68rem', color: RISK_SEVERITY_COLOR[r.severity], marginLeft: 8, textTransform: 'uppercase' }}>
                      {r.severity}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.reason}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Pending smoke tests ─────────────────────────────────────── */}
          {pending.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10, color: 'var(--amber)' }}>
                Pending Smoke Tests ({pending.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pending.map((p) => (
                  <div key={`${p.prNumber}-${p.type}`} style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '6px 12px', fontSize: '0.78rem',
                  }}>
                    <span style={{ fontSize: '0.65rem', padding: '1px 8px', borderRadius: 10, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', color: 'var(--amber)', border: '1px solid var(--amber)', whiteSpace: 'nowrap' }}>
                      {PENDING_LABEL[p.type]}
                    </span>
                    <span>#{p.prNumber} {p.prTitle}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── PR sections ─────────────────────────────────────────────── */}
          {sectionEntries.map(([key, sectionPRs]) => {
            if (sectionPRs.length === 0) return null;
            return (
              <section key={key} style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                  {SECTION_LABELS[key] ?? key} ({sectionPRs.length})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sectionPRs.map((pr) => (
                    <div key={pr.id} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '7px 12px', fontSize: '0.78rem',
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem', flexShrink: 0 }}>
                        #{pr.prNumber}
                      </span>
                      <span style={{ flex: 1 }}>{pr.title}</span>
                      {pr.author && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {pr.author}
                        </span>
                      )}
                      {pr.githubMergedAt && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(pr.githubMergedAt).toLocaleDateString()}
                        </span>
                      )}
                      {pr.bugState && (
                        <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {pr.bugState}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
