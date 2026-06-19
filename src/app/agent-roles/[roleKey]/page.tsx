/**
 * /agent-roles/[roleKey] — Role-specific dashboard.
 *
 * Shows role description, stats (total/succeeded/failed/avg risk),
 * and a filterable table of recent agent runs with that role.
 *
 * Filters: status (all/succeeded/failed/running), date range (7d/30d/all).
 * Server component with searchParams-based filtering.
 */

import prisma from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { getRole } from '@/lib/agents/roles';

export const dynamic = 'force-dynamic';

interface Props {
  params: { roleKey: string };
  searchParams: { status?: string; range?: string };
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function riskScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 0.7) return 'var(--red-text)';
  if (score >= 0.4) return 'var(--yellow-text, #b45309)';
  return 'var(--green-text)';
}

function formatRiskScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return score.toFixed(2);
}

const VALID_STATUSES = ['all', 'succeeded', 'failed', 'running'] as const;
const VALID_RANGES   = ['7d', '30d', 'all'] as const;

function filterHref(roleKey: string, status: string, range: string): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (range !== 'all')  params.set('range', range);
  const qs = params.toString();
  return `/agent-roles/${roleKey}${qs ? `?${qs}` : ''}`;
}

export default async function AgentRoleDashboard({ params, searchParams }: Props) {
  const { roleKey } = params;
  const role = getRole(roleKey);
  if (!role) notFound();

  // Parse + validate filters
  const statusFilter = VALID_STATUSES.includes(searchParams.status as typeof VALID_STATUSES[number])
    ? (searchParams.status as string)
    : 'all';
  const rangeFilter = VALID_RANGES.includes(searchParams.range as typeof VALID_RANGES[number])
    ? (searchParams.range as string)
    : 'all';

  // Build date range filter
  let startedAtFilter: { gte: Date } | undefined;
  if (rangeFilter === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startedAtFilter = { gte: d };
  } else if (rangeFilter === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startedAtFilter = { gte: d };
  }

  // Overall stats (unfiltered by status/date) for the stat cards
  const allRuns = await prisma.agentRun.findMany({
    where: { roleKey },
    select: { status: true, riskScore: true },
  });

  const totalRuns     = allRuns.length;
  const succeededRuns = allRuns.filter((r) => r.status === 'succeeded').length;
  const failedRuns    = allRuns.filter((r) => r.status === 'failed').length;
  const riskScores    = allRuns.map((r) => r.riskScore).filter((s): s is number => s !== null);
  const avgRiskScore  = riskScores.length > 0
    ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
    : null;

  // Filtered query for the table
  const tableWhere: Record<string, unknown> = { roleKey };
  if (statusFilter !== 'all') tableWhere.status = statusFilter;
  if (startedAtFilter)        tableWhere.startedAt = startedAtFilter;

  const runs = await prisma.agentRun.findMany({
    where: tableWhere,
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  const STATUS_FILTERS = [
    { label: 'All',       value: 'all' },
    { label: 'Succeeded', value: 'succeeded' },
    { label: 'Failed',    value: 'failed' },
    { label: 'Running',   value: 'running' },
  ];

  const RANGE_FILTERS = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'All time',    value: 'all' },
  ];

  return (
    <div>
      <PageHeader
        title={role.name}
        subtitle={role.purpose}
        actions={
          <Link href="/agent-roles" className="btn btn-ghost btn-sm">
            ← All Roles
          </Link>
        }
      />

      {/* Role description */}
      <div
        style={{
          background: 'var(--surface-2, var(--surface))',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '14px 18px',
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Role description
        </div>
        {role.description}
        <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max risk: </span>
            <strong style={{ textTransform: 'capitalize' }}>{role.maxRiskLevel}</strong>
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model: </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{role.modelPref}</span>
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools: </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{role.allowedTools.join(', ')}</span>
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Runs</div>
          <div className="stat-card-value">{totalRuns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Succeeded</div>
          <div className="stat-card-value" style={{ color: totalRuns > 0 ? 'var(--green-text)' : undefined }}>
            {succeededRuns}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Failed</div>
          <div className="stat-card-value" style={{ color: failedRuns > 0 ? 'var(--red-text)' : undefined }}>
            {failedRuns}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg Risk Score</div>
          <div
            className="stat-card-value"
            style={{ color: riskScoreColor(avgRiskScore) }}
          >
            {formatRiskScore(avgRiskScore)}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_FILTERS.map(({ label, value }) => (
            <Link
              key={value}
              href={filterHref(roleKey, value, rangeFilter)}
              className={`btn btn-sm ${statusFilter === value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: statusFilter === value ? 600 : 400 }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {/* Date range filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGE_FILTERS.map(({ label, value }) => (
            <Link
              key={value}
              href={filterHref(roleKey, statusFilter, value)}
              className={`btn btn-sm ${rangeFilter === value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: rangeFilter === value ? 600 : 400 }}
            >
              {label}
            </Link>
          ))}
        </div>

        {(statusFilter !== 'all' || rangeFilter !== 'all') && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            <Link href={`/agent-roles/${roleKey}`} className="btn btn-sm btn-ghost" style={{ color: 'var(--text-muted)' }}>
              Clear
            </Link>
          </>
        )}
      </div>

      {/* Runs table */}
      {runs.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No runs found"
          description={
            statusFilter !== 'all' || rangeFilter !== 'all'
              ? 'No runs match the current filters.'
              : `No agent runs have been assigned to the ${role.name} role yet.`
          }
          action={
            (statusFilter !== 'all' || rangeFilter !== 'all') ? (
              <Link href={`/agent-roles/${roleKey}`} className="btn btn-ghost btn-sm">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    {run.task ? (
                      <Link
                        href={`/tasks/${run.task.id}`}
                        style={{ color: 'var(--blue)', fontWeight: 500 }}
                      >
                        {run.task.title.length > 48
                          ? run.task.title.slice(0, 48) + '…'
                          : run.task.title}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                        {run.id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {run.task?.project ? (
                      <Link href={`/projects/${run.task.project.id}`} style={{ color: 'var(--text-secondary)' }}>
                        {run.task.project.name}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge text={run.status} variant="status" />
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 13,
                        fontWeight: 600,
                        color: riskScoreColor(run.riskScore),
                      }}
                    >
                      {formatRiskScore(run.riskScore)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {relativeTime(run.startedAt)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {run.startedAt.toISOString().replace('T', ' ').slice(0, 16)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 100 && (
            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              Showing latest 100 runs · Apply filters to narrow results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
