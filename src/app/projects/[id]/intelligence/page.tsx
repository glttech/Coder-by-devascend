import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { getCurrentUser } from '@/lib/session';
import { requireRole } from '@/lib/rbac';
import FullSyncButton from '@/components/FullSyncButton';
import {
  analyzePrImportance,
  summarizeTriage,
  compareByImportance,
  PRIORITY_META,
  TRIAGE_META,
} from '@/lib/prIntelligence';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

const CLASSIFICATION_COLOR: Record<string, string> = {
  feature: 'var(--blue)',
  bug_fix: 'var(--red)',
  security: 'var(--amber)',
  migration: '#8b5cf6',
  incident: 'var(--red)',
  chore: 'var(--text-muted)',
  test: 'var(--text-muted)',
  docs: 'var(--text-muted)',
  deployment: 'var(--green)',
  rollback: 'var(--amber)',
  other: 'var(--text-muted)',
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return 'Never';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function IntelligencePage({ params }: PageProps) {
  const user = await getCurrentUser();
  const auth = requireRole(user, 'any');
  if (!auth.ok) {
    return <div style={{ padding: 32 }}>Unauthorized</div>;
  }

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

  const [
    totalPRs,
    mergedPRs,
    openPRs,
    failedCI,
    regressionRisks,
    syncState,
    recentPRs,
    classRows,
    incidentCount,
    agentRunCount,
  ] = await Promise.all([
    prisma.githubPR.count({ where: { projectId: params.id } }),
    prisma.githubPR.count({ where: { projectId: params.id, merged: true } }),
    prisma.githubPR.count({ where: { projectId: params.id, state: 'open' } }),
    prisma.githubPR.count({ where: { projectId: params.id, ciStatus: 'failure' } }),
    prisma.githubPR.count({ where: { projectId: params.id, bugState: 'regression_risk' } }),
    prisma.prSyncState.findUnique({ where: { projectId: params.id } }),
    prisma.githubPR.findMany({
      where: { projectId: params.id },
      orderBy: [{ githubUpdatedAt: 'desc' }, { importedAt: 'desc' }],
      take: 15,
      select: {
        id: true,
        prNumber: true,
        title: true,
        state: true,
        merged: true,
        ciStatus: true,
        classification: true,
        githubMergedAt: true,
        githubUpdatedAt: true,
        author: true,
      },
    }),
    prisma.githubPR.groupBy({
      by: ['classification'],
      where: { projectId: params.id },
      _count: { _all: true },
    }),
    prisma.incident.count({ where: { task: { projectId: params.id } } }),
    prisma.agentRun.count({ where: { task: { projectId: params.id } } }),
  ]);

  // ── PR Intelligence: triage all open PRs by importance ──────────────────────
  const openPRsForTriage = await prisma.githubPR.findMany({
    where: { projectId: params.id, state: 'open' },
    orderBy: { githubUpdatedAt: 'desc' },
    take: 200,
    select: {
      id: true, prNumber: true, title: true, body: true,
      state: true, merged: true, ciStatus: true, classification: true,
      labels: true, filesChanged: true, filesChangedCount: true,
    },
  });

  const triaged = openPRsForTriage
    .map((pr) => ({ pr, intel: analyzePrImportance(pr) }))
    .sort((a, b) => compareByImportance(a.intel, b.intel));

  const triageCounts = summarizeTriage(triaged.map((t) => t.intel));
  const needsAttention = triaged.filter((t) => t.intel.triage !== 'safe');

  const classBreakdown = classRows
    .map((r) => ({ label: r.classification ?? 'unclassified', count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const maxClassCount = classBreakdown.length > 0 ? classBreakdown[0].count : 1;

  const lastSynced = syncState?.lastSyncedAt ? formatDate(syncState.lastSyncedAt) : 'Never';

  return (
    <div>
      <PageHeader
        title="Repository Intelligence"
        subtitle={
          <Link href={`/projects/${params.id}`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← {project.name}
          </Link>
        }
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FullSyncButton projectId={params.id} />
            <Link href={`/projects/${params.id}/governance-timeline`} className="btn btn-ghost btn-sm">
              Governance Timeline →
            </Link>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Summary</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-card-label">Total PRs</div>
            <div className="stat-card-value">{totalPRs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Merged PRs</div>
            <div className="stat-card-value" style={{ color: 'var(--green)' }}>{mergedPRs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Open PRs</div>
            <div className="stat-card-value">{openPRs}</div>
          </div>
          <div className="stat-card" style={{ border: failedCI > 0 ? '2px solid var(--red)' : undefined }}>
            <div className="stat-card-label">Failed CI</div>
            <div className="stat-card-value" style={{ color: failedCI > 0 ? 'var(--red)' : 'var(--text)' }}>{failedCI}</div>
          </div>
          <div className="stat-card" style={{ border: regressionRisks > 0 ? '2px solid var(--red)' : undefined }}>
            <div className="stat-card-label">Regression Risks</div>
            <div className="stat-card-value" style={{ color: regressionRisks > 0 ? 'var(--red)' : 'var(--text)' }}>{regressionRisks}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Active Incidents</div>
            <div className="stat-card-value">{incidentCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Agent Runs</div>
            <div className="stat-card-value">{agentRunCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Last Synced</div>
            <div className="stat-card-value" style={{ fontSize: 14, fontWeight: 500 }}>{lastSynced}</div>
          </div>
        </div>
      </div>

      {/* Needs Attention — PR triage */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Needs Attention</span>
          <Link href={`/projects/${params.id}/prs?state=open`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            View all open PRs →
          </Link>
        </div>

        {triaged.length === 0 ? (
          <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No open PRs to triage.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <span className="badge badge-sev-high" title="CI failing or env/secrets change">
                {triageCounts.blocked} blocked
              </span>
              <span className="badge badge-warning" title="High-importance change needing review">
                {triageCounts.needsReview} needs review
              </span>
              <span className="badge badge-success" style={{ opacity: 0.8 }}>
                {triageCounts.safe} safe
              </span>
            </div>

            {needsAttention.length === 0 ? (
              <div className="card" style={{ fontSize: 13, color: 'var(--green)' }}>
                ✓ All {triaged.length} open PR{triaged.length === 1 ? '' : 's'} look safe — no blocking risk signals detected.
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
                      <th>Top signal</th>
                      <th>CI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsAttention.slice(0, 25).map(({ pr, intel }) => {
                      const pmeta = PRIORITY_META[intel.priority];
                      const tmeta = TRIAGE_META[intel.triage];
                      const top = intel.signals[0];
                      return (
                        <tr key={pr.id}>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 700, color: pmeta.color }} title={`Importance ${intel.importanceScore}/100`}>
                              {pmeta.label}
                            </span>
                          </td>
                          <td>
                            <Link href={`/projects/${params.id}/prs/${pr.id}`} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}>
                              #{pr.prNumber}
                            </Link>
                          </td>
                          <td style={{ maxWidth: 260 }}>
                            <Link href={`/projects/${params.id}/prs/${pr.id}`} style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>
                              {pr.title.length > 56 ? pr.title.slice(0, 56) + '…' : pr.title}
                            </Link>
                          </td>
                          <td>
                            <span className={`badge ${tmeta.badge}`}>{tmeta.label}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220 }}>
                            {top ? top.label : '—'}
                          </td>
                          <td>
                            {pr.ciStatus ? (
                              <span
                                className={`badge badge-${pr.ciStatus === 'success' ? 'success' : pr.ciStatus === 'failure' ? 'sev-high' : 'neutral'}`}
                              >
                                {pr.ciStatus}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Classification Breakdown */}
      {classBreakdown.length > 0 && (
        <div className="section">
          <div className="section-header">
            <span className="section-title">Classification Breakdown</span>
          </div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classBreakdown.map((row) => {
                const barWidth = Math.max(4, Math.round((row.count / maxClassCount) * 100));
                const color = CLASSIFICATION_COLOR[row.label] ?? 'var(--text-muted)';
                return (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 100, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, textAlign: 'right' }}>
                      {row.label}
                    </div>
                    <div style={{ flex: 1, height: 18, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          background: color,
                          opacity: 0.8,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <div style={{ width: 32, fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                      {row.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent PR Activity */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Recent PR Activity</span>
          <Link href={`/projects/${params.id}/prs`} style={{ fontSize: 12, color: 'var(--blue)' }}>
            View all PRs →
          </Link>
        </div>

        {recentPRs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
              No PRs imported yet.
            </div>
            <FullSyncButton projectId={params.id} label="Import PR History" />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR #</th>
                  <th>Title</th>
                  <th>State</th>
                  <th>CI</th>
                  <th>Classification</th>
                  <th>Merged At</th>
                </tr>
              </thead>
              <tbody>
                {recentPRs.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue)' }}
                      >
                        #{pr.prNumber}
                      </Link>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <Link
                        href={`/projects/${params.id}/prs/${pr.id}`}
                        style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}
                      >
                        {pr.title.length > 60 ? pr.title.slice(0, 60) + '…' : pr.title}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          pr.merged ? 'success' : pr.state === 'open' ? 'pending_approval' : 'neutral'
                        }`}
                      >
                        {pr.merged ? 'merged' : pr.state}
                      </span>
                    </td>
                    <td>
                      {pr.ciStatus ? (
                        <span
                          className={`badge badge-${
                            pr.ciStatus === 'success'
                              ? 'success'
                              : pr.ciStatus === 'failure'
                              ? 'sev-high'
                              : 'neutral'
                          }`}
                        >
                          {pr.ciStatus}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {pr.classification ?? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {pr.githubMergedAt ? formatDate(pr.githubMergedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
