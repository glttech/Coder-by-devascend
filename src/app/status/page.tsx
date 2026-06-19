import prisma from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/currentUser';
import { requireRole } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { featureFlags } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const user = await getCurrentUser();
  const authResult = requireRole(user, 'admin');
  if (!authResult.ok) redirect('/login');

  // Database check
  let dbPass = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbPass = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Uptime
  const uptimeSeconds = process.uptime();
  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeDisplay = uptimeDays > 0
    ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
    : uptimeHours > 0
      ? `${uptimeHours}h ${uptimeMinutes}m`
      : `${uptimeMinutes}m ${Math.floor(uptimeSeconds % 60)}s`;

  // Recent audit events (last 10)
  let recentAuditEvents: { id: string; event: string; createdAt: Date }[] = [];
  try {
    recentAuditEvents = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, event: true, createdAt: true },
    });
  } catch {
    // DB might be unavailable
  }

  const flagEntries = Object.entries(featureFlags) as [string, boolean][];

  return (
    <div>
      <PageHeader
        title="System Status"
        subtitle="Health checks and runtime information"
      />

      {/* Database check */}
      <div className="section">
        <Card>
          <CardHeader title="Database" subtitle="Connectivity check" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 700,
                background: dbPass ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: dbPass ? '#16a34a' : '#dc2626',
                border: dbPass ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: dbPass ? '#22c55e' : '#ef4444',
                }}
              />
              {dbPass ? 'PASS' : 'FAIL'}
            </span>
            {!dbPass && dbError && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {dbError.slice(0, 120)}
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* API health / uptime */}
      <div className="section">
        <Card>
          <CardHeader title="API Health" subtitle="Process uptime" />
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'rgba(34,197,94,0.1)',
                  color: '#16a34a',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                OK
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Uptime: <strong>{uptimeDisplay}</strong>
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature flags */}
      <div className="section">
        <Card>
          <CardHeader title="Feature Flags" subtitle="Current boolean flag states" />
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

      {/* Recent audit events */}
      <div className="section">
        <Card>
          <CardHeader title="Recent Audit Events" subtitle="Last 10 audit log entries" />
          {recentAuditEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>No audit events recorded yet.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAuditEvents.map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{entry.event}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {entry.createdAt.toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
