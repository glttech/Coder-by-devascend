import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  DEFAULT_POLICY_RULES,
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  SEVERITY_COLOR,
} from '@/lib/policyRules';

export const dynamic = 'force-dynamic';

export default function PoliciesPage() {
  const blockRules = DEFAULT_POLICY_RULES.filter((r) => r.severity === 'block');
  const approvalRules = DEFAULT_POLICY_RULES.filter((r) => r.severity === 'require_approval');

  return (
    <div>
      <PageHeader
        title="Policy Rules"
        subtitle={
          <Link href="/settings" style={{ fontSize: 12, color: 'var(--blue)' }}>
            ← Settings
          </Link>
        }
        actions={
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '4px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            Read-only — rules are hardcoded
          </span>
        }
      />

      <div className="section">
        <div className="card" style={{ padding: '12px 16px', marginBottom: 0 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            These rules are evaluated automatically when tasks are dispatched. Tasks that match a
            <strong style={{ color: 'var(--red)', margin: '0 4px' }}>Block</strong> rule are
            prevented from executing. Tasks that match a
            <strong style={{ color: 'var(--amber)', margin: '0 4px' }}>Require Approval</strong>{' '}
            rule are held pending human review.
          </p>
        </div>
      </div>

      {/* Block rules */}
      <div className="section">
        <div className="section-header">
          <span className="section-title" style={{ color: 'var(--red)' }}>
            Block Rules ({blockRules.length})
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Category</th>
                <th>Action</th>
                <th>Condition</th>
                <th>Risk Levels</th>
                <th>Environments</th>
              </tr>
            </thead>
            <tbody>
              {blockRules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{rule.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {rule.id}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {CATEGORY_LABEL[rule.category] ?? rule.category}
                  </td>
                  <td>
                    <span
                      className="badge badge-sev-high"
                      style={{ background: SEVERITY_COLOR[rule.severity] }}
                    >
                      {SEVERITY_LABEL[rule.severity] ?? rule.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>
                    {rule.description}
                    <div style={{ marginTop: 4 }}>
                      <PatternList patterns={rule.instructionPatterns} label="instruction" />
                      {rule.titlePatterns && rule.titlePatterns.length > 0 && (
                        <PatternList patterns={rule.titlePatterns} label="title" />
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {rule.riskLevels && rule.riskLevels.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {rule.riskLevels.map((lvl) => (
                          <span
                            key={lvl}
                            style={{
                              fontSize: 11,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '1px 6px',
                              textTransform: 'capitalize',
                            }}
                          >
                            {lvl}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>All</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {rule.environments && rule.environments.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {rule.environments.map((env) => (
                          <span
                            key={env}
                            style={{
                              fontSize: 11,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '1px 6px',
                            }}
                          >
                            {env}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>All</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Require Approval rules */}
      <div className="section">
        <div className="section-header">
          <span className="section-title" style={{ color: 'var(--amber)' }}>
            Require Approval Rules ({approvalRules.length})
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Category</th>
                <th>Action</th>
                <th>Condition</th>
                <th>Risk Levels</th>
                <th>Environments</th>
              </tr>
            </thead>
            <tbody>
              {approvalRules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{rule.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {rule.id}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {CATEGORY_LABEL[rule.category] ?? rule.category}
                  </td>
                  <td>
                    <span
                      className="badge badge-warning"
                      style={{ background: SEVERITY_COLOR[rule.severity] }}
                    >
                      {SEVERITY_LABEL[rule.severity] ?? rule.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>
                    {rule.description}
                    <div style={{ marginTop: 4 }}>
                      <PatternList patterns={rule.instructionPatterns} label="instruction" />
                      {rule.titlePatterns && rule.titlePatterns.length > 0 && (
                        <PatternList patterns={rule.titlePatterns} label="title" />
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {rule.riskLevels && rule.riskLevels.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {rule.riskLevels.map((lvl) => (
                          <span
                            key={lvl}
                            style={{
                              fontSize: 11,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '1px 6px',
                              textTransform: 'capitalize',
                            }}
                          >
                            {lvl}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>All</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {rule.environments && rule.environments.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {rule.environments.map((env) => (
                          <span
                            key={env}
                            style={{
                              fontSize: 11,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '1px 6px',
                            }}
                          >
                            {env}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>All</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      <div className="section">
        <div className="section-header">
          <span className="section-title">Summary</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <div className="stat-card">
            <div className="stat-card-label">Total Rules</div>
            <div className="stat-card-value">{DEFAULT_POLICY_RULES.length}</div>
          </div>
          <div className="stat-card" style={{ border: '2px solid var(--red)' }}>
            <div className="stat-card-label">Block Rules</div>
            <div className="stat-card-value" style={{ color: 'var(--red)' }}>
              {blockRules.length}
            </div>
          </div>
          <div className="stat-card" style={{ border: '2px solid var(--amber)' }}>
            <div className="stat-card-label">Approval Rules</div>
            <div className="stat-card-value" style={{ color: 'var(--amber)' }}>
              {approvalRules.length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Categories</div>
            <div className="stat-card-value">
              {new Set(DEFAULT_POLICY_RULES.map((r) => r.category)).size}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatternList({ patterns, label }: { patterns: string[]; label: string }) {
  if (patterns.length === 0) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: 4,
        }}
      >
        {label}:
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
        {patterns.slice(0, 4).join(', ')}
        {patterns.length > 4 ? ` +${patterns.length - 4} more` : ''}
      </span>
    </div>
  );
}
