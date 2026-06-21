import prisma from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>enabled</span>
  ) : (
    <span style={{ background: 'rgba(156,163,175,0.1)', color: '#6b7280', border: '1px solid rgba(156,163,175,0.3)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>disabled</span>
  );
}

export default async function PoliciesPage() {
  const policies = await prisma.commandPolicy.findMany({
    where: { orgId: 'org_default' },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <PageHeader
        title="Command Policies"
        subtitle="Allowlist, workdir scoping, and log scrubbing configuration for CLI sessions"
        actions={
          <Link href="/coder/policies/new" className="btn btn-ghost btn-sm">
            + New Policy
          </Link>
        }
      />

      {policies.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No command policies yet."
          description="Policies define which commands and working directories are permitted for CLI sessions, and whether log output is scrubbed for secrets."
          action={<Link href="/coder/policies/new" className="btn btn-ghost btn-sm">Create policy</Link>}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th className="col-hide-mobile">Prefixes</th>
                <th className="col-hide-mobile">Workdirs</th>
                <th className="col-hide-mobile">Scrub logs</th>
                <th className="col-hide-mobile">Created</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                    {p.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                      </div>
                    )}
                  </td>
                  <td><EnabledBadge enabled={p.enabled} /></td>
                  <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                    {p.commandPrefixes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {p.commandPrefixes.slice(0, 3).map((prefix, i) => (
                          <code key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{prefix}</code>
                        ))}
                        {p.commandPrefixes.length > 3 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{p.commandPrefixes.length - 3} more</span>
                        )}
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.allowedWorkdirs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {p.allowedWorkdirs.slice(0, 2).map((dir, i) => (
                          <code key={i} style={{ fontSize: 11 }}>{dir}</code>
                        ))}
                        {p.allowedWorkdirs.length > 2 && (
                          <span style={{ fontSize: 11 }}>+{p.allowedWorkdirs.length - 2} more</span>
                        )}
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12 }}>
                    {p.scrubLogs ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ on</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>off</span>
                    )}
                  </td>
                  <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    <Link href={`/coder/policies/${p.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 28, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>How policies work</div>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
          <li><strong>Command allowlist</strong> — a CLI session&apos;s command must start with one of the listed prefixes.</li>
          <li><strong>Workdir scoping</strong> — the session&apos;s working directory must be under one of the allowed base paths.</li>
          <li><strong>Log scrubbing</strong> — when enabled, known secret patterns (API keys, tokens, passwords) are redacted from stored log lines before they are written to the database.</li>
          <li>Policies are evaluated at session dispatch time (W-9+). Multiple enabled policies are OR-combined: the session is allowed if <em>any</em> policy permits it.</li>
        </ul>
      </div>
    </div>
  );
}
