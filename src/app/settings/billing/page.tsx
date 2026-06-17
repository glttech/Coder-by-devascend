import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { getUsageMetrics, PLAN_LIMITS } from '@/lib/usage';
import { featureFlags } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--green)';
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {used} / {limit === Infinity ? '∞' : limit}
        </span>
      </div>
      {limit !== Infinity && (
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

export default async function BillingPage() {
  const metrics = await getUsageMetrics();
  const currentPlan: keyof typeof PLAN_LIMITS = 'free';
  const limits = PLAN_LIMITS[currentPlan];

  return (
    <div>
      <PageHeader title="Billing & Usage" subtitle="Track your usage and manage your plan" />

      <div className="section">
        <Card>
          <CardHeader title="Current Plan" subtitle={featureFlags.billingEnabled ? 'Upgrade to unlock higher limits' : 'Billing is in preview mode'} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <span className="badge badge-neutral" style={{ fontSize: 14, padding: '4px 12px' }}>
              {currentPlan.toUpperCase()}
            </span>
            {featureFlags.billingEnabled && (
              <button className="btn btn-primary btn-sm">Upgrade to Pro →</button>
            )}
            {!featureFlags.billingEnabled && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Set FEATURE_BILLING=true to enable plan management
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="section">
        <Card>
          <CardHeader title="Usage This Month" subtitle="Resets at the start of each month" />
          <UsageBar used={metrics.agentRunsThisMonth} limit={limits.runsPerMonth} label="Agent Runs (this month)" />
          <UsageBar used={metrics.tasksCreated} limit={limits.tasks} label="Tasks Total" />
          <UsageBar used={metrics.projectsTotal} limit={limits.projects} label="Projects" />
          <UsageBar used={metrics.apiKeysActive} limit={limits.apiKeys} label="API Keys" />
        </Card>
      </div>

      <div className="section">
        <Card>
          <CardHeader title="All-Time Stats" subtitle="Cumulative activity" />
          <div className="meta-grid">
            <div className="meta-row"><span className="meta-label">Total Tasks</span><span className="meta-value">{metrics.tasksCreated}</span></div>
            <div className="meta-row"><span className="meta-label">Total Agent Runs</span><span className="meta-value">{metrics.agentRunsTotal}</span></div>
            <div className="meta-row"><span className="meta-label">Total Instructions</span><span className="meta-value">{metrics.instructionsTotal}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
