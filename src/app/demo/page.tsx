/**
 * /demo — AI Dev Orchestrator product showcase + Pilot Demo landing page.
 *
 * Shows platform feature highlights and 3 live governance scenarios.
 * No auth required — public page for prospective customers and evaluating teams.
 */

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { DEMO_SCENARIOS } from '@/lib/demo/seed';
import DemoResetButton from './DemoResetButton';

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

const FEATURE_HIGHLIGHTS = [
  {
    icon: '⬟',
    title: 'Repository Intelligence',
    description:
      'Import PRs from any GitHub repo, classify by type, and track CI status — automatically.',
    href: '/projects',
  },
  {
    icon: '◎',
    title: 'Governance Timeline',
    description:
      'Unified view of every change: PR merges, AI runs, approvals, and incidents in one place.',
    href: '/audit',
  },
  {
    icon: '◉',
    title: 'Policy Gates',
    description:
      'Automatic risk evaluation on every task — approve, flag for review, or block before code ships.',
    href: '/instructions/pending',
  },
  {
    icon: '⚠',
    title: 'Incident Tracking',
    description:
      'Capture and triage production incidents linked to specific AI agent runs for full traceability.',
    href: '/incidents',
  },
  {
    icon: '◑',
    title: 'Agent Scorecards',
    description:
      'Measure AI agent performance over time: pass rates, risk distributions, and approval patterns.',
    href: '/providers/scorecard',
  },
  {
    icon: '◆',
    title: 'Client Reports',
    description:
      'Generate governance reports and shareable audit trails for stakeholders and compliance reviewers.',
    href: '/diagrams',
  },
];

export default function DemoPage() {
  return (
    <div>
      <PageHeader
        title="AI Dev Orchestrator — Demo"
        subtitle="Coder by DevAscend brings governance to AI-assisted development — every agent change is risk-checked, gated, and audited before it ships."
        actions={
          <Link href="/getting-started" className="btn btn-primary btn-sm">
            Get Started →
          </Link>
        }
      />

      {/* Feature highlights grid */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Platform Features</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: 12,
          }}
        >
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="card"
                style={{
                  padding: '18px 20px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{feature.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                    {feature.title}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    flex: 1,
                  }}
                >
                  {feature.description}
                </p>
                <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 500 }}>
                  Explore →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Live governance scenarios */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Live Governance Scenarios</span>
        </div>
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.3)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 16,
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

      {/* CTA */}
      <div className="section">
        <div
          className="card"
          style={{
            padding: '24px 28px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
            Ready to start?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 400,
              lineHeight: 1.6,
            }}
          >
            Create your first project and connect a GitHub repository to start tracking
            AI-assisted changes with full governance.
          </p>
          <Link href="/projects/new" className="btn btn-primary">
            Create your first project →
          </Link>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Need a guided walkthrough?{' '}
            <Link href="/getting-started" style={{ color: 'var(--blue)' }}>
              View the Getting Started guide →
            </Link>
          </div>
        </div>
      </div>

      {/* Reset demo data (non-production only) */}
      {process.env.NODE_ENV !== 'production' && <DemoResetButton />}
    </div>
  );
}
