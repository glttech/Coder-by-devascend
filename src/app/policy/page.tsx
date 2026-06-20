import { DEFAULT_POLICY_RULES } from '@/lib/policyGates';

export const dynamic = 'force-static';

const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  block: {
    bg: 'rgba(239,68,68,0.10)',
    color: '#dc2626',
    border: 'rgba(239,68,68,0.3)',
  },
  require_approval: {
    bg: 'rgba(251,191,36,0.10)',
    color: '#b45309',
    border: 'rgba(251,191,36,0.4)',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  migration: 'Migration',
  auth: 'Auth / RBAC',
  env_config: 'Env / Config',
  payment: 'Payment',
  production: 'Production',
  secrets: 'Secrets',
  destructive: 'Destructive',
  infra: 'Infrastructure',
};

export default function PolicyReferencePage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Policy Rules Reference</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
          These policy rules are evaluated automatically when a task is created. Violations
          either <strong style={{ color: '#dc2626' }}>block</strong> the task (requires owner
          approval) or flag it as{' '}
          <strong style={{ color: '#b45309' }}>requiring approval</strong> before dispatch.
        </p>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Description</th>
              <th>Constraints</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_POLICY_RULES.map((rule) => {
              const sev = SEVERITY_STYLES[rule.severity] ?? SEVERITY_STYLES.require_approval;
              return (
                <tr key={rule.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{rule.name}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>
                      {CATEGORY_LABELS[rule.category] ?? rule.category}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: sev.bg,
                        color: sev.color,
                        border: `1px solid ${sev.border}`,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rule.severity === 'block' ? 'Block' : 'Approval Required'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {rule.description}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {rule.riskLevels && rule.riskLevels.length > 0 && (
                      <div>
                        <span style={{ fontWeight: 600 }}>Risk:</span>{' '}
                        {rule.riskLevels.join(', ')}
                      </div>
                    )}
                    {rule.environments && rule.environments.length > 0 && (
                      <div>
                        <span style={{ fontWeight: 600 }}>Env:</span>{' '}
                        {rule.environments.join(', ')}
                      </div>
                    )}
                    {!rule.riskLevels?.length && !rule.environments?.length && (
                      <span style={{ color: 'var(--text-muted)' }}>All</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
