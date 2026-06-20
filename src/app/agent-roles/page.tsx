/**
 * /agent-roles — Overview of all 7 built-in agent governance roles.
 *
 * Shows each role as a card with name, description, run count, and avg risk score.
 * Server component, no client state needed.
 */

import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { BUILT_IN_ROLES } from '@/lib/agents/roles';

export const dynamic = 'force-dynamic';

const ROLE_ICONS: Record<string, string> = {
  product_analyst:  '◉',
  architect:        '⬟',
  developer:        '◈',
  reviewer:         '◎',
  security_reviewer: '⚠',
  qa:               '⬡',
  release_manager:  '◆',
};

function riskScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)';
  if (score >= 0.7) return 'var(--red-text)';
  if (score >= 0.4) return 'var(--yellow-text, #b45309)';
  return 'var(--green-text)';
}

function formatRiskScore(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(2);
}

export default async function AgentRolesPage() {
  // Aggregate run counts and avg risk score per roleKey
  const groupedRuns = await prisma.agentRun.groupBy({
    by: ['roleKey'],
    _count: { id: true },
    _avg: { riskScore: true },
    where: { roleKey: { not: null } },
  });

  const runStatsByRole = new Map(
    groupedRuns.map((g) => [
      g.roleKey as string,
      { count: g._count.id, avgRisk: g._avg.riskScore },
    ]),
  );

  const totalRuns = groupedRuns.reduce((s, g) => s + g._count.id, 0);

  return (
    <div>
      <PageHeader
        title="Agent Roles"
        subtitle={`${BUILT_IN_ROLES.length} built-in governance roles · ${totalRuns} total runs`}
        actions={
          <Link href="/api/agent-roles" className="btn btn-ghost btn-sm" target="_blank">
            JSON API
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
          marginTop: 8,
        }}
      >
        {BUILT_IN_ROLES.map((role) => {
          const stats = runStatsByRole.get(role.key);
          const runCount = stats?.count ?? 0;
          const avgRisk = stats?.avgRisk ?? null;

          return (
            <Card key={role.key}>
              <div style={{ padding: '20px 20px 16px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 24,
                      lineHeight: 1,
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {ROLE_ICONS[role.key] ?? '◈'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {role.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Max risk: {role.maxRiskLevel}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  {role.description}
                </p>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Runs
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {runCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Avg Risk Score
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: riskScoreColor(avgRisk),
                      }}
                    >
                      {formatRiskScore(avgRisk)}
                    </div>
                  </div>
                </div>

                {/* Link */}
                <Link
                  href={`/agent-roles/${role.key}`}
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline-block' }}
                >
                  View dashboard →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
