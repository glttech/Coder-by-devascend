import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { featureFlags } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

// Statically known from package.json inspection at dev time
const NEXT_VERSION = '^14.2.0';
const nextVersion = NEXT_VERSION;

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'admin');
  if (!authResult.ok) redirect('/login');

  // Database record counts per major model
  let counts: Record<string, number> = {};
  let dbError: string | null = null;
  try {
    const [
      projectCount,
      taskCount,
      agentRunCount,
      githubPRCount,
      incidentCount,
      auditLogCount,
      userCount,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.agentRun.count(),
      prisma.githubPR.count(),
      prisma.incident.count(),
      prisma.auditLog.count(),
      prisma.user.count(),
    ]);
    counts = {
      Project: projectCount,
      Task: taskCount,
      AgentRun: agentRunCount,
      GithubPR: githubPRCount,
      Incident: incidentCount,
      AuditLog: auditLogCount,
      User: userCount,
    };
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const flagEntries = Object.entries(featureFlags) as [string, boolean][];
  const nodeVersion = process.version;
  const currentDateTime = new Date().toLocaleString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div>
      <PageHeader
        title="Admin Settings"
        subtitle="System information, feature flags, and database statistics"
      />

      {/* System info */}
      <div className="section">
        <Card>
          <CardHeader title="System Info" subtitle="Runtime and version information" />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Next.js version</span>
              <span style={{ fontFamily: 'monospace' }}>{nextVersion}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Node.js version</span>
              <span style={{ fontFamily: 'monospace' }}>{nodeVersion}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>Current date/time</span>
              <span style={{ fontFamily: 'monospace' }}>{currentDateTime}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature flags */}
      <div className="section">
        <Card>
          <CardHeader title="Feature Flags" subtitle="Current boolean flag states — env var values are never shown" />
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flag</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {flagEntries.map(([key, value]) => (
                  <tr key={key}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{key}</td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: value ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                          color: value ? '#16a34a' : '#475569',
                          border: value ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(100,116,139,0.3)',
                        }}
                      >
                        {value ? 'true' : 'false'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Database info */}
      <div className="section">
        <Card>
          <CardHeader title="Database Info" subtitle="Record counts per major model — confirms DB connectivity" />
          {dbError ? (
            <div
              style={{
                marginTop: 12,
                padding: '12px 16px',
                borderRadius: 6,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                fontSize: 13,
                color: '#dc2626',
                fontFamily: 'monospace',
              }}
            >
              Database error: {dbError}
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Record Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(counts).map(([model, count]) => (
                    <tr key={model}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{model}</td>
                      <td style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Danger zone */}
      <div className="section">
        <Card
          style={{
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.03)',
          }}
        >
          <CardHeader title="Danger Zone" subtitle="Operations that require manual intervention" />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                Database Migrations
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Run <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>
                  npx prisma migrate deploy
                </code> in your terminal to apply pending migrations. Never run migrations directly on PROD without a backup.
              </div>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                Seed Data Reset
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Run <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>
                  npm run seed:demo
                </code> locally to reset demo data. This will overwrite existing records.
              </div>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                Production Deploy
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Production deployments require a PR review, CI passage, and explicit approval. Never push directly to the main branch in PROD. Use the CI pipeline.
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              fontSize: 12,
              color: '#92400e',
            }}
          >
            No destructive actions are available from this UI. All danger-zone operations require terminal access or CI/CD.
          </div>
        </Card>
      </div>
    </div>
  );
}
