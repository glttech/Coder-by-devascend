/**
 * /demo — Pilot Demo landing page.
 *
 * Shows 3 governance scenarios. Each has a form that POSTs to /api/demo
 * and redirects to /demo/[scenarioIndex] for results.
 * No auth required — public demo page for prospective teams.
 */

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { DEMO_SCENARIOS } from '@/lib/demo/seed';

export const dynamic = 'force-dynamic';

const RISK_BADGE_CLASS: Record<string, string> = {
  low: 'badge-success',
  medium: 'badge-warning',
  high: 'badge-sev-high',
};

const DECISION_LABEL: Record<string, string> = {
  CONTINUE: 'Proceed',
  RUN_VALIDATION: 'Validate first',
  SENIOR_APPROVAL_REQUIRED: 'Senior approval',
  BLOCKED: 'Blocked',
};

export default function DemoPage() {
  return (
    <div>
      <PageHeader
        title="Pilot Demo: AI Delivery Governance"
        subtitle="Three representative scenarios showing how the governance platform handles low, medium, and high risk tasks."
        actions={
          <Link href="/" className="btn btn-ghost btn-sm">
            Back to Home
          </Link>
        }
      />

      <div className="section">
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.3)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 24,
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong>{' '}
          Click <strong>Run Demo</strong> on any scenario to see the governance pipeline in action.
          Each role independently analyses the task, produces a risk score and decision
          recommendation. No human approval is granted automatically — this is a read-only
          recommendation engine.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {DEMO_SCENARIOS.map((scenario, index) => (
            <div key={index} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{scenario.task.title}</span>
                    <span className={`badge ${RISK_BADGE_CLASS[scenario.task.riskLevel] ?? 'badge-neutral'}`}>
                      {scenario.task.riskLevel} risk
                    </span>
                    <span className="badge badge-neutral">{scenario.task.environment}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                    {scenario.narrative}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Roles:</span>
                    {scenario.roles.map((role) => (
                      <span key={role} className="badge badge-neutral" style={{ fontSize: 11 }}>
                        {role}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expected: </span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>
                      {DECISION_LABEL[scenario.expectedDecision] ?? scenario.expectedDecision}
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Link
                    href={`/demo/${index}`}
                    className="btn btn-primary btn-sm"
                  >
                    Run Demo
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
