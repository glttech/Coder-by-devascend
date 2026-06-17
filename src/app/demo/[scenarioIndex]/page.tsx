/**
 * /demo/[scenarioIndex] — Demo result page.
 *
 * Runs the scenario server-side and displays the governance output.
 * No auth required — public demo page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { runDemoScenario } from '@/lib/demo/runner';
import { DEMO_SCENARIOS } from '@/lib/demo/seed';

export const dynamic = 'force-dynamic';

interface DemoResultPageProps {
  params: { scenarioIndex: string };
}

const RISK_BADGE_CLASS: Record<string, string> = {
  low: 'badge-success',
  medium: 'badge-warning',
  high: 'badge-sev-high',
};

const DECISION_BADGE_CLASS: Record<string, string> = {
  CONTINUE: 'badge-success',
  RUN_VALIDATION: 'badge-warning',
  ASK_AGENT_FOR_EVIDENCE: 'badge-neutral',
  SENIOR_APPROVAL_REQUIRED: 'badge-sev-high',
  BLOCKED: 'badge-sev-high',
};

export default async function DemoResultPage({ params }: DemoResultPageProps) {
  const index = parseInt(params.scenarioIndex, 10);
  if (isNaN(index) || index < 0 || index >= DEMO_SCENARIOS.length) {
    notFound();
  }

  const result = await runDemoScenario(index);

  return (
    <div>
      <PageHeader
        title={`Demo Result: ${result.scenario.task.title}`}
        subtitle={result.scenario.narrative}
        actions={
          <Link href="/demo" className="btn btn-ghost btn-sm">
            Back to Demo
          </Link>
        }
      />

      {/* Governance notice */}
      <div className="section">
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.3)',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Governance notice:</strong>{' '}
          These are AI-generated recommendations only. No action is taken automatically.
          Human approval is always required via the Approval panel.
        </div>
      </div>

      {/* Task context */}
      <div className="section">
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span className="card-title">Task Context</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span className={`badge ${RISK_BADGE_CLASS[result.scenario.task.riskLevel] ?? 'badge-neutral'}`}>
                {result.scenario.task.riskLevel} risk
              </span>
              <span className="badge badge-neutral">{result.scenario.task.environment}</span>
            </div>
          </div>
          <div className="meta-grid" style={{ marginTop: 12 }}>
            <div className="meta-row">
              <span className="meta-label">Instruction</span>
              <span className="meta-value">{result.scenario.task.instruction}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role outputs */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Role Analysis ({result.roleOutputs.length} roles)</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Risk Score</th>
                <th>Decision</th>
                <th>Requires Approval</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {result.roleOutputs.map((output) => (
                <tr key={output.roleKey} style={{ verticalAlign: 'top' }}>
                  <td style={{ fontWeight: 500 }}>{output.roleKey}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color:
                          output.riskScore >= 0.7
                            ? 'var(--red, #ef4444)'
                            : output.riskScore >= 0.4
                            ? 'var(--amber, #f59e0b)'
                            : 'var(--green, #22c55e)',
                      }}
                    >
                      {output.riskScore.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${DECISION_BADGE_CLASS[output.decisionSuggestion] ?? 'badge-neutral'}`}
                      style={{ fontSize: 11 }}
                    >
                      {output.decisionSuggestion}
                    </span>
                  </td>
                  <td>
                    <span
                      className={output.requiresApproval ? 'badge badge-sev-high' : 'badge badge-success'}
                      style={{ fontSize: 11 }}
                    >
                      {output.requiresApproval ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td
                    style={{
                      maxWidth: 320,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={output.recommendation}
                  >
                    {output.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Final governance decision */}
      <div className="section">
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Final Governance Decision</span>
            <span
              className={`badge ${DECISION_BADGE_CLASS[result.finalDecision] ?? 'badge-neutral'}`}
              style={{ fontSize: 13 }}
            >
              {result.finalDecision}
            </span>
            {result.seniorApprovalRequired && (
              <span className="badge badge-sev-high" style={{ fontSize: 11 }}>
                Senior approval required
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="section">
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/demo" className="btn btn-ghost btn-sm">
            Try another scenario
          </Link>
          <Link href="/tasks" className="btn btn-primary btn-sm">
            View full platform
          </Link>
        </div>
      </div>
    </div>
  );
}
