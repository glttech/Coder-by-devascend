import { redirect } from 'next/navigation';
import { getCurrentUser, isAuthEnabled } from '@/lib/session';
import { PageHeader } from '@/components/ui/PageHeader';
import type { ReadinessReport, CheckStatus } from '@/lib/releaseChecks';

export const dynamic = 'force-dynamic';

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') {
    return (
      <span
        style={{ color: 'var(--green-text, #15803d)', fontWeight: 700, fontSize: 16 }}
        aria-label="Pass"
      >
        ✓
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span
        style={{ color: 'var(--amber, #d97706)', fontWeight: 700, fontSize: 16 }}
        aria-label="Warning"
      >
        ⚠
      </span>
    );
  }
  return (
    <span
      style={{ color: 'var(--red-text, #b91c1c)', fontWeight: 700, fontSize: 16 }}
      aria-label="Fail"
    >
      ✗
    </span>
  );
}

function overallBannerStyle(status: CheckStatus): React.CSSProperties {
  if (status === 'pass') {
    return {
      background: 'var(--green-bg, rgba(21,128,61,0.08))',
      border: '1px solid var(--green, #16a34a)',
      color: 'var(--green-text, #15803d)',
    };
  }
  if (status === 'warn') {
    return {
      background: 'var(--amber-bg, rgba(217,119,6,0.08))',
      border: '1px solid var(--amber, #d97706)',
      color: 'var(--amber-text, #92400e)',
    };
  }
  return {
    background: 'var(--red-bg, rgba(185,28,28,0.08))',
    border: '1px solid var(--red, #dc2626)',
    color: 'var(--red-text, #b91c1c)',
  };
}

function overallBannerLabel(status: CheckStatus): string {
  if (status === 'pass') return '✓ All checks passed — ready to deploy';
  if (status === 'warn') return '⚠ One or more warnings — review before deploying';
  return '✗ One or more checks failed — not ready to deploy';
}

async function fetchReport(): Promise<ReadinessReport | null> {
  try {
    // Server-side fetch — use absolute URL with the internal origin.
    // During SSR we call the lib directly to avoid round-trip overhead.
    const { runReadinessChecks } = await import('@/lib/releaseChecks');
    return await runReadinessChecks();
  } catch {
    return null;
  }
}

export default async function ReleaseChecksPage() {
  // Auth gate: redirect to login if auth is enforced and no session.
  if (isAuthEnabled()) {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/login?next=/release-checks');
    }
  }

  const report = await fetchReport();

  if (!report) {
    return (
      <div>
        <PageHeader title="Release Readiness" subtitle="Could not load report" />
        <div
          style={{
            background: 'var(--red-bg, rgba(185,28,28,0.08))',
            border: '1px solid var(--red, #dc2626)',
            color: 'var(--red-text, #b91c1c)',
            borderRadius: 'var(--radius, 6px)',
            padding: '12px 16px',
            marginTop: 16,
            fontSize: 14,
          }}
        >
          Failed to run release readiness checks. Check server logs for details.
        </div>
      </div>
    );
  }

  const bannerStyle = overallBannerStyle(report.overallStatus);

  return (
    <div>
      <PageHeader
        title="Release Readiness"
        subtitle={`Generated at ${new Date(report.generatedAt).toLocaleString()}`}
      />

      {/* Overall status banner */}
      <div
        style={{
          ...bannerStyle,
          borderRadius: 'var(--radius, 6px)',
          padding: '12px 16px',
          marginBottom: 24,
          fontWeight: 600,
          fontSize: 15,
        }}
        role="status"
        aria-live="polite"
      >
        {overallBannerLabel(report.overallStatus)}
      </div>

      {/* Checks table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>Status</th>
              <th style={{ width: 220 }}>Check</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((check) => (
              <tr key={check.name}>
                <td style={{ textAlign: 'center' }}>
                  <StatusIcon status={check.status} />
                </td>
                <td style={{ fontWeight: 500, fontSize: 14 }}>{check.name}</td>
                <td
                  style={{
                    fontSize: 13,
                    color:
                      check.status === 'fail'
                        ? 'var(--red-text, #b91c1c)'
                        : check.status === 'warn'
                          ? 'var(--amber-text, #92400e)'
                          : 'var(--text-secondary)',
                  }}
                >
                  {check.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong style={{ color: 'var(--green-text, #15803d)' }}>✓ Pass</strong> — configuration
          is correct
        </span>
        <span>
          <strong style={{ color: 'var(--amber, #d97706)' }}>⚠ Warn</strong> — acceptable for
          pre-prod, review before production
        </span>
        <span>
          <strong style={{ color: 'var(--red-text, #b91c1c)' }}>✗ Fail</strong> — must be fixed
          before deploying
        </span>
      </div>
    </div>
  );
}
